import argparse
import gzip
import hashlib
import io
import json
import sys
import tarfile
from collections import Counter
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from rootshadow.analysis import analyze

REGIONS = {
    "middle-east": "Middle East",
    "north-africa": "North Africa",
    "sub-saharan-africa": "Sub-Saharan Africa",
    "south-east-asia": "South and East Asia",
    "central-asia": "Central Asia",
    "europe": "Europe",
    "north-america": "North America",
    "south-america": "South America",
    "oceania": "Oceania",
}

CATALOG = json.loads((ROOT / "product_data" / "locations.json").read_text(encoding="utf-8"))["selected_locations"]
DEST = ROOT / "product_data" / "build_output"
FINAL = ROOT / "frontend" / "public" / "site-results"


def checksum(payload):
    return hashlib.sha256(payload).hexdigest()


def make_analysis(site):
    site_id = site["id"]
    manifest_path = ROOT / "product_data" / "gate0" / "manifests" / f"{site_id}_1981_2025.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest["site"] != site_id or manifest["latitude"] != site["latitude"] or manifest["longitude"] != site["longitude"]:
        raise ValueError(f"{site_id}: manifest location mismatch")
    if manifest["scientific_validation"] != "NOT_PERFORMED" or manifest["daily_records"] != 16436:
        raise ValueError(f"{site_id}: unexpected provenance")
    packed = (ROOT / manifest["csv_gzip_file"]).read_bytes()
    if checksum(packed) != manifest["csv_gzip_sha256"]:
        raise ValueError(f"{site_id}: compressed snapshot mismatch")
    original = gzip.decompress(packed)
    if checksum(original) != manifest["csv_uncompressed_sha256"]:
        raise ValueError(f"{site_id}: source CSV checksum mismatch")
    frame = pd.read_csv(io.BytesIO(original), parse_dates=["date"]).set_index("date").sort_index().asfreq("D")
    frame = frame.rename(columns={"PRECTOT": "PRECIP"})
    if len(frame) != 16436 or frame.index.min() != pd.Timestamp("1981-01-01") or frame.index.max() != pd.Timestamp("2025-12-31"):
        raise ValueError(f"{site_id}: daily coverage mismatch")
    if frame[["GWETTOP", "GWETROOT"]].notna().all(axis=1).sum() != 16436:
        raise ValueError(f"{site_id}: missing paired soil-wetness records")
    meta = {
        "mode": "verified_prefetched_nasa",
        "source": "NASA POWER daily (MERRA-2 derived, gridded), prefetched by project acquisition workflow",
        "site": site_id,
        "latitude": site["latitude"],
        "longitude": site["longitude"],
        "sha256": manifest["csv_uncompressed_sha256"],
        "retrieved_utc": manifest["retrieved_utc"],
        "chunks": [{"sha256": chunk["sha256"], "source_url": chunk["source_url"], "retrieved_utc": chunk["retrieved_utc"]} for chunk in manifest["source_chunks"]],
        "integrity_note": "Locally recorded SHA-256 checks verify files against acquisition manifests, not field measurements or independent NASA authentication.",
        "cache_fallback": False,
        "network_latency_ms": None,
    }
    result = analyze(frame, meta, n_surrogates=200)
    result["location"] = {"latitude": site["latitude"], "longitude": site["longitude"], "site": site_id}
    result["scientific_validation_status"] = "Exploratory single-point MERRA-2 model screening. Not independently corroborated or operational."
    if result["ready_for_scientific_claims"] is not False:
        raise ValueError(f"{site_id}: unexpectedly marked as scientifically validated")
    if result["source"]["mode"] != "verified_prefetched_nasa" or result["period"]["days"] != 16436:
        raise ValueError(f"{site_id}: analysis output failed provenance check")
    if len(result["monthly"]) != 540:
        raise ValueError(f"{site_id}: missing monthly output")
    return result


