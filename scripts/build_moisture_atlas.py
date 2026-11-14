import argparse
import csv
import gzip
import hashlib
import io
import json
import math
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode

import numpy as np
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))
from rootshadow.recovery import _calendar_day

CORE = [
    {"id":"us_sgp_goodwell","latitude":36.597,"longitude":-101.618},
    {"id":"us_sgp_stillwater","latitude":36.118,"longitude":-97.091},
    {"id":"australia_narrabri","latitude":-30.325,"longitude":149.783},
    {"id":"spain_cordoba","latitude":37.888,"longitude":-4.779},
    {"id":"argentina_pampas","latitude":-35.0,"longitude":-61.0},
    {"id":"southern_africa","latitude":-27.0,"longitude":25.0},
]
EXTRA = json.loads((ROOT / "product_data" / "locations.json").read_text(encoding="utf-8"))["selected_locations"]
SITES = CORE + EXTRA
ATLAS = ROOT / "frontend" / "public" / "atlas"
HISTORY = ATLAS / "history.json"
LATEST = ATLAS / "latest.json"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def historical(site):
    sid = site["id"]
    if sid in {s["id"] for s in CORE}:
        base = ROOT / "api" / "data" / "gate0"
        manifest = json.loads((base / "manifests" / f"{sid}_1981_2025.json").read_text(encoding="utf-8"))
        packed = (base / "processed" / f"{sid}_1981_2025.csv.gz").read_bytes()
        original = gzip.decompress(packed)
        expected = manifest["processed_sha256"]
    else:
        manifest = json.loads((ROOT / "product_data" / "gate0" / "manifests" / f"{sid}_1981_2025.json").read_text(encoding="utf-8"))
        packed = (ROOT / manifest["csv_gzip_file"]).read_bytes()
        if digest(packed) != manifest["csv_gzip_sha256"]:
            raise ValueError(f"Compressed file digest mismatch for {sid}")
        original = gzip.decompress(packed)
        expected = manifest["csv_uncompressed_sha256"]
    if digest(original) != expected:
        raise ValueError(f"Historical NASA digest mismatch for {sid}")
    frame = pd.read_csv(io.BytesIO(original), parse_dates=["date"]).set_index("date").sort_index()
    frame = frame.asfreq("D")
    if len(frame) != 16436 or frame.index[0] != pd.Timestamp("1981-01-01") or frame.index[-1] != pd.Timestamp("2025-12-31"):
        raise ValueError(f"Historical date coverage mismatch for {sid}")
    if frame[["GWETTOP","GWETROOT"]].notna().all(axis=1).sum() != 16436:
        raise ValueError(f"Historical soil variables missing at {sid}")
    return frame


def write_history():
    if len(SITES) != 97:
        raise ValueError("Expected precisely 97 historical study sites")
    ATLAS.mkdir(parents=True, exist_ok=True)
    output = {
        "schema": 1,
        "source": "NASA POWER/MERRA-2 model-derived monthly surface and root wetness percentiles and monthly rainfall",
        "baseline": "1991-2020, +/-15-day calendar reference window",
        "months": list(pd.date_range("1981-01-01", "2025-12-01", freq="MS").strftime("%Y-%m")),
        "sites": {}
    }
    for site in SITES:
        sid = site["id"]
        analysis = json.loads((ROOT / "frontend" / "public" / "site-results" / f"{sid}.json").read_text(encoding="utf-8"))
        frame = historical(site)
        records = analysis["monthly"]
        rainfall_col = "PRECTOT" if "PRECTOT" in frame else "PRECTOTCORR" if "PRECTOTCORR" in frame else None
        rain = frame[rainfall_col].resample("MS").sum(min_count=25).round(1) if rainfall_col else pd.Series(dtype=float)
        values = []
        for row in records:
            stamp = row["month"]
            r = rain.get(pd.Timestamp(stamp + "-01"))
            total = round(float(r),1) if r is not None and pd.notna(r) and r >= 0 else None
            values.append([row["top_percentile"], row["root_percentile"], total])
        if len(values) != 540:
            raise ValueError(f"Unexpected monthly coverage for {sid}")
        output["sites"][sid] = values
        print(f"HISTORY {sid}: 540 months", flush=True)
    HISTORY.write_text(json.dumps(output, ensure_ascii=False, separators=(",",":"), allow_nan=False) + "\n", encoding="utf-8")
    print(f"HISTORY COMPLETE: {len(SITES)} locations x 540 months", flush=True)


