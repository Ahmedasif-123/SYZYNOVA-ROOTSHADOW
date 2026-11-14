import hashlib
import json
import math
import os
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

import numpy as np
import pandas as pd
import requests

API_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
CORE_PARAMETERS = ("GWETTOP", "GWETROOT")
OPTIONAL_PARAMETERS = ("GWETPROF", "T2M")
PRECIP_PARAMETER = "PRECTOT"
PARAMETERS = CORE_PARAMETERS + OPTIONAL_PARAMETERS + (PRECIP_PARAMETER,)
PROFILES = (
    ("AG", ("GWETTOP", "GWETROOT", "PRECTOTCORR", "T2M")),
    ("AG", ("GWETTOP", "GWETROOT")),
    ("HY", ("GWETTOP", "GWETROOT", "PRECTOT", "T2M")),
    ("HY", ("GWETTOP", "GWETROOT")),
)
CHUNK_YEARS = 10
MISSING = {-999, -999.0, -9999, -9999.0}


class DataUnavailable(RuntimeError):
    pass


class IntegrityError(RuntimeError):
    pass


def validate_request(latitude, longitude, start, end, enforce_minimum=True):
    latitude = float(latitude)
    longitude = float(longitude)
    if not np.isfinite(latitude) or not -90 <= latitude <= 90:
        raise ValueError("Latitude must be between -90 and 90")
    if not np.isfinite(longitude) or not -180 <= longitude <= 180:
        raise ValueError("Longitude must be between -180 and 180")
    first = pd.Timestamp(start)
    last = pd.Timestamp(end)
    if first > last or first.year < 1981 or last > pd.Timestamp.now(tz="UTC").tz_localize(None):
        raise ValueError("Provide valid past dates from 1981 onwards")
    if enforce_minimum and (last - first).days < 365 * 5:
        raise ValueError("At least five years of observations are needed for seasonal comparisons")
    return latitude, longitude, first, last


def request_url(latitude, longitude, start, end, include_precip=True, enforce_minimum=True, community="AG", variables=None):
    latitude, longitude, first, last = validate_request(latitude, longitude, start, end, enforce_minimum)
    if variables is None:
        variables = PROFILES[0][1] if include_precip else CORE_PARAMETERS
    if community not in {"AG", "HY"}:
        raise ValueError("Unknown NASA POWER community")
    query = {
        "parameters": ",".join(variables),
        "community": community,
        "longitude": f"{longitude:.5f}",
        "latitude": f"{latitude:.5f}",
        "start": first.strftime("%Y%m%d"),
        "end": last.strftime("%Y%m%d"),
        "format": "JSON",
        "time-standard": "UTC",
    }
    return API_URL + "?" + urlencode(query)


def _cache_paths(url, cache_dir):
    key = hashlib.sha256(url.encode("utf-8")).hexdigest()[:24]
    folder = Path(cache_dir or os.environ.get("ROOTSHADOW_CACHE_DIR", Path(tempfile.gettempdir()) / "rootshadow-cache"))
    return folder / f"{key}.json", folder / f"{key}.manifest.json"


def verify_cache(raw_path, manifest_path):
    raw = raw_path.read_bytes()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    measured = hashlib.sha256(raw).hexdigest()
    if measured != manifest.get("sha256"):
        raise IntegrityError("Cached dataset checksum does not match its recorded digest")
    return json.loads(raw), manifest


def _write_cache(data_bytes, url, raw_path, manifest_path):
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    metadata = {
        "sha256": hashlib.sha256(data_bytes).hexdigest(),
        "source_url": url,
        "retrieved_utc": datetime.now(timezone.utc).isoformat(),
        "source": "NASA POWER API",
        "integrity_note": "SHA-256 compares the snapshot with its locally recorded digest; it does not authenticate NASA independently.",
    }
    with tempfile.NamedTemporaryFile(dir=raw_path.parent, delete=False) as temp:
        temp.write(data_bytes)
        pending_raw = Path(temp.name)
    pending_raw.replace(raw_path)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=manifest_path.parent, delete=False) as temp:
        json.dump(metadata, temp, indent=2)
        pending_manifest = Path(temp.name)
    pending_manifest.replace(manifest_path)
    return metadata


