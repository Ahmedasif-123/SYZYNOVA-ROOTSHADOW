import argparse
import hashlib
import io
import json
import math
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import requests
from scipy.stats import spearmanr

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from rootshadow.recovery import seasonal_percentiles_fixed
from scripts.build_moisture_atlas import CORE, historical

STATIONS = [
    ("OK_Goodwell_2_E", "us_sgp_goodwell"),
    ("OK_Goodwell_2_SE", "us_sgp_goodwell"),
    ("OK_Stillwater_2_W", "us_sgp_stillwater"),
    ("OK_Stillwater_5_WNW", "us_sgp_stillwater")
]
START_YEAR = 2013
BASELINE_END_YEAR = 2021
TEST_START_YEAR = 2022
TEST_END_YEAR = 2025
THRESHOLD = 0.40
WEIGHTS = np.array([0.075, 0.075, 0.20, 0.40, 0.25])
COLS = ["date", "longitude", "latitude", "vwc_5", "vwc_10", "vwc_20", "vwc_50", "vwc_100"]
COLUMN_NUMBERS = [1, 3, 4, 18, 19, 20, 21, 22]
STATION_BASE = "https://www.ncei.noaa.gov/pub/data/uscrn/products/daily01"
OUT = ROOT / "ground_probe" / "NOAA_VALIDATION_PILOT.json"


def station_distance_km(lat_a, lon_a, lat_b, lon_b):
    p1, p2 = math.radians(lat_a), math.radians(lat_b)
    dp = p2 - p1
    dl = math.radians(lon_b - lon_a)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 6371.0088 * 2 * math.atan2(math.sqrt(a), math.sqrt(max(0, 1 - a)))


def root_profile(frame):
    values = frame[["vwc_5", "vwc_10", "vwc_20", "vwc_50", "vwc_100"]].to_numpy(dtype=float)
    complete = np.isfinite(values).all(axis=1)
    output = np.full(len(frame), np.nan)
    output[complete] = values[complete] @ WEIGHTS
    return pd.Series(output, index=frame.index, name="profile_vwc")


def binary_metrics(truth, predicted):
    observed = np.asarray(truth, dtype=bool)
    estimate = np.asarray(predicted, dtype=bool)
    if len(observed) != len(estimate) or not len(observed):
        return None
    tp = int(np.count_nonzero(observed & estimate))
    fp = int(np.count_nonzero(~observed & estimate))
    tn = int(np.count_nonzero(~observed & ~estimate))
    fn = int(np.count_nonzero(observed & ~estimate))
    ratio = lambda numerator, denominator: round(float(numerator / denominator), 4) if denominator else None
    precision = ratio(tp, tp + fp)
    recall = ratio(tp, tp + fn)
    specificity = ratio(tn, tn + fp)
    return {
        "n": len(observed),
        "true_positive": tp,
        "false_positive": fp,
        "true_negative": tn,
        "false_negative": fn,
        "precision": precision,
        "recall": recall,
        "specificity": specificity,
        "f1": ratio(2 * tp, 2 * tp + fp + fn),
        "balanced_accuracy": None if recall is None or specificity is None else round((recall + specificity) / 2, 4),
        "false_positive_rate": ratio(fp, fp + tn),
        "accuracy": ratio(tp + tn, len(observed))
    }


def parse_noaa_daily(raw):
    table = pd.read_csv(
        io.BytesIO(raw), sep=r"\s+", header=None, usecols=COLUMN_NUMBERS,
        names=COLS, dtype={"date": str}, engine="python"
    )
    if table.shape[1] != 8 or table.empty:
        raise ValueError("NOAA USCRN daily file has an unexpected column structure")
    table["date"] = pd.to_datetime(table["date"], format="%Y%m%d", errors="raise")
    table = table.set_index("date").sort_index()
    if table.index.has_duplicates:
        raise ValueError("NOAA USCRN contains duplicate daily observations")
    for column in ["vwc_5", "vwc_10", "vwc_20", "vwc_50", "vwc_100"]:
        numeric = pd.to_numeric(table[column], errors="coerce")
        table[column] = numeric.where(numeric.between(0, 0.8))
    for column in ["latitude", "longitude"]:
        table[column] = pd.to_numeric(table[column], errors="coerce")
    return table


