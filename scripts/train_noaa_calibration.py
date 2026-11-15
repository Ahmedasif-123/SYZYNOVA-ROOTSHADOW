import argparse
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import requests
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, log_loss, roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from rootshadow.recovery import seasonal_percentiles_fixed
from scripts.build_moisture_atlas import CORE, historical
from scripts.validate_noaa_probe import STATIONS, download_noaa_station, root_profile, binary_metrics

REFERENCE_START = 2013
TRAIN_END = 2019
VALIDATION_END = 2021
TEST_END = 2025
TARGET_PERCENTILE = 0.4
FEATURE_COLUMNS = [
    "root_rank", "surface_rank", "root_mean_7", "root_change_7",
    "surface_mean_7", "rain_past_7_mm", "rain_past_14_mm",
    "temp_mean_7_c", "season_sin", "season_cos"
]
OUT = ROOT / "research_ai" / "NOAA_GROUND_CALIBRATION_REPORT.json"
MODEL_OUT = ROOT / "research_ai" / "noaa_calibration_model.joblib"


def valid(series, lower, upper):
    values = pd.to_numeric(series, errors="coerce").astype(float)
    return values.where(values.between(lower, upper))


def seasonal_rank(series):
    return seasonal_percentiles_fixed(
        series, baseline_start=REFERENCE_START, baseline_end=TRAIN_END,
        window=15, min_reference=60
    )


def build_features(model):
    root = seasonal_rank(valid(model["GWETROOT"], 0, 1))
    surface = seasonal_rank(valid(model["GWETTOP"], 0, 1))
    rain_column = "PRECTOT" if "PRECTOT" in model.columns else "PRECTOTCORR"
    rain = valid(model[rain_column], 0, 1000)
    temp = valid(model["T2M"], -100, 70)
    seasonal = model.index.dayofyear.to_numpy(dtype=float)
    features = pd.DataFrame({
        "root_rank": root,
        "surface_rank": surface,
        "root_mean_7": root.rolling(7, min_periods=7).mean(),
        "root_change_7": root - root.shift(7),
        "surface_mean_7": surface.rolling(7, min_periods=7).mean(),
        "rain_past_7_mm": rain.rolling(7, min_periods=7).sum(),
        "rain_past_14_mm": rain.rolling(14, min_periods=14).sum(),
        "temp_mean_7_c": temp.rolling(7, min_periods=7).mean(),
        "season_sin": np.sin(2 * np.pi * seasonal / 365.25),
        "season_cos": np.cos(2 * np.pi * seasonal / 365.25)
    }, index=model.index)
    return features


def station_frame(station, model_id, session):
    measurements, manifests, errors = download_noaa_station(station, session)
    model_site = next((site for site in CORE if site["id"] == model_id), None)
    if model_site is None:
        raise ValueError("Unknown canonical model site")
    nasa = historical(model_site).loc[f"{REFERENCE_START}-01-01":f"{TEST_END}-12-31"]
    features = build_features(nasa)
    probe = root_profile(measurements).reindex(nasa.index)
    ground_rank = seasonal_rank(probe)
    frame = features.copy()
    frame["observed_root_rank"] = ground_rank
    frame["ground_dry"] = (ground_rank < TARGET_PERCENTILE).astype(float).where(ground_rank.notna())
    frame = frame.dropna(subset=FEATURE_COLUMNS + ["ground_dry"])
    frame["station"] = station
    frame["model_site"] = model_id
    frame["year"] = frame.index.year
    if len(frame.loc[frame.year <= TRAIN_END]) < 150 or len(frame.loc[frame.year > VALIDATION_END]) < 150:
        raise ValueError("Insufficient observed training or independent holdout days")
    return frame, manifests, errors


def splits(frame):
    masks = {
        "train": frame.year <= TRAIN_END,
        "validation": (frame.year > TRAIN_END) & (frame.year <= VALIDATION_END),
        "test": (frame.year > VALIDATION_END) & (frame.year <= TEST_END)
    }
    if any(int(mask.sum()) == 0 for mask in masks.values()):
        raise ValueError("An evaluation split is missing complete field measurements")
    return masks


