import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "api"))
from rootshadow.service import available_sites, run_analysis

destination = root / "frontend" / "public" / "site-results"
destination.mkdir(parents=True, exist_ok=True)
site_ids = available_sites()
assert len(site_ids) == 6, f"Expected six checked NASA site snapshots, got {len(site_ids)}"

for site_id in site_ids:
    analysis = run_analysis(mode="site", site=site_id)
    assert analysis["source"]["mode"] == "verified_prefetched_nasa"
    assert analysis["period"]["days"] == 16436
    assert analysis["ready_for_scientific_claims"] is False
    with (destination / f"{site_id}.json").open("w", encoding="utf-8") as handle:
        json.dump(analysis, handle, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    print(site_id, len(analysis["events"]), "episodes", flush=True)
