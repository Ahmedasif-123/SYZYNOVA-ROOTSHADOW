# Gemini's satellite-data proposal — integrated review

Reviewed on 14 November 2026. This document records code decisions; no live historical result has been validated yet.

## Accurate and useful recommendations

- SMAP L4 v008 Earth Engine ID: `NASA/SMAP/SPL4SMGP/008`, with `sm_surface_wetness` and `sm_rootzone_wetness` for model-derived 0–5 cm and 0–100 cm wetness.
- GLDAS-2.1 Noah ID: `NASA/GLDAS/V021/NOAH/G025/T3H`. Layer variables `SoilMoi0_10cm_inst`, `SoilMoi10_40cm_inst`, and `SoilMoi40_100cm_inst` can be summed to obtain 0–100 cm water mass per square metre. This is not the same physical variable as POWER wetness fraction. Compare within-product seasonal percentiles rather than raw values. GLDAS also has a `RootMoist_inst` band, whose definitions must be checked before substitution.
- MODIS MOD13A2 Collection 6.1: `MODIS/061/MOD13A2` for quality-filtered EVI/NDVI as additional ecological context, not direct proof of root-zone recovery.
- Store traceable data-export parameters, date coverage and SHA-256 checksums, and label model output appropriately.
- Retain censored recovery episodes rather than systematically dropping the longest unresolved delays.

## Corrections to the proposed scripts

1. The original single NASA POWER request for 1981–2026 is replaced with tested decade chunks. This reduces request size and preserves original responses per chunk.
2. NASA's HY daily `PRECTOT` is the parameter used in the tested downloader; do not silently replace it with `PRECTOTCORR` without checking community metadata and whether the endpoint serves it.
3. Instead of requesting nearly a decade of GEE daily images in one huge synchronous `getInfo()` operation, the revised optional Earth Engine script uses monthly batches and a narrow default period. The script requires Earth Engine authentication and a registered Google Cloud project. Its live execution is not yet verified.
4. The proposed 25 km circular spatial buffer is an approximation, not the native MERRA-2 cell footprint. Spatial comparison requires more careful aggregation and coordinates.
5. Stillwater and Goodwell USCRN locations are candidates for independent station comparison, not guaranteed available 5/100 cm records over every proposed drought window.
6. Munich and the California Central Valley are *proposed comparison/confounded sites*, not verified true negative controls. A detection there is a result to investigate, not a reason to reject the algorithm automatically.
7. A fixed 75th/90th percentile of a site's own historic event lags is a descriptive threshold, not a calibrated statistical test. Historical sample sizes must be reported; no anomaly significance may be claimed without a validated reference null.
8. For right-censored delays, report an observed lower bound, not a completed duration or exact mean. Drought recurrence is labeled separately from administrative censoring.
9. The historical trend, multiple-comparison handling, and model-inherent lag null remain scientific work that is not implemented by the initial detector.

## Running the scripts

From the extracted repository root:

```bash
python -m pip install -r requirements.txt
python -m pytest -q
python scripts/gate0_fetch.py --site us_sgp_stillwater --start-year 1981 --end-year 2025
python scripts/gate0_fetch.py --verify
python scripts/gate1_screen.py data/gate0/processed/us_sgp_stillwater_1981_2025.csv --output data/gate1/stillwater_screen.json
```

If and only if Google Earth Engine is activated:

```bash
python -m pip install earthengine-api
python -c "import ee; ee.Authenticate()"
python scripts/extract_gee_corroboration.py --dataset smap --site stillwater --start 2022-01-01 --end 2023-01-01 --project YOUR_CLOUD_PROJECT_ID
```

The Earth Engine output is a **derived export**. Its SHA-256 manifest verifies exported CSV bytes, not the untouched NASA source granules. The NASA POWER downloader, in contrast, hashes original received JSON bytes.

## Current scientific status

Gate 0 and Gate 1 code have passed offline unit tests. The network-restricted runtime could not contact NASA POWER and does not have an authorized Earth Engine project. Therefore *no actual historical event, trend, confidence interval, negative-control success, or cross-model agreement has yet been established.*

Authoritative references:

- https://power.larc.nasa.gov/docs/methodology/data/sources_hydrology/
- https://power.larc.nasa.gov/docs/services/api/temporal/daily/
- https://developers.google.com/earth-engine/datasets/catalog/NASA_SMAP_SPL4SMGP_008
- https://developers.google.com/earth-engine/datasets/catalog/NASA_GLDAS_V021_NOAH_G025_T3H
- https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD13A2
- https://www.ncei.noaa.gov/access/crn/products.html
