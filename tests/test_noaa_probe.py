import numpy as np
import pandas as pd
from scripts.validate_noaa_probe import binary_metrics, root_profile, station_distance_km, parse_noaa_daily


def test_weighted_depth_profile_is_complete_and_normalized():
    index = pd.date_range("2020-01-01", periods=2)
    frame = pd.DataFrame({
        "vwc_5": [0.1, 0.1],
        "vwc_10": [0.2, 0.2],
        "vwc_20": [0.3, 0.3],
        "vwc_50": [0.4, np.nan],
        "vwc_100": [0.5, 0.5]
    }, index=index)
    result = root_profile(frame)
    expected = .075 * .1 + .075 * .2 + .2 * .3 + .4 * .4 + .25 * .5
    assert abs(result.iloc[0] - expected) < 1e-10
    assert np.isnan(result.iloc[1])


def test_binary_metrics_detect_false_alarms_and_missed_cases():
    result = binary_metrics([True, True, False, False], [True, False, True, False])
    assert result["true_positive"] == 1
    assert result["false_negative"] == 1
    assert result["false_positive"] == 1
    assert result["true_negative"] == 1
    assert result["precision"] == 0.5
    assert result["recall"] == 0.5
    assert result["balanced_accuracy"] == 0.5


def test_different_coordinates_are_not_claimed_to_be_same_field():
    assert station_distance_km(36.597, -101.618, 36.59, -101.59) > 2
    assert station_distance_km(36.597, -101.618, 36.59, -101.59) < 5
    assert station_distance_km(0, 0, 0, 0) == 0


def test_noaa_daily_parser_rejects_missing_sentinel_values():
    columns = ["03055", "20220101", "2.701", "-101.590", "36.590"] + ["1.0"] * 13 + ["0.10", "0.20", "-99.000", "0.40", "0.50"] + ["1.0"] * 5
    raw = " ".join(columns).encode() + b"\n"
    frame = parse_noaa_daily(raw)
    assert frame["vwc_5"].iloc[0] == 0.10
    assert frame["vwc_20"].isna().all()
    assert np.isnan(root_profile(frame).iloc[0])