def diagnostics(y, p):
    truth = np.asarray(y, dtype=int)
    probabilities = np.clip(np.asarray(p, dtype=float), 1e-6, 1 - 1e-6)
    if len(truth) != len(probabilities) or len(truth) == 0:
        raise ValueError("No paired observed labels for diagnostics")
    hard = probabilities >= 0.5
    classification = binary_metrics(truth.astype(bool), hard)
    ece = 0.0
    calibration = []
    for index in range(10):
        lower = index / 10
        upper = (index + 1) / 10
        select = (probabilities >= lower) & (probabilities < upper if index < 9 else probabilities <= upper)
        n = int(select.sum())
        if n:
            confidence = float(probabilities[select].mean())
            observed = float(truth[select].mean())
            ece += n / len(truth) * abs(confidence - observed)
            calibration.append({"probability_bin": index, "count": n, "predicted_probability": round(confidence, 5), "observed_frequency": round(observed, 5)})
    return {
        "count": len(truth),
        "observed_dry_days": int(truth.sum()),
        "observed_dry_frequency": round(float(truth.mean()), 5),
        "brier": round(float(brier_score_loss(truth, probabilities)), 6),
        "log_loss": round(float(log_loss(truth, probabilities, labels=[0, 1])), 6),
        "roc_auc": round(float(roc_auc_score(truth, probabilities)), 5) if len(np.unique(truth)) == 2 else None,
        "average_precision": round(float(average_precision_score(truth, probabilities)), 5) if len(np.unique(truth)) == 2 else None,
        "expected_calibration_error": round(float(ece), 5),
        "at_probability_0_5": classification,
        "calibration_bins": calibration
    }


def raw_screen(y, root_rank):
    return binary_metrics(np.asarray(y, dtype=bool), np.asarray(root_rank < TARGET_PERCENTILE, dtype=bool))


def train_and_test(station_frames):
    full = pd.concat(station_frames).sort_index()
    masks = splits(full)
    train, validation, test = (full.loc[masks[name]] for name in ("train", "validation", "test"))
    if len(train) < 1000 or len(validation) < 500 or len(test) < 500:
        raise ValueError("Insufficient complete observed NOAA training, validation or test records")
    if any(len(np.unique(split.ground_dry)) < 2 for split in (train, validation, test)):
        raise ValueError("At least one split lacks both ground-observed dryness classes")
    candidates = {
        "model_root_only_logistic": (make_pipeline(StandardScaler(), LogisticRegression(max_iter=600)), ["root_rank"]),
        "multi_input_logistic": (make_pipeline(StandardScaler(), LogisticRegression(max_iter=600)), FEATURE_COLUMNS),
        "multi_input_gradient_boosting": (
            HistGradientBoostingClassifier(
                loss="log_loss", max_iter=160, learning_rate=0.055,
                max_leaf_nodes=20, max_depth=5, min_samples_leaf=40,
                l2_regularization=1, early_stopping=False, random_state=42
            ),
            FEATURE_COLUMNS
        )
    }
    all_models = {}
    validation_metrics = {}
    testing_metrics = {}
    station_metrics = {}
    for name, (estimator, columns) in candidates.items():
        estimator.fit(train[columns], train.ground_dry.astype(int))
        all_models[name] = estimator
        val_prob = estimator.predict_proba(validation[columns])[:, 1]
        test_prob = estimator.predict_proba(test[columns])[:, 1]
        validation_metrics[name] = diagnostics(validation.ground_dry, val_prob)
        testing_metrics[name] = diagnostics(test.ground_dry, test_prob)
        station_metrics[name] = {}
        for station, sample in test.groupby("station"):
            probabilities = estimator.predict_proba(sample[columns])[:, 1]
            station_metrics[name][station] = diagnostics(sample.ground_dry, probabilities)
        print(json.dumps({"model": name, "validation_brier": validation_metrics[name]["brier"], "test_brier": testing_metrics[name]["brier"]}), flush=True)
    chosen = min(candidates, key=lambda name: validation_metrics[name]["brier"])
    simple = testing_metrics["model_root_only_logistic"]["brier"]
    selected = testing_metrics[chosen]["brier"]
    gained = (simple - selected) / simple if simple > 0 else None
    uncorrected = {
        "total_test": raw_screen(test.ground_dry, test.root_rank),
        "by_station": {station: raw_screen(part.ground_dry, part.root_rank) for station, part in test.groupby("station")}
    }
    return {
        "splits": {
            "train": {"date_range": "2013-01-01 to 2019-12-31", "rows": len(train)},
            "validation": {"date_range": "2020-01-01 to 2021-12-31", "rows": len(validation)},
            "test": {"date_range": "2022-01-01 to 2025-12-31", "rows": len(test)}
        },
        "selection_rule": "Pick lowest validation Brier score across three fixed candidate models; never tune on 2022-2025 test.",
        "validation": validation_metrics,
        "test": testing_metrics,
        "by_station_test": station_metrics,
        "raw_nasa_root_below_40_comparator": uncorrected,
        "selected_model": chosen,
        "test_relative_brier_improvement_over_root_only_logistic": round(float(gained), 5) if gained is not None else None,
        "ground_calibration_demonstrated": bool(gained is not None and gained >= 0.05),
        "qualifier": "Calibration of the NASA model's estimate of present-day probe root-zone percentile at four specific stations only; NOT a future-day forecast and NOT independently validated for other global sites."
    }, {"model": all_models[chosen], "features": candidates[chosen][1], "trained_until": TRAIN_END, "validation_until": VALIDATION_END, "ground_reference_years": [REFERENCE_START, TRAIN_END]}


