from __future__ import annotations

import gzip
import hashlib
import io
import json
import statistics
import sys
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "api"))

from scripts.gate0_fetch import build_site, verify_manifests
from rootshadow.service import run_analysis

NEW_SITES = {
    "argentina_pampas": {
        "sha256": "279f7ca593feca9b3497b29c0ee430ee247ba09b9a1a61c6ffe6caf7ca694a1b",
        "episodes": 27,
        "surface_first": 11,
        "median": 2,
        "p": 0.37173,
        "fixture": "argentina",
    },
    "southern_africa": {
        "sha256": "cd7298a8d1103f5f091846807f5e3966c8d082492ec7ac9e7b14fd33a252ad09",
        "episodes": 21,
        "surface_first": 15,
        "median": 25,
        "p": 0.83548,
        "fixture": "southern_africa",
    },
}

def replace(path: str, before: str, after: str) -> None:
    target = ROOT / path
    original = target.read_text(encoding="utf-8")
    if before not in original:
        if after in original:
            return
        raise ValueError(f"Expected anchor missing in {path}: {before[:100]}")
    target.write_text(original.replace(before, after, 1), encoding="utf-8")

def append(path: str, marker: str, addition: str) -> None:
    target = ROOT / path
    original = target.read_text(encoding="utf-8")
    if marker not in original:
        target.write_text(original + addition, encoding="utf-8")

def fetch_and_verify(site: str, config: dict) -> dict:
    folder = ROOT / "data/gate0"
    src = folder / "processed" / f"{site}_1981_2025.csv"
    if not src.exists():
        build_site(site, folder, 1981, 2025)
    original = src.read_bytes()
    digest = hashlib.sha256(original).hexdigest()
    if digest != config["sha256"]:
        raise ValueError(f"Unexpected NASA daily data at {site}: {digest}")
    record = json.loads((folder / "manifests" / f"{site}_1981_2025.json").read_text(encoding="utf-8"))
    if record["processed_sha256"] != digest:
        raise ValueError(f"Source manifest/CSV hash mismatch at {site}")
    for item in record["source_chunks"]:
        path = Path(item["path"])
        if not path.is_absolute():
            path = ROOT / path
        if hashlib.sha256(path.read_bytes()).hexdigest() != item["sha256"]:
            raise ValueError(f"Original NASA JSON checksum mismatch: {path}")
        item["path"] = f"data/gate0/raw/{site}/{path.name}"
    record["processed_csv"] = f"data/gate0/processed/{src.name}"
    packaged = ROOT / "api/data/gate0"
    packed = packaged / "processed" / f"{site}_1981_2025.csv.gz"
    packed.parent.mkdir(parents=True, exist_ok=True)
    packed.write_bytes(gzip.compress(original, mtime=0))
    if hashlib.sha256(gzip.decompress(packed.read_bytes())).hexdigest() != digest:
        raise ValueError(f"Packaged data failed verification: {site}")
    out = packaged / "manifests" / f"{site}_1981_2025.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    evidence = ROOT / "docs/evidence"
    evidence.mkdir(parents=True, exist_ok=True)
    with (evidence / f"nasa_power_{site}_1981_2025_raw.tar.gz").open("wb") as stream:
        with gzip.GzipFile(fileobj=stream, mode="wb", mtime=0) as gz:
            with tarfile.open(fileobj=gz, mode="w") as tar:
                for raw_path in sorted((folder / "raw" / site).glob("*.json")):
                    blob = raw_path.read_bytes()
                    info = tarfile.TarInfo(f"{site}/{raw_path.name}")
                    info.size = len(blob)
                    info.mode = 0o644
                    info.mtime = 0
                    tar.addfile(info, io.BytesIO(blob))
    return record

