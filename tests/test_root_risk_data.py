import numpy as np
import pandas as pd

from scripts.audit_root_risk_data import build_features, future_persistence, split_masks


def test_persistence_requires_all_next_seven_days():
    dates = pd.date_range("2000-01-01", periods=12)
    roots = pd.Series([0.2] * 12, index=dates)
    labels, available = future_persistence(roots)
    assert labels.iloc[0] == 1
    assert available.iloc[0]
    roots.iloc[4] = 0.6
    changed, observed = future_persistence(roots)
    assert changed.iloc[0] == 0
    assert observed.iloc[0]
    assert not available.iloc[-1]


def test_future_values_do_not_enter_present_features():
    dates = pd.date_range("2000-01-01", periods=45)
    source = pd.DataFrame({
        "root_pct": np.linspace(0.1, 0.9, 45),
        "top_pct": np.linspace(0.25, 0.85, 45),
        "rain_mm": np.ones(45),
        "temperature_c": np.ones(45) * 25
    }, index=dates)
    earlier = build_features(source).iloc[22].copy()
    source.iloc[23:, :] = 0.0
    later = build_features(source).iloc[22].copy()
    pd.testing.assert_series_equal(earlier, later)


def test_split_prevents_labels_crossing_next_period():
    dates = pd.DatetimeIndex([
        "2014-12-24", "2014-12-25", "2015-01-01",
        "2020-12-24", "2020-12-25", "2021-01-01",
        "2025-12-24", "2025-12-25"
    ])
    masks = split_masks(dates)
    assert masks["train"].tolist() == [True, False, False, False, False, False, False, False]
    assert masks["validation"].tolist() == [False, False, True, True, False, False, False, False]
    assert masks["test"].tolist() == [False, False, False, False, False, True, True, False]
