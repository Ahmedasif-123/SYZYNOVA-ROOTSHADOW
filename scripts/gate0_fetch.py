import argparse
import csv
import hashlib
import json
import math
import time
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

import requests

API = "https://power.larc.nasa.gov/api/temporal/daily/point"
CORE_PARAMETERS = ("GWETTOP", "GWETROOT", "T2M")
PRECIP = "PRECTOT"
PARAMETERS = ("GWETTOP", "GWETROOT", PRECIP, "T2M")
SITES = {
    "us_sgp_stillwater": (36.118, -97.091),
    "us_sgp_goodwell": (36.597, -101.618),
    "australia_narrabri": (-30.325, 149.783),
    "spain_cordoba": (37.888, -4.779),
    "comparison_fresno": (36.737, -119.787),
    "comparison_munich": (48.135, 11.582),
    "us_oklahoma": (35.5, -97.5),
    "us_kansas": (37.2, -98.1),
    "us_texas": (34.5, -100.3),
    "australia_murray_darling": (-34.0, 143.0),
    "iberia": (39.0, -4.5),
    "argentina_pampas": (-35.0, -61.0),
    "southern_africa": (-27.0, 25.0),
    "comparison_eastern_us": (34.8, -83.0),
    "comparison_western_europe": (50.5, 5.0),
}
MISSING = {-999, -999.0, -9999, -9999.0}


def windows(start_year, end_year, size=10):
    if start_year < 1981 or end_year < start_year or end_year > datetime.now(timezone.utc).year:
        raise ValueError("Invalid year range")
    for first in range(start_year, end_year + 1, size):
        last = min(first + size - 1, end_year)
        yield f"{first}0101", f"{last}1231"


def request_url(latitude, longitude, start, end, include_precip=True):
    params = {
        "community": "HY",
        "parameters": ",".join(PARAMETERS if include_precip else CORE_PARAMETERS),
        "longitude": f"{longitude:.5f}",
        "latitude": f"{latitude:.5f}",
        "start": start,
        "end": end,
        "format": "JSON",
        "time-standard": "UTC",
    }
    return API + "?" + urlencode(params)


def validate_payload(payload, start, end):
    if not isinstance(payload, dict):
        raise ValueError("Response is not JSON object")
    variables = payload.get("properties", {}).get("parameter", {})
    present = [v for v in PARAMETERS if v in variables]
    for variable in CORE_PARAMETERS:
        if not isinstance(variables.get(variable), dict) or not variables[variable]:
            raise ValueError(f"Missing or empty series: {variable}")
    dates = sorted(variables["GWETTOP"])
    if dates[0] < start or dates[-1] > end:
        raise ValueError("Response date range exceeds request")
    valid_days = 0
    for key in dates:
        date.fromisoformat(f"{key[:4]}-{key[4:6]}-{key[6:8]}")
        for variable in present:
            if key not in variables[variable]:
                raise ValueError(f"Missing date {key} in {variable}")
            value = variables[variable][key]
            if value is None or value in MISSING:
                continue
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                raise ValueError(f"Non-numeric or non-finite {variable} value")
            if variable in ("GWETTOP", "GWETROOT") and not 0 <= value <= 1:
                raise ValueError(f"Invalid fractional soil wetness for {variable}")
            if variable == PRECIP and value < 0:
                raise ValueError("Negative precipitation")
        if all(variables[name][key] is not None and variables[name][key] not in MISSING for name in ("GWETTOP", "GWETROOT")):
            valid_days += 1
    if not valid_days:
        raise ValueError("No usable paired soil-moisture observations")
    return variables, dates, valid_days


def fetch_bytes(url, session=None, attempts=3):
    client = session or requests.Session()
    error = None
    for index in range(attempts):
        try:
            result = client.get(url, timeout=(6, 55), headers={"Accept": "application/json", "User-Agent": "ROOTSHADOW-SYZYNOVA/1.0"})
            result.raise_for_status()
            if "json" not in result.headers.get("content-type", "").lower():
                raise ValueError("Unexpected response media type")
            return result.content
        except (requests.RequestException, ValueError) as exc:
            error = exc
            if index + 1 < attempts:
                time.sleep(2 ** index)
    raise RuntimeError(f"NASA POWER request failed: {error}")


