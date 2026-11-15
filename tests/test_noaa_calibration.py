import numpy as np
import pandas as pd

from scripts.train_noaa_calibration import build_features, diagnostics, splits


def test_features_use_only_current_and_prior_nasa_inputs():
    dates = pd.date_range("2014-01-01", periods=90)
    data = pd.DataFrame({
        "GWETROOT": np.linspace(0.2, 0.8, len(dates)),
        "GWETTOP": np.linspace(0.1, 0.9, len(dates)),
        "PRECTOT": np.ones(len(dates)),
        "T2M": np.ones(len(dates)) * 25
    }, index=dates)
    original = build_features(data).iloc[40].copy()
    data.iloc[41:, :] = 0
    modified = build_features(data).iloc[40].copy()
    pd.testing.assert_series_equal(original, modified)


def test_chronological_splits_are_disjoint():
    index = pd.date_range("2018-12-29", "2022-01-03")
    frame = pd.DataFrame({"year": index.year}, index=index)
    masks = splits(frame)
    assert not (masks["train"] & masks["validation"]).any()
    assert not (masks["train"] & masks["test"]).any()
    assert not (masks["validation"] & masks["test"]).any()
    assert int(masks["train"].sum()) == 3


def test_probabilistic_metrics_capture_accuracy_and_calibration():
    y = np.array([0, 1, 0, 1, 0, 1])
    p = np.array([0.1, 0.9, 0.2, 0.8, 0.1, 0.9])
    m = diagnostics(y, p)
    assert m["roc_auc"] == 1
    assert m["brier"] < 0.05
    assert m["at_probability_0_5"]["false_positive"] == 0
    assert m["at_probability_0_5"]["false_negative"] == 0
    assert m["expected_calibration_error"] >= 0