def percentile(values, baseline, stamp):
    ref = baseline.loc[(baseline.index.year >= 1991) & (baseline.index.year <= 2020)]
    if ref.notna().sum() < 365*5:
        return None
    reference_day = _calendar_day(ref.index)
    target_day = int(_calendar_day(pd.DatetimeIndex([stamp]))[0])
    gap = np.abs(reference_day - target_day)
    candidates = np.sort(ref.to_numpy(dtype=float)[(np.minimum(gap, 366-gap) <= 15) & np.isfinite(ref.to_numpy(dtype=float))])
    if len(candidates) < 100:
        return None
    return round(float((np.searchsorted(candidates, values, side="left") + np.searchsorted(candidates, values, side="right")) / (2*len(candidates))*100), 1)


def nasa_latest(site, session, today):
    latest_allowed = today - timedelta(days=2)
    starts = ["2026-01-01"]
    target = datetime.strptime(starts[0], "%Y-%m-%d").date()
    if latest_allowed < target:
        raise ValueError("Current date precedes start of monitored period")
    def request(end):
        args = {
            "parameters":"GWETTOP,GWETROOT,PRECTOTCORR,T2M",
            "community":"AG",
            "longitude":f'{site["longitude"]:.5f}',
            "latitude":f'{site["latitude"]:.5f}',
            "start":"20260101",
            "end":end.strftime("%Y%m%d"),
            "format":"JSON",
            "time-standard":"UTC",
        }
        url = "https://power.larc.nasa.gov/api/temporal/daily/point?" + urlencode(args)
        response = session.get(url, headers={"Accept":"application/json", "User-Agent":"ROOTSHADOW-SYZYNOVA-Atlas/1.0"}, timeout=(8,70))
        response.raise_for_status()
        blob = response.content
        if "json" not in response.headers.get("Content-Type", "").lower():
            raise ValueError("NASA did not return JSON")
        data = json.loads(blob)
        vals = data.get("properties",{}).get("parameter",{})
        if not isinstance(vals,dict) or not all(isinstance(vals.get(k),dict) for k in ("GWETTOP","GWETROOT")):
            raise ValueError("NASA response missing required wetness fields")
        return vals, url, digest(blob)
    errors = []
    for lag in (2,5,9,16):
        end = min(latest_allowed, today - timedelta(days=lag))
        try:
            vals, url, source_hash = request(end)
            series = []
            for date_code, top in sorted(vals["GWETTOP"].items()):
                root = vals["GWETROOT"].get(date_code)
                if date_code > end.strftime("%Y%m%d"):
                    continue
                if any(not isinstance(v,(int,float)) or isinstance(v,bool) or not math.isfinite(v) or not 0 <= v <= 1 for v in (top,root)):
                    continue
                dt = datetime.strptime(date_code, "%Y%m%d").date()
                precip = vals.get("PRECTOTCORR",{}).get(date_code)
                precip = float(precip) if isinstance(precip,(int,float)) and not isinstance(precip,bool) and math.isfinite(precip) and 0 <= precip < 1000 else None
                series.append((dt,float(top),float(root),precip))
            if len(series) < 7:
                raise ValueError("Fewer than 7 paired days available")
            last = series[-1]
            if (today-last[0]).days > 45:
                raise ValueError("Most recent NASA source is older than 45 days")
            frame = historical(site)
            data = []
            for dt, surface, root, rain in series[-45:]:
                stamp = pd.Timestamp(dt)
                sp = percentile(surface,frame["GWETTOP"],stamp)
                rp = percentile(root,frame["GWETROOT"],stamp)
                data.append({"date":dt.isoformat(),"surface_percentile":sp,"root_percentile":rp,"precip_mm":rain})
            entry = data[-1]
            recent = data[-7:]
            sustained = len(recent)==7 and all(item["surface_percentile"] is not None and item["surface_percentile"] >= 40 for item in recent)
            mismatch = entry["surface_percentile"] is not None and entry["root_percentile"] is not None and entry["surface_percentile"] >= 40 and entry["root_percentile"] < 40
            rain7 = [item["precip_mm"] for item in recent]
            return {
                "date":entry["date"],
                "surface_percentile":entry["surface_percentile"],
                "root_percentile":entry["root_percentile"],
                "mismatch_screen":mismatch,
                "surface_above_40_for_7_days":sustained,
                "precip_7d_mm":round(sum(rain7),1) if all(v is not None for v in rain7) else None,
                "source_url":url,
                "source_sha256":source_hash,
                "retrieved_utc":datetime.now(timezone.utc).isoformat(),
                "history_45d":data
            }
        except (requests.RequestException, ValueError, TypeError, KeyError) as exc:
            errors.append(f"{lag}d: {str(exc)[:180]}")
            time.sleep(0.4)
    raise ValueError("; ".join(errors))