def download_noaa_station(station, session, years=range(START_YEAR, TEST_END_YEAR + 1)):
    frames = []
    manifests = []
    failures = []
    for year in years:
        url = f"{STATION_BASE}/{year}/CRND0103-{year}-{station}.txt"
        response = None
        error = None
        for attempt in range(3):
            try:
                response = session.get(url, timeout=30, headers={"User-Agent": "ROOTSHADOW-research-pilot/1.0"})
                if response.status_code == 404:
                    error = "404 station-year source unavailable"
                    break
                response.raise_for_status()
                if len(response.content) < 150:
                    raise ValueError("Empty or short NOAA station-year response")
                parsed = parse_noaa_daily(response.content)
                frames.append(parsed)
                manifests.append({
                    "url": url,
                    "sha256": hashlib.sha256(response.content).hexdigest(),
                    "rows": len(parsed)
                })
                error = None
                break
            except (requests.RequestException, ValueError, pd.errors.ParserError) as exc:
                error = str(exc)[:240]
                if attempt < 2:
                    time.sleep(1.4 * (attempt + 1))
        if error is not None:
            failures.append({"year": year, "url": url, "error": error})
        time.sleep(0.12)
    if not frames:
        raise RuntimeError(f"No NOAA data could be acquired for {station}: {failures[:2]}")
    combined = pd.concat(frames).sort_index()
    if combined.index.has_duplicates:
        raise ValueError("NOAA duplicate date across yearly files")
    return combined, manifests, failures


def fixed_percentiles(series):
    return seasonal_percentiles_fixed(
        series, baseline_start=START_YEAR, baseline_end=BASELINE_END_YEAR,
        window=15, min_reference=100
    )


def series_correlation(model, field):
    mask = model.notna() & field.notna()
    if int(mask.sum()) < 30:
        return None
    coefficient = spearmanr(model[mask], field[mask]).statistic
    return round(float(coefficient), 4) if np.isfinite(coefficient) else None


def paired_months(frame):
    series = []
    for month, rows in frame.groupby(frame.index.to_period("M")):
        truth = rows["field_root"] < THRESHOLD
        model = rows["model_root"] < THRESHOLD
        surface = rows["model_surface"] < THRESHOLD
        model_mismatch = (rows["model_surface"] >= THRESHOLD) & (rows["model_root"] < THRESHOLD)
        field_mismatch = (rows["field_surface"] >= THRESHOLD) & (rows["field_root"] < THRESHOLD)
        series.append({
            "month": str(month),
            "paired_days": len(rows),
            "ground_root_dry_days": int(truth.sum()),
            "model_root_dry_days": int(model.sum()),
            "model_surface_dry_days": int(surface.sum()),
            "modeled_mismatch_days": int(model_mismatch.sum()),
            "ground_observed_mismatch_days": int(field_mismatch.sum()),
            "model_root_median_percentile": round(float(rows["model_root"].median() * 100), 1),
            "ground_root_median_percentile": round(float(rows["field_root"].median() * 100), 1)
        })
    return series


