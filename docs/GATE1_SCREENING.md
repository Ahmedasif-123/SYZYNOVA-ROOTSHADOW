# Gate 1 — Fixed-climatology recovery screening

This stage generates *candidate* events from real NASA POWER CSV files, not confirmed discoveries.

Run after a successful Gate 0 acquisition and manifest verification:

```bash
python scripts/gate1_screen.py data/gate0/processed/us_sgp_stillwater_1981_2025.csv --output data/gate1/stillwater_screen.json
```

The script:

1. Constructs 1991–2020 seasonal percentiles with a ±15-day circular calendar window, mapping leap days consistently.
2. Establishes a preceding root-zone drought when the root-zone percentile is ≤20 for at least 30 consecutive days.
3. Determines each layer's first sustained recovery (≥40th percentile for at least seven consecutive days) using **the same percentile threshold**.
4. Reports complete recovery lags, root-first or simultaneous recovery, cases not recovering at the surface, and right-censored or drought-interrupted delays. Censored events have *lower bounds*, not invented complete lags.
5. Counts observed mismatch days between surface and root recovery.
6. Evaluates whether there are enough completed events for a *descriptive*, not inferential, comparison against historical lag values.

The same engine now runs in the API (`api/rootshadow/analysis.py`); `--full` adds the trend, surrogate-null and sensitivity audit. It is still single-site screening. It does **not** perform autocorrelation-corrected Mann–Kendall testing, validated surrogate-null comparison, independent NOAA station verification, GLDAS corroboration, or a multiple-comparison-controlled regional trend assessment. Those remain necessary before claiming a statistically unusual lag or significant historical trend.

No program should classify a specific historical event as scientifically corroborated until original data, expected baseline behavior, sensitivity, and independent corroboration have been reviewed.