def spatial_transfer_test(station_frames):
    training = pd.concat(station_frames).sort_index()
    outcomes = {}
    for train_id, eval_id in (("us_sgp_goodwell", "us_sgp_stillwater"), ("us_sgp_stillwater", "us_sgp_goodwell")):
        training_rows = training[(training.model_site == train_id) & (training.year <= TRAIN_END)]
        test_rows = training[(training.model_site == eval_id) & (training.year > VALIDATION_END)]
        if len(training_rows) < 200 or len(test_rows) < 200 or len(np.unique(training_rows.ground_dry)) < 2:
            outcomes[train_id + "_to_" + eval_id] = {"status": "insufficient_data"}
            continue
        model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=600))
        model.fit(training_rows[FEATURE_COLUMNS], training_rows.ground_dry.astype(int))
        probabilities = model.predict_proba(test_rows[FEATURE_COLUMNS])[:, 1]
        outcomes[train_id + "_to_" + eval_id] = {
            "training_days": len(training_rows),
            "test_days": len(test_rows),
            "ground_truth": "NOAA USCRN independent soil profiles",
            "model": "multi_input_logistic_without_target_site_training",
            "metrics": diagnostics(test_rows.ground_dry, probabilities)
        }
    return outcomes


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=OUT)
    parser.add_argument("--model-output", type=Path, default=MODEL_OUT)
    args = parser.parse_args()
    stations = []
    manifests = {}
    errors = {}
    with requests.Session() as session:
        for station, model_id in STATIONS:
            print("Reading independent NOAA ground truth: " + station, flush=True)
            try:
                frame, source, problems = station_frame(station, model_id, session)
                stations.append(frame)
                manifests[station] = source
                errors[station] = problems
            except (RuntimeError, ValueError, KeyError) as exc:
                errors[station] = [{"error": str(exc)}]
                print("Station unavailable: " + str(exc), flush=True)
    if len(stations) < 3:
        raise SystemExit("Fewer than three complete soil-probe stations; no reliable AI calibration could be evaluated.")
    evaluation, model = train_and_test(stations)
    transfer = spatial_transfer_test(stations)
    output = {
        "status": "INDEPENDENT_GROUND_TRUTH_ML_EVALUATION_NOT_OPERATIONAL",
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "goal": "Estimate present-day observed root-zone low-percentile status (<40th percentile) from same-day NASA model inputs, not future rainfall or moisture.",
        "ground_truth": "NOAA USCRN 5, 10, 20, 50 and 100 cm probe-based depth-weighted soil water content",
        "modeled_input": "NASA POWER/MERRA-2 modeled GWETTOP/GWETROOT and historical precipitation/temperature at Goodwell and Stillwater",
        "fixed_training_only_baseline": "2013-2018 plus or minus 15 calendar days, independently for NOAA and NASA",
        "training_observation_sites": sorted(list({f.model_site.iloc[0] for f in stations})),
        "station_count": len(stations),
        "station_ids": [f.station.iloc[0] for f in stations],
        "features_used": FEATURE_COLUMNS,
        "evaluation": evaluation,
        "cross_region_transfer": transfer,
        "noaa_source_manifests": manifests,
        "source_download_failures": errors,
        "limitations": [
            "A train/validation/test split in time does not imply spatial representativeness. Only four NOAA stations near two Oklahoma NASA model sites were used.",
            "Nearby NOAA stations share nearly the same NASA grid inputs while their local observations can differ.",
            "The target is present-day observed soil moisture rank, not future root-zone persistence, crop stress, irrigation demand, drought impact or water savings.",
            "Seasonal percentiles use a short 2013-2018 ground-observation reference, separate from the published 1991-2020 historical ROOTSHADOW baseline.",
            "All features are current or historical NASA model variables; NOAA probes are labels only, never runtime inputs.",
            "Low spatial transfer skill would mean calibrated model should not be extrapolated to other locations or irrigated Qatar farms.",
            "A positive held-out score does not establish general deployment suitability. Further seasons, locations, independent validation and a prospective pilot are necessary.",
            "Performance differences on overlapping daily observations are serially correlated; naive binomial confidence intervals would overstate certainty."
        ]
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    args.model_output.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, args.model_output)
    print(json.dumps({
        "stations_evaluated": len(stations),
        "selected": evaluation["selected_model"],
        "root_only_test_brier": evaluation["test"]["model_root_only_logistic"]["brier"],
        "selected_test_brier": evaluation["test"][evaluation["selected_model"]]["brier"],
        "relative_brier_gain": evaluation["test_relative_brier_improvement_over_root_only_logistic"],
        "ground_calibration_demonstrated": evaluation["ground_calibration_demonstrated"],
        "cross_region_transfer": {k: v.get("metrics", {}).get("brier") for k, v in transfer.items()}
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