def generate(region):
    targets = [site for site in CATALOG if site["region"] == REGIONS[region]]
    (DEST / "site-results").mkdir(parents=True, exist_ok=True)
    (DEST / "status").mkdir(parents=True, exist_ok=True)
    failures = {}
    completed = []
    for index, site in enumerate(targets, 1):
        try:
            output = make_analysis(site)
            file = DEST / "site-results" / f"{site['id']}.json"
            file.write_text(json.dumps(output, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n", encoding="utf-8")
            completed.append(site["id"])
            print(f"VERIFIED ANALYSIS {region}: {index}/{len(targets)} {site['id']} events={len(output['events'])}", flush=True)
        except Exception as exc:
            failures[site["id"]] = f"{type(exc).__name__}: {exc}"
            print(f"FAILED ANALYSIS {region}: {site['id']}: {exc}", flush=True)
    (DEST / "status" / f"{region}.json").write_text(json.dumps({"region": region, "verified": completed, "failed": failures}, indent=2) + "\n", encoding="utf-8")
    if failures:
        raise RuntimeError(f"{region}: {len(failures)} site analyses failed; artifacts retained for diagnosis")


def validate_and_publish():
    expected = {site["id"] for site in CATALOG}
    observed = {path.stem for path in (DEST / "site-results").glob("*.json")}
    if observed != expected:
        raise ValueError(f"Global analysis set incomplete: missing={sorted(expected-observed)}, unexpected={sorted(observed-expected)}")
    reports = [json.loads(p.read_text(encoding="utf-8")) for p in (DEST / "status").glob("*.json")]
    if len(reports) != len(REGIONS):
        raise ValueError("Not all region status reports were published")
    if any(report["failed"] for report in reports):
        raise ValueError("Unresolved analysis failures")
    if set().union(*(set(report["verified"]) for report in reports)) != expected:
        raise ValueError("Region and analysis files disagree")
    combined = 0
    surface_first = 0
    counts = {}
    FINAL.mkdir(parents=True, exist_ok=True)
    for site in CATALOG:
        path = DEST / "site-results" / f"{site['id']}.json"
        analysis = json.loads(path.read_text(encoding="utf-8"))
        manifest = json.loads((ROOT / "product_data" / "gate0" / "manifests" / f"{site['id']}_1981_2025.json").read_text(encoding="utf-8"))
        if analysis["source"]["sha256"] != manifest["csv_uncompressed_sha256"] or analysis["period"]["days"] != 16436 or analysis["ready_for_scientific_claims"] is not False:
            raise ValueError(f"Invalid exported analysis {site['id']}")
        events = analysis["events"]
        combined += len(events)
        surface_first += sum(e["status"] == "COMPLETE_SURFACE_FIRST" for e in events)
        counts[site["id"]] = {"events": len(events), "surface_first": sum(e["status"] == "COMPLETE_SURFACE_FIRST" for e in events)}
        (FINAL / path.name).write_bytes(path.read_bytes())
    originals = ["us_sgp_goodwell", "us_sgp_stillwater", "australia_narrabri", "spain_cordoba", "argentina_pampas", "southern_africa"]
    for site in originals:
        result = json.loads((FINAL / f"{site}.json").read_text(encoding="utf-8"))
        if result["source"]["mode"] != "verified_prefetched_nasa" or result["period"]["days"] != 16436:
            raise ValueError("Existing six-site scientific results were modified or lost")
    audit = {
        "new_sites": len(CATALOG),
        "original_research_sites": len(originals),
        "total_sites": len(CATALOG) + len(originals),
        "new_site_days": len(CATALOG) * 16436,
        "new_detected_episodes": combined,
        "new_completed_surface_first": surface_first,
        "regions": dict(Counter(site["region"] for site in CATALOG)),
        "per_site": counts,
        "scientific_status": "Exploratory screening of NASA POWER gridded model points only; independent scientific validation not performed",
        "existing_six_site_results_unchanged": True,
    }
    (ROOT / "product_data" / "ANALYSIS_REPORT.json").write_text(json.dumps(audit, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"PUBLISHED {len(CATALOG)} checked analyses, {combined} events, {surface_first} completed surface-first episodes", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--region", choices=REGIONS)
    parser.add_argument("--publish", action="store_true")
    args = parser.parse_args()
    if args.publish:
        validate_and_publish()
    elif args.region:
        generate(args.region)
    else:
        parser.error("Specify --region or --publish")
