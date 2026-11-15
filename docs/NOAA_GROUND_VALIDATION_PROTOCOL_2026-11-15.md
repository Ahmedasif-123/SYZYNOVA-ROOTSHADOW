# ROOTSHADOW: independent NOAA soil-probe pilot

Status: **an experiment, not a claim of validated farm-level root-zone monitoring**.

## Scientific objective

Test whether ROOTSHADOW's model-derived surface and root-zone dryness screens correspond to separate, ground-based measurements at co-located Oklahoma US Climate Reference Network stations.

Predefined model study points:
- Goodwell, Oklahoma: `us_sgp_goodwell`
- Stillwater, Oklahoma: `us_sgp_stillwater`

Ground stations: NOAA USCRN Goodwell 2 E, Goodwell 2 SE, Stillwater 2 W, Stillwater 5 WNW. Each measures volumetric moisture at 5, 10, 20, 50, and 100 cm where technically possible.

## Protocol, specified before accessing results

1. Retrieve NOAA **daily01** quality-controlled soil moisture values for 2013–2025, recording SHA-256 hashes of each station-year response and any missing station-years.
2. Require all five depth values to compute a 0–100 cm approximate profile with thickness weights `[0.075, 0.075, 0.20, 0.40, 0.25]`. The uppermost 5-cm reading is independently retained as a surface proxy. Do not interpolate missing depth measurements.
3. Pair field and NASA daily dates, noting NOAA uses local-standard-time days while NASA uses UTC days.
4. Compute **separate** percentile climatologies for model surface, model root, probe surface, and probe root from the **fixed 2013–2021** seasonal baseline (±15 calendar days, with midranks for ties).
5. Evaluate only untouched **2022–2025** test dates where all four percentile series have complete observations.
6. Define observed deep dryness as the ground 0–100 cm profile's percentile **< 40**. Compare model root **< 40** and surface-only **< 40**, reporting all confusion counts, recall, precision, false-positive rate, specificity and balanced accuracy.
7. Compare modeled mismatch (model surface ≥40, model root <40) to ground-observed mismatch (5 cm probe ≥40, 0–100 cm integrated probe profile <40), reporting all counts and errors.
8. Report Spearman correlation of paired percentile ranks, station-gridpoint distance, pair availability, seasonal distribution and failure cases. Do not tune the threshold, climatology, or station inclusion to produce a positive result.
9. Preserve original 1981–2025 site analysis and all original 97 NASA records, whose published baseline is 1991–2020. The separate reference periods must not be compared as identical absolute ranks.

## Interpreting a result

Measured probes can challenge the model-derived claim. A positive result on one or more USCRN stations is **local pilot evidence** only. It cannot validate the broader 97-point atlas, validate Gulf irrigation estimates, establish farm-scale decisions, or imply an AI predictor.

If results are poor, report them. If no probes have sufficient valid overlap, the workflow must fail rather than fabricate success.

References:
- https://www.ncei.noaa.gov/access/crn/products.html
- https://www.ncei.noaa.gov/pub/data/uscrn/products/daily01/README.txt
- https://www.ncei.noaa.gov/pub/data/uscrn/products/daily01/HEADERS.txt
- https://power.larc.nasa.gov/docs/methodology/data/sources_hydrology/
