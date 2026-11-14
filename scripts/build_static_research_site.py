from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from rootshadow.service import available_sites, run_analysis

SITE_COUNTS = {
    "us_sgp_goodwell": (31, 19),
    "us_sgp_stillwater": (26, 6),
    "australia_narrabri": (28, 16),
    "spain_cordoba": (25, 6),
    "argentina_pampas": (27, 11),
    "southern_africa": (21, 15),
}

def main() -> None:
    available = available_sites()
    if set(available) != set(SITE_COUNTS):
        raise RuntimeError("Published NASA data must include exactly six verified sites")
    directory = ROOT / "frontend/public/data/analyses"
    directory.mkdir(parents=True, exist_ok=True)
    summary = []
    for site, expected in SITE_COUNTS.items():
        result = run_analysis(mode="site", site=site)
        actual = len(result["events"]), sum(event["status"] == "COMPLETE_SURFACE_FIRST" for event in result["events"])
        if actual != expected:
            raise RuntimeError(f"Unexpected NASA model screening for {site}: {actual}, expected {expected}")
        if result["source"]["mode"] != "verified_prefetched_nasa":
            raise RuntimeError("Static scientific data must not come from synthetic demo mode")
        if result["ready_for_scientific_claims"]:
            raise RuntimeError("Static research cannot be reported as independent field validation")
        if result["period"]["start"] != "1981-01-01" or result["period"]["end"] != "2025-12-31":
            raise RuntimeError("Unexpected historical model period")
        raw = (json.dumps(result, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8")
        destination = directory / f"{site}.json"
        destination.write_bytes(raw)
        digest = hashlib.sha256(raw).hexdigest()
        summary.append({
            "site": site,
            "episodes": actual[0],
            "surface_first": actual[1],
            "source_sha256": result["source"]["sha256"],
            "report_sha256": digest,
            "scientific_validation": "exploratory_not_field_validated",
        })
        print(f"{site}: {actual[0]} drought episodes, {actual[1]} surface-first, sha256={digest}")
    manifest = {
        "project": "ROOTSHADOW",
        "dataset": "Historical NASA POWER/MERRA-2 model-derived soil-wetness analysis",
        "period": "1981-01-01 to 2025-12-31",
        "mode": "precomputed_verified_historical_analysis",
        "not_live": True,
        "not_independently_field_validated": True,
        "total_site_days": 98616,
        "episodes": 158,
        "completed_surface_first": 73,
        "sites": summary,
    }
    (directory.parent / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("Six historical analysis reports generated from verified NASA source snapshots")

if __name__ == "__main__":
    main()