def chunk_windows(first, last, years=CHUNK_YEARS):
    """Split [first, last] into non-overlapping windows so that each NASA request stays small and cacheable."""
    cursor = pd.Timestamp(first)
    last = pd.Timestamp(last)
    while cursor <= last:
        stop = min(pd.Timestamp(year=cursor.year + years - 1, month=12, day=31), last)
        yield cursor, stop
        cursor = stop + pd.Timedelta(days=1)


def _nasa_error(response):
    try:
        detail = response.json()
    except (ValueError, TypeError):
        detail = getattr(response, "text", "")
    return json.dumps(detail, ensure_ascii=False)[:700] if isinstance(detail, (dict, list)) else str(detail)[:700]


def _fetch_chunk(latitude, longitude, first, last, cache_dir, session):
    errors = []
    started = time.monotonic()
    for community, variables in PROFILES:
        url = request_url(latitude, longitude, first, last, enforce_minimum=False, community=community, variables=variables)
        raw_path, manifest_path = _cache_paths(url, cache_dir)
        for attempt in range(2):
            try:
                response = session.get(url, timeout=(5, 40), headers={"Accept": "application/json", "User-Agent": "ROOTSHADOW-SpaceApps-Doha/0.3"})
                if response.status_code in (400, 422):
                    errors.append(f"{community}/{','.join(variables)}: HTTP {response.status_code}: {_nasa_error(response)}")
                    break
                response.raise_for_status()
                if "json" not in response.headers.get("content-type", "").lower():
                    raise DataUnavailable("NASA returned a non-JSON response")
                payload = response.json()
                validate_nasa_payload(payload, first, last)
                metadata = _write_cache(response.content, url, raw_path, manifest_path)
                metadata.update({"mode": "live_nasa", "community": community, "requested_parameters": list(variables)})
                return payload, metadata, round((time.monotonic() - started) * 1000), errors
            except (requests.RequestException, OSError, ValueError, KeyError, DataUnavailable) as exc:
                errors.append(f"{community}/{','.join(variables)}: {str(exc)[:350]}")
                if attempt == 0:
                    time.sleep(0.25)
    for community, variables in PROFILES:
        url = request_url(latitude, longitude, first, last, enforce_minimum=False, community=community, variables=variables)
        raw_path, manifest_path = _cache_paths(url, cache_dir)
        if raw_path.exists() and manifest_path.exists():
            payload, metadata = verify_cache(raw_path, manifest_path)
            validate_nasa_payload(payload, first, last)
            metadata.update({"mode": "verified_cached_nasa", "community": community, "requested_parameters": list(variables)})
            return payload, metadata, round((time.monotonic() - started) * 1000), errors
    raise DataUnavailable("NASA observations unavailable, no verified cache: " + "; ".join(errors))


def obtain_nasa(latitude, longitude, start, end, cache_dir=None, session=None):
    latitude, longitude, first, last = validate_request(latitude, longitude, start, end)
    session = session or requests.Session()
    merged = {}
    chunk_records = []
    all_errors = []
    latency = 0
    for window_start, window_end in chunk_windows(first, last):
        payload, metadata, ms, errors = _fetch_chunk(latitude, longitude, window_start, window_end, cache_dir, session)
        latency += ms
        all_errors.extend(errors)
        chunk_records.append({k: metadata[k] for k in ("sha256", "source_url", "retrieved_utc", "mode")})
        for name, series in payload["properties"]["parameter"].items():
            merged.setdefault(name, {}).update(series)
    modes = {c["mode"] for c in chunk_records}
    mode = "live_nasa" if modes == {"live_nasa"} else "verified_cached_nasa" if modes == {"verified_cached_nasa"} else "mixed_live_and_cached_nasa"
    digest = hashlib.sha256("".join(c["sha256"] for c in chunk_records).encode()).hexdigest()
    metadata = {
        "mode": mode,
        "source": "NASA POWER API (MERRA-2 derived, gridded)",
        "sha256": digest,
        "sha256_note": "Digest of the concatenated per-chunk SHA-256 digests; see chunks for each snapshot.",
        "chunks": chunk_records,
        "retrieved_utc": max(c["retrieved_utc"] for c in chunk_records),
        "integrity_note": "SHA-256 compares snapshots with locally recorded digests; it does not authenticate NASA independently.",
        "cache_fallback": mode != "live_nasa",
        "network_error": "; ".join(all_errors) if all_errors else None,
        "network_latency_ms": latency,
    }
    return parse_nasa({"properties": {"parameter": merged}}), metadata