def refresh(region):
    today = datetime.now(timezone.utc).date()
    selected = [s for s in SITES if s["region"] == region] if region != "Original sites" else CORE
    if region == "Original sites":
        selected = CORE
    if not selected:
        raise ValueError(f"No matching region {region}")
    session = requests.Session()
    results = {}
    failed = {}
    for site in selected:
        try:
            entry = nasa_latest(site,session,today)
            results[site["id"]] = entry
            print(f"FRESH {site['id']}: {entry['date']} surface={entry['surface_percentile']} root={entry['root_percentile']}",flush=True)
        except Exception as exc:
            failed[site["id"]] = str(exc)[:400]
            print(f"UNAVAILABLE {site['id']}: {exc}",flush=True)
    folder=ROOT/"product_data"/"atlas_refresh"
    folder.mkdir(parents=True,exist_ok=True)
    (folder/(region.lower().replace(" ","_")+".json")).write_text(json.dumps({"sites":results,"failed":failed,"region":region},ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")


def merge():
    folder = ROOT/"product_data"/"atlas_refresh"
    expected_regions = {"Original sites"} | {s["region"] for s in EXTRA}
    all_sites = {}
    failures = {}
    for region in expected_regions:
        path = folder/(region.lower().replace(" ","_")+".json")
        if not path.exists():
            raise ValueError(f"Missing region result: {region}")
        v=json.loads(path.read_text(encoding="utf-8"))
        all_sites.update(v["sites"])
        failures.update(v["failed"])
    previous = json.loads(LATEST.read_text(encoding="utf-8")) if LATEST.exists() else {"sites":{}}
    for site_id,value in previous.get("sites",{}).items():
        if site_id not in all_sites and site_id in {s["id"] for s in SITES}:
            all_sites[site_id]=value
        elif site_id in all_sites and value["date"]>all_sites[site_id]["date"]:
            all_sites[site_id]=value
    if not all_sites:
        if LATEST.exists():
            print("No fresh data; preserving previously verified atlas",flush=True)
            return
        raise RuntimeError("No NASA POWER recent observations retrieved, refusing to publish artificial daily data")
    newest=max(item["date"] for item in all_sites.values())
    oldest=min(item["date"] for item in all_sites.values())
    content={
        "schema":1,
        "source":"NASA POWER/MERRA-2 gridded model derived daily GWETTOP, GWETROOT and precipitation (not SMAP)",
        "not_field_observations":True,
        "not_global_raster":True,
        "retrieval_checked_utc":datetime.now(timezone.utc).isoformat(),
        "latest_observation_date":newest,
        "oldest_site_observation_date":oldest,
        "verified_site_count":len(all_sites),
        "missing_site_count":len(SITES)-len(all_sites),
        "failures":failures,
        "mismatch_definition":"At the latest paired model day, surface seasonal percentile >= 40 and root seasonal percentile < 40; screening difference only, NOT a confirmed drought recovery lag.",
        "sites":all_sites
    }
    ATLAS.mkdir(parents=True,exist_ok=True)
    LATEST.write_text(json.dumps(content,ensure_ascii=False,allow_nan=False,separators=(",",":"))+"\n",encoding="utf-8")
    print(f"LIVE ATLAS: {len(all_sites)}/97 NASA points, newest={newest}, oldest={oldest}",flush=True)


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--history",action="store_true")
    p.add_argument("--region")
    p.add_argument("--merge",action="store_true")
    a=p.parse_args()
    if a.history:
        write_history()
    elif a.region:
        refresh(a.region)
    elif a.merge:
        merge()
    else:
        p.error("Choose --history, --region, or --merge")


if __name__=="__main__":
    main()
