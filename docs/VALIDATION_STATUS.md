# ROOTSHADOW validation register

**Updated 14 November 2026.** Separate software test status, authentic data acquisition, and scientific inference.

| Item | Current status | Evidence |
|---|---|---|
| Python/API/UI integration | Local software tests passed (41/41 before data acquisition); cloud deployment not verified | `tests/`, `.github/workflows/tests.yml` |
| NASA POWER acquisition | **Verified on four sites** from 1981–2025; `community=AG` accepted after `HY` returned HTTP 422 | 20 raw NASA responses, 4 manifests and CSVs, reviewed source ZIP |
| Source integrity | 20/20 raw JSON SHA-256 hashes passed, 4/4 processed CSV hashes passed | Four manifests; 65,744 rows compared value-by-value with raw JSON |
| Paired data coverage | 100% of 16,436 days per site for `GWETTOP` and `GWETROOT` | NASA CSVs and JSON responses |
| Seasonal drought/recovery detection | Tested on authentic four-site NASA model-derived data; thresholds and rounding sensitivities remain | `scripts/gate1_screen.py`, `api/rootshadow/recovery.py` |
| Exploratory multi-decade trends | Goodwell's signed recovery gap shows p≈0.01894, negative slope; **does not pass a conservative four-site p<0.0125 threshold**; other sites show no robust support | `docs/EXPLORATORY_4_SITE_RESULTS.md` |
| Surrogate normal-lag calibration | Descriptive model only; unvalidated i.i.d. residual resampling and simplified physics | `api/rootshadow/null_model.py` |
| Autocorrelation-corrected annual tests | Implemented, but potentially anti-conservative when estimated variance factor <1; not confirmatory | `api/rootshadow/trend.py` |
| Independent scientific corroboration | Not performed (SMAP L4, GLDAS, NOAA USCRN, MODIS) | `scripts/extract_gee_corroboration.py` is only an optional acquisition scaffold |
| Live application deployment | Not verified | Azure workflow remains manual pending cloud setup |
| Drought warning / proven climate trend | **NOT established** | No independent field validation, incomplete sensitivity and multi-testing control |

The output represents NASA POWER **MERRA-2 model-derived gridded** soil wetness. Surface and root series share the modeling system; a lag by itself is not independent evidence of unexpected ecological response. The software and statistical tests are exploratory, and the project must not be called an operational drought warning system.

All source data, original NASA URLs, processed SHA-256 checksums and full per-site JSON reports are preserved in the user-supplied evidence archive. The GitHub repository contains only the compact comparative report to avoid committing large historical raw datasets.

See [`EXPLORATORY_4_SITE_RESULTS.md`](EXPLORATORY_4_SITE_RESULTS.md).