def validate_nasa_payload(payload, first=None, last=None):
    container = payload.get("properties", {}).get("parameter", {}) if isinstance(payload, dict) else {}
    if not isinstance(container, dict):
        raise DataUnavailable("NASA response contains an invalid parameter dictionary")
    missing = [name for name in CORE_PARAMETERS if name not in container or not isinstance(container[name], dict)]
    if missing:
        raise DataUnavailable("The NASA response lacks required parameter series: " + ", ".join(missing))
    if not container["GWETTOP"] or not container["GWETROOT"]:
        raise DataUnavailable("The NASA response has no paired soil-wetness series")
    reference_dates = set(container["GWETTOP"])
    if set(container["GWETROOT"]) != reference_dates:
        raise DataUnavailable("NASA surface and root-zone date keys differ")
    if first is not None and last is not None:
        expected_dates = set(pd.date_range(first, last, freq="D").strftime("%Y%m%d"))
        if reference_dates != expected_dates:
            raise DataUnavailable("NASA returned incomplete or unexpected daily date coverage")
    for name in CORE_PARAMETERS:
        for value in container[name].values():
            if value is None or (isinstance(value, (int, float)) and not isinstance(value, bool) and value in MISSING):
                continue
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 1:
                raise DataUnavailable("NASA returned invalid " + name + " soil-wetness values")
    return container


def parse_nasa(payload):
    values = validate_nasa_payload(payload)
    if "PRECTOT" not in values and "PRECTOTCORR" in values:
        values = {**values, "PRECTOT": values["PRECTOTCORR"]}
    dates = pd.to_datetime(list(values["GWETTOP"].keys()), format="%Y%m%d", errors="raise")
    ordered = pd.DatetimeIndex(dates).sort_values()
    ordered = pd.date_range(ordered.min(), ordered.max(), freq="D")
    frame = pd.DataFrame(index=ordered)
    for key in PARAMETERS:
        if key not in values:
            frame["PRECIP" if key == PRECIP_PARAMETER else key] = np.nan
            continue
        samples = pd.Series(values[key], dtype="object")
        samples.index = pd.to_datetime(samples.index, format="%Y%m%d", errors="raise")
        numeric = pd.to_numeric(samples, errors="coerce").replace(list(MISSING), np.nan)
        frame["PRECIP" if key == PRECIP_PARAMETER else key] = numeric.reindex(ordered)
    if frame[["GWETTOP", "GWETROOT"]].notna().sum().min() < 365 * 3:
        raise DataUnavailable("Too few valid surface and root-zone samples for analysis")
    for variable in ("GWETTOP", "GWETROOT", "GWETPROF"):
        bad = frame[variable].notna() & ~frame[variable].between(0, 1)
        if bad.any():
            raise DataUnavailable(f"NASA returned out-of-range {variable} wetness values")
    frame.index.name = "date"
    return frame


