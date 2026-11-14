# Gate 0 — NASA POWER acquisition

## Verified documentation

NASA POWER daily endpoint: `https://power.larc.nasa.gov/api/temporal/daily/point`

NASA POWER hydrology docs: `https://power.larc.nasa.gov/docs/methodology/data/sources_hydrology/`

Parameters: `GWETTOP`, `GWETROOT`, `PRECTOT`, and `T2M` with `community=HY`, `time-standard=UTC`. Raw soil wetness is fractional and model-derived; this is not in-situ root-zone measurement.

## Run

```bash
python scripts/gate0_fetch.py --site us_oklahoma --start-year 1981 --end-year 2025
python scripts/gate0_fetch.py --site all --start-year 1981 --end-year 2025
python scripts/gate0_fetch.py --verify
```

Run from the project root with `requests` installed. The first request fetches the preselected US Oklahoma location. Each request retains the unmodified NASA JSON response, a SHA-256 fingerprint, the exact API URL, and retrieval time. The program also writes a daily CSV for downstream analysis. It does not classify any scientific finding.

Sites are preselected candidate and comparison points, not confirmed drought events or validated negative controls. Selection, land cover, and ground-station representativeness must be evaluated before analysis.

A full-year series ending in 2025 is selected to avoid treating partial 2026 results as full-year trend statistics.

## Status and blockers

On 14 November 2026, the code execution sandbox could not resolve `power.larc.nasa.gov`. No live NASA API payload was retrieved here, so no raw-data hashes or validated historical event can honestly be reported yet. The acquisition program and mock-response tests are ready for an environment with internet access.

Do not substitute the synthetic demonstration dataset as real NASA evidence. Do not report a trend or significance without running the full scientific audit.

## Scientific gates

1. Confirm retrieved data semantics, missing-value flags, dates and units.
2. Use 1991–2020 for fixed seasonal percentile climatology.
3. Define prior drought using root-zone percentile at or below 20 for at least 30 consecutive days, then test persistence sensitivity.
4. Use the same percentile recovery threshold for surface and root zone; assess 7/14/30-day sustained recovery definitions.
5. Compare recovery delays with historical normal behavior and appropriately formulated null or surrogate controls; document precisely what null is being tested.
6. Declare a preselected comparison site a negative control only if its role is independently justified; do not force negative controls to pass.
7. Report event frequency and trend only when suitable tests account for autocorrelation, sample size, zero inflation and multiple comparison effects.
8. Move to SMAP and verified NOAA station data if a POWER case is credible; GLDAS is lower priority.
