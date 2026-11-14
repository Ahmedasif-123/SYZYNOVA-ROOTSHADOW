# ROOTSHADOW backend source and data audit — 14 November 2026

## Scope

Full review of the project Python acquisition and analytics paths, source and test files, JSON configuration, bundled verified NASA datasets, local FastAPI endpoints, and Azure Functions configuration. The frontend JavaScript, styling, and scientific statistical estimators have **not** been modified in this audit.

## Results

- **57/57 local automated tests pass** on the audit environment (Python 3.13), including ten new data-integrity tests.
- Python source compiles; JSON configuration parses; frontend JavaScript parses (syntax-only inspection, not browser deployment).
- All **20 original NASA POWER JSON responses**, **four historical CSVs**, and **four compressed deployment copies** match the verified manifest SHA-256 digests.
- Four independent backend reruns reproduce the pre-audit published recovery events, annual totals, slopes, p-values, and verdicts exactly. Each series has 16,436 daily rows and 45 complete years (1981–2025).
- FastAPI smoke tests include `/api/sites`, `/api/analyze?mode=site&site=us_sgp_goodwell`, synthetic mode, and rejection of invalid site requests.
- Live NASA requests are configured to prioritize `community=AG`, `GWETTOP,GWETROOT,PRECTOTCORR,T2M`, the profile previously **verified in the user's Mac terminal**. Network access from the audit environment is unavailable; real-time availability and an Azure deployment were **not** retested.

## Confirmed fixes in this audit

1. A successful HTTP 200 NASA JSON response is no longer accepted if it contains an incomplete date range, disjoint surface/root daily keys, nonnumeric/boolean/nonfinite wetness, or a wetness fraction outside [0, 1]. The same checks apply to verified-cache fallback before the data reaches the scientific engine.
2. Updated Azure Static Web Apps Python managed API setting from `python:3.10` to supported `python:3.11` because upstream Python 3.10 support has reached end of life. CI test runner now also uses Python 3.11.
3. Added regression tests for the above error conditions and prevention of caching malformed API responses.

## Reproduced exploratory findings (unchanged)

| Location | Detected droughts | Surface-first complete | Signed slope, days/decade | Kendall p | Verdict |
|---|---:|---:|---:|---:|---|
| Stillwater | 26 | 6 | -0.77 | 0.1743 | INCONCLUSIVE |
| Goodwell | 31 | 19 | -0.88 | 0.01894 | TREND_SUPPORTED_EXPLORATORY |
| Narrabri | 28 | 16 | 0.00 | 0.88164 | NO_SIGNIFICANT_TREND |
| Córdoba | 25 | 6 | 0.00 | 0.8152 | INCONCLUSIVE |

Goodwell's exploratory event p-value does not pass a four-site Bonferroni criterion (0.0125). The result is a **negative signed recovery-order** trend, not evidence of prolonged root-zone recovery. Annual mismatch trends, dependence, rounding, and threshold choices remain important limitations. No independent GLDAS, SMAP, or station comparison has been completed. The underlying soil-wetness data are MERRA-2 model-derived, not direct root-zone satellite measurements.

## Deployment boundaries

- **Not verified:** successful live Azure managed Functions build, compatible native SciPy/NumPy wheels under Azure, DNS/network reachability in cloud, long-running request limits, concurrent users, and public production response times. These require an actual hosted deployment, not just code tests.
- **Not verified:** active Google Earth Engine project or independent ground/satellite corroboration; optional export script is scaffold only.
- Both hosted and local APIs are anonymous read-only endpoints. A public deployment may require rate limiting and request execution limits before wider use.
- Existing source datasets and scientific code were not silently replaced. No AI library or extra statistical model was added because none is demonstrably necessary for this phase.

## Safe freeze

The code is **locally stabilized and regression-tested**, not mathematically proven bug-free or cloud-certified. Keep this source version fixed for frontend integration except to address a reproducible integration or deployment issue. Preserve real/synthetic provenance flags and never treat the exploratory program verdict as scientific proof.
