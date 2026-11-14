# ROOTSHADOW validation register

As of 14 November 2026, the local project has a reproducible synthetic demonstration, a Gate 0 NASA POWER acquisition script, and an exploratory Gate 1 screening module. The test suite passes 36 of 36 local automated tests in the received Claude archive. These are software tests, not proof of a real drought event. The following statements are deliberately separate.

| Item | Status | Evidence |
|---|---|---|
| Fixed-baseline same-threshold recovery lag in API | Implemented, tested on synthetic and noise series | `api/rootshadow/recovery.py`, `tests/test_engine.py`, `tests/test_gate1.py` |
| Autocorrelation-corrected trend (Hamed–Rao) | Implemented; reduces but does not remove false positives at n=45 | `api/rootshadow/trend.py`; test compares with naive MK |
| Normal-lag surrogate null | Implemented as linear-Gaussian descriptive calibration, not a proof | `api/rootshadow/null_model.py` |
| Evidence Auditor / 9-setting sensitivity | Implemented; thresholds are proposals | `api/rootshadow/analysis.py` |
| Scientific anomaly findings | Not yet validated | A live/prefetched NASA run and independent review are required |
| NASA API integration | Implemented (PRECTOT (HY) with no-precipitation fallback, 10-year chunks); not live-tested in the authoring environment | `api/rootshadow/data.py` |
| SMAP / GLDAS / NOAA station / MODIS corroboration | Not implemented in the app (GEE extraction script exists) | `scripts/extract_gee_corroboration.py` |
| SHA-256 integrity control | Implemented and tested | `tests/test_data.py`, `tests/test_engine.py` |
| Azure deployment files | Prepared, not deployed | `api/`, `.github/workflows/azure-static-web-apps.yml` |
| Submission readiness | In progress | Case-study validation, cloud deployment and presentation evidence remain open |

The code must not be described as production-secure or as an operational agricultural warning system.

Update after independent integration review (14 November 2026): Annual mismatch days now count in the calendar year in which they occur, even when a recovery period crosses New Year; additional regression tests cover that case. The surrogate lag-slope comparison is centered on the empirical surrogate median. These changes do not establish the null model’s validity. The Azure deployment workflow is intentionally manual until cloud setup is complete.
