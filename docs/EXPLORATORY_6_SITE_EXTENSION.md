# ROOTSHADOW | Six-site historical NASA research extension

**Status: exploratory model screening, not field validation.**

Six point locations cover 1981-01-01 to 2025-12-31 (98,616 combined daily site-records). Ten original NASA JSON chunks were downloaded and verified for the new two locations. Along with the original 20 verified chunks, this gives 30 NASA source-response chunks. Both new processed CSV SHA-256 hashes match the previously independently checked research extraction, and the verified CSV manifests are preserved beside the gzip source files.

## Sources

- Argentine Pampas (-35.000, -61.000): 279f7ca593feca9b3497b29c0ee430ee247ba09b9a1a61c6ffe6caf7ca694a1b
- Interior South Africa (-27.000, 25.000): cd7298a8d1103f5f091846807f5e3966c8d082492ec7ac9e7b14fd33a252ad09

Each new site has 16,436 paired soil wetness records. The raw NASA JSON archives in docs/evidence retain the original downloaded responses. NASA POWER soil moisture is gridded land-model-derived data, **not observed root-zone moisture from field sensors**.

## Base-method findings

| Location | Episodes | Surface first | Median positive delay | Exploratory signed trend p |
| --- | ---: | ---: | ---: | ---: |
| Goodwell (USA) | 31 | 19 | 2 days | .01894 |
| Stillwater (USA) | 26 | 6 | 1 day | .1743 |
| Narrabri (Australia) | 28 | 16 | 1 day | .8816 |
| Córdoba (Spain) | 25 | 6 | 1 day | .8152 |
| Argentine Pampas (Argentina) | 27 | 11 | 2 days | 0.37173 |
| Southern Africa (South Africa) | 21 | 15 | 25 days | 0.83548 |

**Combined finding: 73 of 158 candidate drought episodes (46.2%) completed a surface-first recovery in these six selected gridded model points.** The count is not geographically representative.

## Threshold sensitivity and causal caution

Southern Africa's 25-day positive delay median is highly threshold-sensitive: holding the 20th-percentile root drought detection unchanged, a 50th-percentile recovery threshold produces a 3.5-day median among 14 events rather than 25 days among 15 events at the default 40th-percentile recovery cutoff. Across nine combinations of drought/recovery thresholds the median ranges 2–25 days. These results are **not** a validated 25-day agricultural water deficit.

All signed trends are exploratory. Goodwell's nominal p=.01894 fails a simple family-wise six-site cutoff of .05/6=.00833; time-series dependence, selection and multiple comparisons remain unresolved. No independent SMAP/GLDAS/ERA5-Land or in-situ validation has been performed.

## Reproduce

Run "python scripts/build_six_site_extension.py" from the repository root. The script checks fixed source SHA-256 digests, writes the compressed CSV snapshots, original NASA response archives, generates real API-driven Playwright fixtures, and updates the source and test code. Backend and frontend CI tests must pass before committing its output.