def synthetic_demo():
    """Deterministic SIMULATED series (1981–2025) with injected drought→delayed-root-recovery episodes whose delay lengthens."""
    dates = pd.date_range("1981-01-01", "2025-12-31", freq="D")
    rng = np.random.default_rng(2026)
    phase = 2 * np.pi * (dates.dayofyear.to_numpy() / 365.25)
    def ar1(rho, sd):
        shocks = rng.normal(0, sd * np.sqrt(1 - rho ** 2), len(dates))
        out = np.zeros(len(dates))
        for i in range(1, len(dates)):
            out[i] = rho * out[i - 1] + shocks[i]
        return out
    top_noise = ar1(0.85, 0.04)
    root_noise = pd.Series(top_noise).ewm(alpha=0.05).mean().to_numpy() * 0.9 + ar1(0.95, 0.012)  # root lags surface, like a land model
    top = 0.51 + 0.08 * np.sin(phase) + top_noise
    root = 0.52 + 0.07 * np.sin(phase - 0.35) + root_noise
    for k, year in enumerate(range(1983, 2025, 4)):
        dry_start = pd.Timestamp(year, 3, 1)
        dry_end = dry_start + pd.Timedelta(days=100)
        mismatch_end = dry_end + pd.Timedelta(days=15 + 7 * k)  # delay grows through the record (synthetic trend)
        dry = (dates >= dry_start) & (dates < dry_end)
        mismatch = (dates >= dry_end) & (dates < mismatch_end)
        top[dry], root[dry] = 0.08, 0.09
        top[mismatch], root[mismatch] = 0.54 + rng.normal(0, 0.01, mismatch.sum()), 0.08
    top = np.clip(top, 0, 1)
    root = np.clip(root, 0, 1)
    frame = pd.DataFrame({"GWETTOP": top, "GWETROOT": root, "GWETPROF": 0.3 * top + 0.7 * root,
                          "PRECIP": np.nan, "T2M": 23 + 9 * np.cos(phase) + rng.normal(0, 0.7, len(dates))}, index=dates)
    frame.index.name = "date"
    metadata = {
        "mode": "synthetic_demonstration",
        "source": "Deterministic synthetic data created to demonstrate functionality",
        "warning": "NOT NASA OBSERVATIONS. Dates, values, and results are simulated (episode delay lengthens by construction). Do not use as scientific evidence.",
        "sha256": hashlib.sha256(frame.to_csv().encode("utf-8")).hexdigest(),
        "cache_fallback": False,
        "network_latency_ms": None,
    }
    return frame, metadata


def default_data_dirs():
    api_root = Path(__file__).resolve().parents[1]
    repository_root = api_root.parent
    env = os.environ.get("ROOTSHADOW_DATA_DIR")
    return [Path(env)] if env else [api_root / "data" / "gate0", repository_root / "data" / "gate0"]


def list_sites(data_dirs=None):
    found = {}
    for base in data_dirs or default_data_dirs():
        for manifest in sorted((base / "manifests").glob("*.json")) if (base / "manifests").exists() else []:
            record = json.loads(manifest.read_text(encoding="utf-8"))
            csv_path = base / "processed" / Path(record["processed_csv"]).name
            packed = csv_path.with_suffix(".csv.gz")
            if csv_path.exists() or packed.exists():
                found.setdefault(record["site"], (csv_path if csv_path.exists() else packed, record))
    return found


def load_site(site, data_dirs=None):
    """Load a Gate 0 NASA POWER CSV after re-verifying its recorded SHA-256 digest."""
    sites = list_sites(data_dirs)
    if site not in sites:
        raise DataUnavailable(f"No prefetched NASA snapshot for site '{site}'. Run scripts/gate0_fetch.py first.")
    csv_path, record = sites[site]
    if csv_path.suffix == ".gz":
        import gzip
        from io import BytesIO
        original = gzip.decompress(csv_path.read_bytes())
    else:
        original = csv_path.read_bytes()
    if hashlib.sha256(original).hexdigest() != record["processed_sha256"]:
        raise IntegrityError("Prefetched CSV does not match its manifest digest")
    from io import BytesIO
    frame = pd.read_csv(BytesIO(original), parse_dates=["date"]).set_index("date").sort_index().asfreq("D")
    if "PRECTOT" in frame:
        frame = frame.rename(columns={"PRECTOT": "PRECIP"})
    elif "PRECTOTCORR" in frame:
        frame = frame.rename(columns={"PRECTOTCORR": "PRECIP"})
    metadata = {
        "mode": "verified_prefetched_nasa", "source": "NASA POWER daily (MERRA-2 derived, gridded), prefetched by scripts/gate0_fetch.py",
        "site": site, "latitude": record["latitude"], "longitude": record["longitude"],
        "sha256": record["processed_sha256"], "retrieved_utc": record["source_chunks"][-1]["retrieved_utc"],
        "chunks": [{"sha256": c["sha256"], "source_url": c["url"], "retrieved_utc": c["retrieved_utc"]} for c in record["source_chunks"]],
        "integrity_note": "SHA-256 compares the CSV with its locally recorded digest; it does not authenticate NASA independently.",
        "cache_fallback": False, "network_latency_ms": None,
    }
    return frame, metadata