def analyze_station(station, model_site, session):
    measurements, manifests, failures = download_noaa_station(station, session)
    model_source = next(item for item in CORE if item["id"] == model_site)
    historical_model = historical(model_source)
    start = pd.Timestamp(f"{START_YEAR}-01-01")
    end = pd.Timestamp(f"{TEST_END_YEAR}-12-31")
    model = historical_model.loc[start:end].copy()
    ground = measurements.loc[start:end].reindex(model.index)
    ground_profile = root_profile(ground)
    model_root = fixed_percentiles(model["GWETROOT"])
    model_surface = fixed_percentiles(model["GWETTOP"])
    ground_root = fixed_percentiles(ground_profile)
    ground_surface = fixed_percentiles(ground["vwc_5"])
    full = pd.DataFrame({
        "model_root": model_root,
        "model_surface": model_surface,
        "field_root": ground_root,
        "field_surface": ground_surface
    })
    test = full.loc[f"{TEST_START_YEAR}-01-01":f"{TEST_END_YEAR}-12-31"].dropna()
    if len(test) < 200:
        raise ValueError(f"Insufficient paired holdout days at {station}: {len(test)}")
    measured_root_dry = test["field_root"] < THRESHOLD
    model_root_dry = test["model_root"] < THRESHOLD
    surface_only = test["model_surface"] < THRESHOLD
    modeled_mismatch = (test["model_surface"] >= THRESHOLD) & (test["model_root"] < THRESHOLD)
    observed_mismatch = (test["field_surface"] >= THRESHOLD) & (test["field_root"] < THRESHOLD)
    pair = measurements.loc[measurements.index.year >= TEST_START_YEAR]
    coord = pair.dropna(subset=["latitude", "longitude"])
    station_lat = float(coord["latitude"].median()) if not coord.empty else None
    station_lon = float(coord["longitude"].median()) if not coord.empty else None
    reference_ground_days = int(ground_profile.loc[f"{START_YEAR}-01-01":f"{BASELINE_END_YEAR}-12-31"].notna().sum())
    return {
        "station": station,
        "model_site": model_site,
        "station_coordinates": {"latitude": station_lat, "longitude": station_lon},
        "model_coordinates": {"latitude": model_source["latitude"], "longitude": model_source["longitude"]},
        "point_separation_km": round(station_distance_km(station_lat, station_lon, model_source["latitude"], model_source["longitude"]), 2) if station_lat is not None and station_lon is not None else None,
        "ground_reference_valid_days": reference_ground_days,
        "holdout_paired_days": len(test),
        "holdout_field_root_dry_days": int(measured_root_dry.sum()),
        "holdout_observed_mismatch_days": int(observed_mismatch.sum()),
        "field_truth_source": "NOAA USCRN daily QC measurements, complete weighted 0-100 cm profile and independent 5 cm surface probe",
        "predictors": {
            "model_root_low_percentile": binary_metrics(measured_root_dry, model_root_dry),
            "surface_only_low_percentile": binary_metrics(measured_root_dry, surface_only),
            "model_mismatch_vs_probe_mismatch": binary_metrics(observed_mismatch, modeled_mismatch)
        },
        "rank_agreement": {
            "model_root_vs_probe_root_spearman": series_correlation(test["model_root"], test["field_root"]),
            "model_surface_vs_probe_surface_spearman": series_correlation(test["model_surface"], test["field_surface"])
        },
        "potential_additional_detection": {
            "ground_root_dry_days_surface_only_did_not_flag": int((measured_root_dry & ~surface_only).sum()),
            "ground_root_dry_days_model_root_caught_but_surface_did_not": int((measured_root_dry & ~surface_only & model_root_dry).sum())
        },
        "monthly_holdout_evidence": paired_months(test),
        "noaa_source_records": manifests,
        "source_year_errors": failures
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=OUT)
    args = parser.parse_args()
    reports = []
    errors = []
    with requests.Session() as session:
        for station, model_site in STATIONS:
            print(f"Evaluating {station} against {model_site}", flush=True)
            try:
                item = analyze_station(station, model_site, session)
                reports.append(item)
                comparison = item["predictors"]
                print(json.dumps({
                    "station": station,
                    "paired_days": item["holdout_paired_days"],
                    "distance_km": item["point_separation_km"],
                    "field_root_dry_days": item["holdout_field_root_dry_days"],
                    "root_recall": comparison["model_root_low_percentile"]["recall"],
                    "surface_only_recall": comparison["surface_only_low_percentile"]["recall"],
                    "root_precision": comparison["model_root_low_percentile"]["precision"],
                    "surface_only_precision": comparison["surface_only_low_percentile"]["precision"],
                    "mismatch_recall": comparison["model_mismatch_vs_probe_mismatch"]["recall"],
                    "correlation": item["rank_agreement"]["model_root_vs_probe_root_spearman"]
                }), flush=True)
            except (RuntimeError, ValueError, KeyError) as error:
                errors.append({"station": station, "model_site": model_site, "error": str(error)[:500]})
                print(f"Station could not be evaluated: {station}: {error}", flush=True)
    output = {
        "status": "INDEPENDENT_IN_SITU_PILOT_NOT_GENERAL_VALIDATION" if reports else "NO_VALID_PILOT_STATIONS",
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "protocol": "ROOTSHADOW pilot 2026-11-15, predefined before accessing station outcomes",
        "model": "NASA POWER / MERRA-2 daily GWETTOP and GWETROOT; existing hashed historical model files",
        "ground_measurement": "NOAA USCRN 5, 10, 20, 50, 100 cm moisture probes",
        "reference_window": f"{START_YEAR}-{BASELINE_END_YEAR}",
        "holdout_window": f"{TEST_START_YEAR}-{TEST_END_YEAR}",
        "rank_definition": "Each source gets its own fixed 2013-2021 seasonal percentile baseline, +/-15 calendar days, identical midrank estimator",
        "root_profile_weights": dict(zip(["5cm", "10cm", "20cm", "50cm", "100cm"], WEIGHTS.tolist())),
        "root_profile_weight_note": "Approximate 0-100 cm depth-integrated volumetric water content; all five levels required for paired ground truth.",
        "primary_outcome": "Whether the observed 0-100 cm probe-based seasonal rank is below the predefined 40th percentile",
        "independent_comparator": "NOAA USCRN ground observation, not another coupled land-surface model",
        "sites_proposed": len(STATIONS),
        "stations_evaluated": len(reports),
        "stations": reports,
        "errors": errors,
        "limitations": [
            "This is a small Oklahoma station pilot, not validation of 97 global points or Qatar farms.",
            "Daily NASA data use UTC while NOAA daily records use local standard time, potentially shifting an event across one date.",
            "A station probe cluster is a point observation; MERRA-2 is a much coarser grid-cell mean.",
            "Ground 0-100 cm integrated profile is reconstructed from depth sensors and may miss horizontal heterogeneity.",
            "Seasonal percentile comparison avoids mixing physical volumetric moisture units with model-relative wetness.",
            "The baseline was fixed to 2013-2021 before evaluating 2022-2025 outcomes and intentionally differs from the original site's published 1991-2020 baseline.",
            "Same-family model and SMAP comparisons are not independent field validation. This pilot uses USCRN probes.",
            "No model calibration, agricultural intervention, irrigation recommendations, AI forecasting, or causal claims are implied."
        ]
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"stations_evaluated": output["stations_evaluated"], "attempted": output["sites_proposed"], "status": output["status"], "errors": errors}, indent=2), flush=True)
    if not reports:
        raise SystemExit("No reliable probe overlap was available; no validation result was claimed")


if __name__ == "__main__":
    main()
