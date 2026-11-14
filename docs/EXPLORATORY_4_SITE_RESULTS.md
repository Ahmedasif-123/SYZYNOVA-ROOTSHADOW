# ROOTSHADOW — Four-location NASA POWER screening

**Team:** SYZYNOVA (Muhammad Ahmed and Somaya Bakir)  
**Recorded:** 14 November 2026  
**Status:** Reproducible exploratory screening, **not** independent scientific corroboration or proof of a climatic trend.

## Data and provenance

- NASA POWER daily point API; successful `community=AG` requests returned `GWETTOP`, `GWETROOT`, `PRECTOTCORR`, and `T2M`.
- Four predefined locations: Stillwater (US), Goodwell (US), Narrabri (Australia), Córdoba (Spain).
- 1 January 1981–31 December 2025 (16,436 daily rows per site; 65,744 site-days total).
- All 20 original JSON responses passed manifest SHA-256 verification. All four processed CSV hashes passed. Every available daily value in the processed CSV was independently matched against the original JSON for all four parameters after mapping `PRECTOTCORR` to the CSV column `PRECTOT`.
- All 65,744 days had paired surface and root-zone wetness records. No missing values in the four processed tables.
- The underlying wetness variables are **gridded, model-derived NASA POWER/MERRA-2 estimates**, not independent measurements of root-zone moisture. Do not describe these as NASA satellite observations of roots.

## Methods

- Fixed 1991–2020 seasonal baseline with ±15 calendar-day neighborhood and midrank percentiles.
- Root-zone drought threshold ≤20th percentile for ≥30 days (minor interruptions bridged by the current implementation).
- First 7-day sustained recovery to ≥40th percentile for both surface and root layers.
- Signed difference: date of root recovery minus date of surface recovery; **positive means surface first, negative means root first**.
- Exploratory event-level Theil–Sen slope and Kendall association; secondary annual mismatch trend; linear-Gaussian surrogate calibrated using 1991–2020 data; nine-setting sensitivity grid.
- Program's audit categories are custom decision rules, not scientific standards.

## Results

| Location | Drought episodes | Completed surface-first | Median surface-first lag (days) | Signed gap slope (days/decade) | Event-level Kendall p | Program verdict |
|---|---:|---:|---:|---:|---:|---|
| Stillwater, Oklahoma | 26 | 6 | 1.0 | -0.77 | 0.1743 | INCONCLUSIVE |
| Goodwell, Oklahoma | 31 | 19 | 2.0 | -0.88 | 0.0189 | TREND_SUPPORTED_EXPLORATORY |
| Narrabri, Australia | 28 | 16 | 1.0 | 0.00 | 0.8816 | NO_SIGNIFICANT_TREND |
| Córdoba, Spain | 25 | 6 | 1.0 | 0.00 | 0.8152 | INCONCLUSIVE |

### Interpretation

- **Goodwell:** 31 episodes, 19 completed surface-first recoveries; median delay 2 days. Signed recovery-order slope −0.88 days/decade (p=0.01894). The positive-delay-only trend also points downward (Kendall p≈0.0273), but its Theil–Sen 95% confidence interval touches zero. A separate annual mismatch trend has p≈0.0603. Both tests are exploratory, and the signed slope also includes root-first cases (−14 and −79 days in 2014/2015).
- **Stillwater:** 26 episodes, only 6 completed surface-first recoveries; event-level p=0.1743, inconclusive.
- **Narrabri:** 28 episodes, 16 completed surface-first; event-level p=0.88164, no detectable trend under tested settings.
- **Córdoba:** 25 episodes, only 6 completed surface-first; event-level p=0.8152, inconclusive.

We inspected four locations. A conservative family-wise p threshold 0.05/4=0.0125 would not be met by Goodwell's event-level p=0.01894; this simple adjustment does **not** resolve dependencies, adaptive selection, or model-calibration limitations. The current Hamed–Rao correction may also become anti-conservative when its reported variance factor falls below 1 (Goodwell: 0.29). These outputs must **not** be presented as calibrated statistically significant climate evidence.

### Scientific caveats

1. Surface and root wetness share land-model dynamics; mere delay is expected. Surrogate residual resampling i.i.d. does not preserve the full physical model's autocorrelation or nonlinear processes.
2. NASA POWER soil-wetness values are coarsely rounded; many detected complete delays are 1–2 days, potentially sensitive to rounding, ties, and threshold choice.
3. Event-level Kendall tests do not correct temporal dependence, and event counts/dates depend on selected thresholds. Episodes with no surface recovery are not evidence of zero delay.
4. The 45-year forcing/assimilation history and changed model inputs can introduce spurious steps or trends; no independent SMAP/GLDAS/USCRN corroboration has yet been performed.
5. These four point series do not establish regional spatial trends or operational drought-risk forecasts.

## Responsible project claim

**Supported:** ROOTSHADOW downloads and authenticates real NASA POWER data, screens multi-decadal surface/root recovery order across four locations, and exposes uncertainty rather than asserting that all recoveries behave alike.

**Not supported:** “Root-zone drought recovery is getting slower” or “Goodwell has a confirmed climatic trend.”

## Reproduction

```bash
python scripts/gate0_fetch.py --site us_sgp_stillwater --start-year 1981 --end-year 2025
python scripts/gate0_fetch.py --site us_sgp_goodwell --start-year 1981 --end-year 2025
python scripts/gate0_fetch.py --site australia_narrabri --start-year 1981 --end-year 2025
python scripts/gate0_fetch.py --site spain_cordoba --start-year 1981 --end-year 2025
python scripts/gate0_fetch.py --verify
python scripts/gate1_screen.py data/gate0/processed/us_sgp_goodwell_1981_2025.csv --full --output data/gate1/goodwell_audit.json
```

The original verified NASA JSON files and full computational results are retained in the accompanying evidence archive, **not** committed into the public source repository. Data origin: https://power.larc.nasa.gov/ ; https://power.larc.nasa.gov/docs/services/api/temporal/daily/ .
