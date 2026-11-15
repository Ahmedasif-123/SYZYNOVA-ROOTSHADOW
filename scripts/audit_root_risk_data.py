import argparse
import json
import math
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from rootshadow.recovery import seasonal_percentiles_fixed
from scripts.build_moisture_atlas import CORE, EXTRA, historical

HORIZON = 7
DRY_THRESHOLD = 0.40
TRAIN_END = "2014-12-31"
VALIDATION_END = "2020-12-31"
TEST_END = "2025-12-31"
BASELINE_START = 1991
BASELINE_END = 2014
SPLITS = ("train", "validation", "test")
REPORT = ROOT / "research_ai" / "data_readiness_report.json"


def valid_numeric(series, minimum, maximum):
    values = pd.to_numeric(series, errors="coerce").astype(float)
    return values.where(values.between(minimum, maximum))


def future_persistence(root_percentile, horizon=HORIZON, threshold=DRY_THRESHOLD):
    future = pd.concat([root_percentile.shift(-days) for days in range(1, horizon + 1)], axis=1)
    observed = future.notna().all(axis=1)
    target = future.lt(threshold).all(axis=1).astype("int8")
    return target, observed


def split_masks(index, horizon=HORIZON):
    shifted = index + pd.Timedelta(days=horizon)
    return {
        "train": (index <= pd.Timestamp(TRAIN_END)) & (shifted <= pd.Timestamp(TRAIN_END)),
        "validation": (index > pd.Timestamp(TRAIN_END)) & (index <= pd.Timestamp(VALIDATION_END)) & (shifted <= pd.Timestamp(VALIDATION_END)),
        "test": (index > pd.Timestamp(VALIDATION_END)) & (index <= pd.Timestamp(TEST_END)) & (shifted <= pd.Timestamp(TEST_END))
    }


def build_features(data):
    root = data["root_pct"]
    top = data["top_pct"]
    rain = data["rain_mm"]
    temperature = data["temperature_c"]
    ordinal = data.index.dayofyear.to_numpy(dtype=float)
    return pd.DataFrame({
        "root_percentile_today": root,
        "surface_percentile_today": top,
        "root_mean_7d": root.rolling(7, min_periods=7).mean(),
        "root_mean_14d": root.rolling(14, min_periods=14).mean(),
        "surface_mean_7d": top.rolling(7, min_periods=7).mean(),
        "root_change_7d": root - root.shift(7),
        "rain_total_past_7d_mm": rain.rolling(7, min_periods=7).sum(),
        "rain_total_past_14d_mm": rain.rolling(14, min_periods=14).sum(),
        "temperature_mean_past_7d_c": temperature.rolling(7, min_periods=7).mean(),
        "season_sin": np.sin(2 * np.pi * ordinal / 365.25),
        "season_cos": np.cos(2 * np.pi * ordinal / 365.25)
    }, index=data.index)


def data_for_site(site):
    frame = historical(site)
    rainfall_field = "PRECTOT" if "PRECTOT" in frame else "PRECTOTCORR" if "PRECTOTCORR" in frame else None
    if rainfall_field is None or "T2M" not in frame:
        raise ValueError(f"{site['id']}: daily precipitation or temperature variable missing")
    top = valid_numeric(frame["GWETTOP"], 0, 1)
    root = valid_numeric(frame["GWETROOT"], 0, 1)
    rain = valid_numeric(frame[rainfall_field], 0, 1000)
    temperature = valid_numeric(frame["T2M"], -100, 70)
    top_pct = seasonal_percentiles_fixed(top, BASELINE_START, BASELINE_END)
    root_pct = seasonal_percentiles_fixed(root, BASELINE_START, BASELINE_END)
    data = pd.DataFrame({
        "top_pct": top_pct,
        "root_pct": root_pct,
        "rain_mm": rain,
        "temperature_c": temperature
    }, index=frame.index)
    if len(data) != 16436 or not data.index.is_monotonic_increasing:
        raise ValueError(f"{site['id']}: invalid historical day coverage")
    return data


def summarize_site(site):
    data = data_for_site(site)
    features = build_features(data)
    target, future_observed = future_persistence(data["root_pct"])
    split = split_masks(data.index)
    complete_features = features.notna().all(axis=1)
    below_40 = data["root_pct"].lt(DRY_THRESHOLD)
    eligible = complete_features & future_observed & below_40
    counts = {}
    for key in SPLITS:
        mask = eligible & split[key]
        n = int(mask.sum())
        positive = int(target[mask].sum())
        counts[key] = {
            "examples": n,
            "persistent_next_7_days": positive,
            "nonpersistent_next_7_days": n - positive,
            "persistence_fraction": round(positive / n, 6) if n else None,
            "has_both_classes": positive > 0 and positive < n
        }
    missing = data.isna().sum().to_dict()
    return {
        "id": site["id"],
        "region": site.get("region", "Original research sites"),
        "country": site.get("country", "Unknown"),
        "source_days": len(data),
        "missing_input_days": {k: int(v) for k, v in missing.items()},
        "split": counts
    }