def audit_new_site(site: str, config: dict) -> dict:
    analysis = run_analysis(mode="site", site=site)
    if analysis["source"]["mode"] != "verified_prefetched_nasa":
        raise ValueError("A live or synthetic source was substituted for verified data")
    if analysis["source"]["sha256"] != config["sha256"]:
        raise ValueError("Analysis used unexpected site data")
    if analysis["period"]["days"] != 16436 or analysis["quality"]["paired_day_coverage"] != 1:
        raise ValueError(f"Invalid period or coverage at {site}")
    lags = [e["recovery_delay_days"] for e in analysis["events"] if e["status"] == "COMPLETE_SURFACE_FIRST"]
    expected = (config["episodes"], config["surface_first"], config["median"])
    measured = (len(analysis["events"]), len(lags), statistics.median(lags))
    if measured != expected:
        raise ValueError(f"Unexpected recovery events at {site}: {measured} != {expected}")
    if abs(analysis["lag_trend"]["p_value"] - config["p"]) > 0.0001:
        raise ValueError("The historical signed trend changed unexpectedly")
    if analysis["ready_for_scientific_claims"]:
        raise ValueError("Exploratory evidence must not be marked scientifically validated")
    file = ROOT / "frontend/tests/fixtures" / f"{config['fixture']}.json"
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps(analysis, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return analysis

def update_app() -> None:
    replace("frontend/src/lib/sites.ts",
        '"spain_cordoba";',
        '"spain_cordoba" | "argentina_pampas" | "southern_africa";')
    replace("frontend/src/lib/sites.ts",
        '{ id: "spain_cordoba", name: "Córdoba", region: "Andalusia", country: "Spain", coordinates: [-4.779, 37.888], landscape: "Mediterranean cropland", index: "04" }',
        '{ id: "spain_cordoba", name: "Córdoba", region: "Andalusia", country: "Spain", coordinates: [-4.779, 37.888], landscape: "Mediterranean cropland", index: "04" },\n'
        '  { id: "argentina_pampas", name: "Argentine Pampas", region: "Pampas", country: "Argentina", coordinates: [-61.0, -35.0], landscape: "Temperate cropland", index: "05" },\n'
        '  { id: "southern_africa", name: "Southern Africa", region: "Interior South Africa", country: "South Africa", coordinates: [25.0, -27.0], landscape: "Semi-arid grassland", index: "06" }')
    path = "frontend/src/App.tsx"
    replace(path,
        '{ id: "spain_cordoba" as SiteId, name: "Córdoba", region: "Andalusia · Spain", total: 25, positive: 6, median: 1 }',
        '{ id: "spain_cordoba" as SiteId, name: "Córdoba", region: "Andalusia · Spain", total: 25, positive: 6, median: 1 },\n'
        '    { id: "argentina_pampas" as SiteId, name: "Argentine Pampas", region: "Pampas · Argentina", total: 27, positive: 11, median: 2 },\n'
        '    { id: "southern_africa" as SiteId, name: "Southern Africa", region: "Interior · South Africa", total: 21, positive: 15, median: 25 }')
    replace(path, '  return <div className="rs-editorial">',
        '  const totalEpisodes = findings.reduce((sum, item) => sum + item.total, 0);\n'
        '  const surfaceFirst = findings.reduce((sum, item) => sum + item.positive, 0);\n'
        '  return <div className="rs-editorial">')
    for a, b in [
        ("FOUR VERIFIED RESEARCH POINTS", "SIX VERIFIED RESEARCH POINTS"),
        ("Four places.<br/><em>Four different stories.</em>", "Six places.<br/><em>Six different stories.</em>"),
        ("four agricultural locations", "six selected agricultural model points"),
        ("<strong>47<span> / 110</span></strong>", "<strong>{surfaceFirst}<span> / {totalEpisodes}</span></strong>"),
        ("About 42.7% of these selected modeled events recovered at the surface before the root zone. This is a descriptive finding for four sites, not a global drought rate.",
         "About {(100 * surfaceFirst / totalEpisodes).toFixed(1)}% of these selected modeled events recovered at the surface before the root zone. This is a descriptive finding for six sites, not a global drought rate."),
        ("Goodwell’s nominal trend did not meet a basic four-site multiple-testing correction; these records need independent corroboration.",
         "Goodwell’s nominal trend fails a six-site multiple-testing correction. Southern Africa’s 25-day default median is highly threshold-sensitive; independent corroboration is essential."),
        ("conservative four-site multiple-testing threshold", "conservative six-site multiple-testing threshold"),
        ("Verified NASA datasets<small>4 historical site snapshots</small>", "Verified NASA datasets<small>6 historical site snapshots</small>"),
    ]:
        replace(path, a, b)
    replace("frontend/src/components/EarthGlobe.tsx", "04 RESEARCH LOCATIONS", '{String(sites.length).padStart(2, "0")} RESEARCH LOCATIONS')
    replace("frontend/src/components/GeoExplorer.tsx", "four historical NASA POWER research locations", "six historical NASA POWER research locations")
    replace("frontend/src/components/GeoExplorer.tsx", "<span>04 SITES</span>", '<span>{String(sites.length).padStart(2, "0")} SITES</span>')
    replace("frontend/src/components/ResearchConclusion.tsx",
        '<p className="rs-conclusion-plain">{trend === null ?',
        '{siteName === "Southern Africa" && <p className="rs-conclusion-plain">Threshold sensitivity: the median positive delay is 25 days under the default 40th-percentile recovery definition, but 3.5 days under a 50th-percentile definition with the same 20th-percentile drought threshold. This difference is not a robust agronomic indicator.</p>}\n'
        '        <p className="rs-conclusion-plain">{trend === null ?')

def update_tests() -> None:
    path = "tests/test_integration_real.py"
    replace(path,
        'SITES = {"us_sgp_stillwater", "us_sgp_goodwell", "australia_narrabri", "spain_cordoba"}',
        'SITES = {"us_sgp_stillwater", "us_sgp_goodwell", "australia_narrabri", "spain_cordoba", "argentina_pampas", "southern_africa"}')
    append(path, "def test_two_new_verifiable_study_points(", '''

@pytest.mark.parametrize("site,expected_events,expected_surface_first", [
    ("argentina_pampas", 27, 11),
    ("southern_africa", 21, 15),
])
def test_two_new_verifiable_study_points(site, expected_events, expected_surface_first):
    response = TestClient(app).get("/api/analyze", params={"mode": "site", "site": site})
    assert response.status_code == 200
    data = response.json()
    assert data["source"]["mode"] == "verified_prefetched_nasa"
    assert data["period"]["days"] == 16436
    assert len(data["events"]) == expected_events
    assert sum(e["status"] == "COMPLETE_SURFACE_FIRST" for e in data["events"]) == expected_surface_first
    assert data["ready_for_scientific_claims"] is False
''')
    path = "frontend/tests/app.spec.ts"
    replace(path, "FOUR VERIFIED RESEARCH POINTS", "SIX VERIFIED RESEARCH POINTS")
    replace(path, 'await expect(page.locator(".earth-location-strip button")).toHaveCount(4);',
                  'await expect(page.locator(".earth-location-strip button")).toHaveCount(6);')
    replace(path, 'await expect(page.locator(".map-site-list .map-site")).toHaveCount(4);',
                  'await expect(page.locator(".map-site-list .map-site")).toHaveCount(6);')
    replace(path, 'await expect(page.locator(".earth-location-strip button")).toHaveCount(4);',
                  'await expect(page.locator(".earth-location-strip button")).toHaveCount(6);')
    replace(path,
        'const narrabri = JSON.parse(readFileSync(new URL("./fixtures/narrabri.json", import.meta.url), "utf8"));',
        'const narrabri = JSON.parse(readFileSync(new URL("./fixtures/narrabri.json", import.meta.url), "utf8"));\n'
        'const argentina = JSON.parse(readFileSync(new URL("./fixtures/argentina.json", import.meta.url), "utf8"));\n'
        'const southernAfrica = JSON.parse(readFileSync(new URL("./fixtures/southern_africa.json", import.meta.url), "utf8"));')
    replace(path, '  australia_narrabri: narrabri',
        '  australia_narrabri: narrabri,\n  argentina_pampas: argentina,\n  southern_africa: southernAfrica')
    append(path, 'test("additional NASA locations expose distinct audited results', '''

test("additional NASA locations expose distinct audited results and threshold limitations", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start investigating" }).click();
  await page.locator("#site-select").selectOption("argentina_pampas");
  await expect(page.locator(".metric-value").first()).toHaveText("27");
  await expect(page.locator(".metric-value").nth(1)).toHaveText("11");
  await expect(page.locator(".rs-conclusion-lead")).toContainText("2 days");
  await page.locator("#site-select").selectOption("southern_africa");
  await expect(page.locator(".metric-value").first()).toHaveText("21");
  await expect(page.locator(".metric-value").nth(1)).toHaveText("15");
  await expect(page.locator(".rs-conclusion-lead")).toContainText("25 days");
  await expect(page.getByText(/the median positive delay is 25 days under the default/)).toBeVisible();
  await expect(page.getByText(/3.5 days under a 50th-percentile definition/)).toBeVisible();
});
''')

def update_documentation(reports: dict) -> None:
    a = reports["argentina_pampas"]
    s = reports["southern_africa"]
    report = f'''# ROOTSHADOW | Six-site historical NASA research extension

**Status: exploratory model screening, not field validation.**

Six point locations cover 1981-01-01 to 2025-12-31 (98,616 combined daily site-records). Ten original NASA JSON chunks were downloaded and verified for the new two locations. Along with the original 20 verified chunks, this gives 30 NASA source-response chunks. Both new processed CSV SHA-256 hashes match the previously independently checked research extraction, and the verified CSV manifests are preserved beside the gzip source files.

## Sources

- Argentine Pampas (-35.000, -61.000): {NEW_SITES["argentina_pampas"]["sha256"]}
- Interior South Africa (-27.000, 25.000): {NEW_SITES["southern_africa"]["sha256"]}

Each new site has 16,436 paired soil wetness records. The raw NASA JSON archives in docs/evidence retain the original downloaded responses. NASA POWER soil moisture is gridded land-model-derived data, **not observed root-zone moisture from field sensors**.

## Base-method findings

| Location | Episodes | Surface first | Median positive delay | Exploratory signed trend p |
| --- | ---: | ---: | ---: | ---: |
| Goodwell (USA) | 31 | 19 | 2 days | .01894 |
| Stillwater (USA) | 26 | 6 | 1 day | .1743 |
| Narrabri (Australia) | 28 | 16 | 1 day | .8816 |
| Córdoba (Spain) | 25 | 6 | 1 day | .8152 |
| Argentine Pampas (Argentina) | {NEW_SITES["argentina_pampas"]["episodes"]} | {NEW_SITES["argentina_pampas"]["surface_first"]} | 2 days | {a["lag_trend"]["p_value"]:.5f} |
| Southern Africa (South Africa) | {NEW_SITES["southern_africa"]["episodes"]} | {NEW_SITES["southern_africa"]["surface_first"]} | 25 days | {s["lag_trend"]["p_value"]:.5f} |

**Combined finding: 73 of 158 candidate drought episodes (46.2%) completed a surface-first recovery in these six selected gridded model points.** The count is not geographically representative.

## Threshold sensitivity and causal caution

Southern Africa's 25-day positive delay median is highly threshold-sensitive: holding the 20th-percentile root drought detection unchanged, a 50th-percentile recovery threshold produces a 3.5-day median among 14 events rather than 25 days among 15 events at the default 40th-percentile recovery cutoff. Across nine combinations of drought/recovery thresholds the median ranges 2–25 days. These results are **not** a validated 25-day agricultural water deficit.

All signed trends are exploratory. Goodwell's nominal p=.01894 fails a simple family-wise six-site cutoff of .05/6=.00833; time-series dependence, selection and multiple comparisons remain unresolved. No independent SMAP/GLDAS/ERA5-Land or in-situ validation has been performed.

## Reproduce

Run "python scripts/build_six_site_extension.py" from the repository root. The script checks fixed source SHA-256 digests, writes the compressed CSV snapshots, original NASA response archives, generates real API-driven Playwright fixtures, and updates the source and test code. Backend and frontend CI tests must pass before committing its output.
'''
    dest = ROOT / "docs/EXPLORATORY_6_SITE_EXTENSION.md"
    dest.write_text(report, encoding="utf-8")
    append("README.md", "EXPLORATORY_6_SITE_EXTENSION.md",
           "\n## Six-site verified research extension\n\nThe two additional historical NASA POWER point datasets (Argentine Pampas and South African interior) are packaged with original NASA response evidence; the six-site screening covers 98,616 point-days. See [the extension and sensitivity audit](docs/EXPLORATORY_6_SITE_EXTENSION.md). It remains exploratory and not a drought-warning or irrigation product.\n")

def main() -> None:
    for site, config in NEW_SITES.items():
        fetch_and_verify(site, config)
    sites, files = verify_manifests(ROOT / "data/gate0")
    if (sites, files) != (2, 10):
        raise ValueError(f"Source manifests not as expected: {sites} sites, {files} chunks")
    reports = {site: audit_new_site(site, config) for site, config in NEW_SITES.items()}
    update_app()
    update_tests()
    update_documentation(reports)
    print("VERIFIED 6-SITE EXTENSION: 73/158 screened surface-first episodes, 98,616 model site-days")
    print("Scientific release status: exploratory, not independently validated")

if __name__ == "__main__":
    main()