def process_chunk(site, latitude, longitude, start, end, folder, session=None):
    url = request_url(latitude, longitude, start, end)
    try:
        raw_bytes = fetch_bytes(url, session)
    except RuntimeError:
        # If POWER rejects the precipitation name, precipitation is dropped; the science needs only GWETTOP/GWETROOT.
        url = request_url(latitude, longitude, start, end, include_precip=False)
        raw_bytes = fetch_bytes(url, session)
    payload = json.loads(raw_bytes)
    variables, dates, valid_days = validate_payload(payload, start, end)
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{site}_{start}_{end}.json"
    path.write_bytes(raw_bytes)
    return {
        "path": str(path),
        "sha256": hashlib.sha256(raw_bytes).hexdigest(),
        "url": url,
        "retrieved_utc": datetime.now(timezone.utc).isoformat(),
        "date_start": dates[0],
        "date_end": dates[-1],
        "reported_dates": len(dates),
        "paired_valid_dates": valid_days,
        "data_origin": "NASA POWER daily hydrology, gridded/model-derived",
        "variables": [v for v in PARAMETERS if v in variables],
    }, variables


def build_site(site, dest, start_year=1981, end_year=2025, session=None):
    if site not in SITES:
        raise ValueError(f"Unknown site: {site}")
    latitude, longitude = SITES[site]
    raw_dir = dest / "raw" / site
    chunks = []
    samples = {}
    for start, end in windows(start_year, end_year):
        entry, variables = process_chunk(site, latitude, longitude, start, end, raw_dir, session)
        chunks.append(entry)
        for key, value in variables["GWETTOP"].items():
            samples.setdefault(key, {}).update({variable: variables[variable].get(key) for variable in PARAMETERS if variable in variables})
    processed = dest / "processed"
    processed.mkdir(parents=True, exist_ok=True)
    csv_path = processed / f"{site}_{start_year}_{end_year}.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["date", *PARAMETERS])
        for key in sorted(samples):
            values = samples[key]
            writer.writerow([key, *["" if values.get(v) is None or values.get(v) in MISSING else values[v] for v in PARAMETERS]])
    record = {
        "site": site,
        "latitude": latitude,
        "longitude": longitude,
        "period": f"{start_year}–{end_year}",
        "reference_period_for_science": "1991–2020 (to be applied in a separate analysis step)",
        "processed_csv": str(csv_path),
        "processed_sha256": hashlib.sha256(csv_path.read_bytes()).hexdigest(),
        "source_chunks": chunks,
        "scientific_status": "RAW DATA INGESTED; NO FALSE-RECOVERY CLAIM VALIDATED",
    }
    manifest = dest / "manifests"
    manifest.mkdir(parents=True, exist_ok=True)
    manifest_path = manifest / f"{site}_{start_year}_{end_year}.json"
    manifest_path.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
    return manifest_path


def verify_manifests(dest):
    records = list((dest / "manifests").glob("*.json"))
    if not records:
        raise FileNotFoundError("No acquisition manifests exist")
    n = 0
    for manifest in records:
        payload = json.loads(manifest.read_text(encoding="utf-8"))
        for chunk in payload["source_chunks"]:
            path = Path(chunk["path"])
            if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != chunk["sha256"]:
                raise ValueError(f"Raw file missing or corrupted: {path}")
            n += 1
        p = Path(payload["processed_csv"])
        if not p.exists() or hashlib.sha256(p.read_bytes()).hexdigest() != payload["processed_sha256"]:
            raise ValueError(f"Processed file missing or corrupted: {p}")
    return len(records), n


def main():
    parser = argparse.ArgumentParser(description="Acquire and verify genuine NASA POWER daily datasets")
    parser.add_argument("--site", choices=tuple(SITES) + ("all",), default="us_oklahoma")
    parser.add_argument("--start-year", type=int, default=1981)
    parser.add_argument("--end-year", type=int, default=2025)
    parser.add_argument("--output", type=Path, default=Path("data/gate0"))
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    if args.verify:
        sites, files = verify_manifests(args.output)
        print(f"Integrity verified: {sites} site(s), {files} original NASA files")
        return
    chosen = SITES if args.site == "all" else (args.site,)
    for site in chosen:
        path = build_site(site, args.output, args.start_year, args.end_year)
        print(f"NASA data acquired: {site}; manifest: {path}")
    sites, files = verify_manifests(args.output)
    print(f"Integrity verified: {sites} site(s), {files} original NASA files")
    print("This script records data provenance; it does not establish scientific findings")


if __name__ == "__main__":
    main()