def audit(sites):
    if len(sites) != 97 or len({site["id"] for site in sites}) != 97:
        raise ValueError("Risk audit requires 97 distinct verified historical site locations")
    reports = []
    regions = defaultdict(lambda: {split: {"examples": 0, "persistent": 0} for split in SPLITS})
    totals = {split: {"examples": 0, "persistent": 0} for split in SPLITS}
    for number, site in enumerate(sites, 1):
        item = summarize_site(site)
        reports.append(item)
        for key in SPLITS:
            sample = item["split"][key]
            regions[item["region"]][key]["examples"] += sample["examples"]
            regions[item["region"]][key]["persistent"] += sample["persistent_next_7_days"]
            totals[key]["examples"] += sample["examples"]
            totals[key]["persistent"] += sample["persistent_next_7_days"]
        print(f"{number:02d}/97 {site['id']} | train={item['split']['train']['examples']} validation={item['split']['validation']['examples']} test={item['split']['test']['examples']}", flush=True)
    for split in SPLITS:
        total = totals[split]
        total["rate"] = round(total["persistent"] / total["examples"], 6) if total["examples"] else None
    for group in regions.values():
        for split in SPLITS:
            sample = group[split]
            sample["rate"] = round(sample["persistent"] / sample["examples"], 6) if sample["examples"] else None
    report = {
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "status": "DATA_READINESS_AUDIT_ONLY_NO_MODEL_TRAINED",
        "sources": "97 hashed NASA POWER/MERRA-2 model-derived historical grid points; not independent field measurements",
        "period": "1981-01-01/2025-12-31",
        "label": "Conditioned on current root-zone seasonal percentile below 0.40, predict whether the following 7 entire daily values remain strictly below 0.40",
        "reference_baseline": f"{BASELINE_START}-{BASELINE_END} (training-only historical reference; intentionally different from website baseline)",
        "horizon_days": HORIZON,
        "forecast_inputs": list(build_features(pd.DataFrame({
            "top_pct": pd.Series(np.ones(20), index=pd.date_range("2000-01-01", periods=20)),
            "root_pct": pd.Series(np.ones(20), index=pd.date_range("2000-01-01", periods=20)),
            "rain_mm": pd.Series(np.ones(20), index=pd.date_range("2000-01-01", periods=20)),
            "temperature_c": pd.Series(np.ones(20), index=pd.date_range("2000-01-01", periods=20))
        })).columns),
        "splits": {
            "train": f"1981-01-01 to {TRAIN_END}, excluding labels that extend into validation",
            "validation": f"2015-01-01 to {VALIDATION_END}, excluding labels that extend into test",
            "test": f"2021-01-01 to {TEST_END}, excluding targets beyond observed data"
        },
        "aggregate": totals,
        "by_region": dict(regions),
        "site_count": len(reports),
        "source_site_days": sum(v["source_days"] for v in reports),
        "sites_without_test_examples": [v["id"] for v in reports if not v["split"]["test"]["examples"]],
        "sites_without_both_test_classes": [v["id"] for v in reports if not v["split"]["test"]["has_both_classes"]],
        "site_records": reports,
        "limitations": [
            "All labels are computed from the same NASA/MERRA-2 model series, not independent farm outcomes.",
            "The point archive does not establish spatially exhaustive or field-scale risk.",
            "Recent local irrigation, soil characteristics, crop rooting depth, and future rainfall forecasts are unavailable.",
            "This audit cannot claim any predictive skill, calibrated probabilities, or decision benefit.",
            "Fixed baseline 1991-2014 makes the experiment independent of the subsequent validation and test periods; thresholds are not numerically interchangeable with the published 1991-2020 atlas baseline."
        ]
    }
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=REPORT)
    args = parser.parse_args()
    result = audit(CORE + EXTRA)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({
        "site_count": result["site_count"],
        "site_days": result["source_site_days"],
        "splits": result["aggregate"],
        "sites_without_test_examples": len(result["sites_without_test_examples"]),
        "sites_without_both_test_classes": len(result["sites_without_both_test_classes"]),
        "status": result["status"]
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
