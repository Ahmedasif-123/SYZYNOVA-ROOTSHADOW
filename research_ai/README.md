# ROOTSHADOW root-zone risk research

This is an isolated pre-model research audit. It does not modify the current frontend, original drought-recovery calculations, NASA snapshots, or production deployments.

The proposed prediction target is: conditional on the most recent root-zone seasonal percentile being below 40, will all of the following seven daily model-derived values remain below 40?

This is a *model-defined persistence outcome*, not farm water stress, crop loss, or a calibrated early-warning product.

The audit reads all 97 source-verified historical CSVs and evaluates missingness, target prevalence, chronology, and basic input availability. It trains **no** predictive model and publishes **no** forecast.

The reference period is restricted to 1991–2014, before the 2015–2020 validation and 2021–2025 test sets. This differs from the published 1991–2020 website reference and must be kept separate.

For a meaningful AI claim, the next phase must train simple baselines and at least one learned model, compare them on untouched 2021–2025 data, evaluate calibration and performance by location/region, and seek independent field or satellite validation.

Run `python -m pytest tests/test_root_risk_data.py -q` and `python -m scripts.audit_root_risk_data`. The action stores the resulting JSON audit as a workflow artifact, not a published user-facing prediction.
