import numpy as np
import pandas as pd
import pytest

from scripts.gate1_screen import detect_recovery, empirical_lag_review, seasonal_percentiles_fixed
from scripts.extract_gee_corroboration import month_windows, CATALOG


def fake_daily(root_recovery=True, interrupted=False):
    dates = pd.date_range("2022-01-01", periods=140, freq="D")
    surface = np.full(140, 0.15)
    root = np.full(140, 0.10)
    surface[40:] = 0.65
    if root_recovery:
        root[58:] = 0.55
    if interrupted:
        surface[95:] = 0.10
        root[95:] = 0.10
    return pd.DataFrame({"top_pct": surface, "root_pct": root}, index=dates)


def test_fixed_baseline_not_contaminated_by_out_of_window_outlier():
    days = pd.date_range("1991-01-01", "2021-12-31", freq="D")
    series = pd.Series(np.repeat(0.4, len(days)), index=days, name="surface")
    series.loc["2021-06-01"] = 0.9
    ranks = seasonal_percentiles_fixed(series)
    assert 0.45 < ranks.loc["1998-06-01"] < 0.55
    assert ranks.loc["2021-06-01"] == 1.0


def test_complete_event_lag():
    events = detect_recovery(fake_daily())
    assert len(events) == 1
    assert events[0]["status"] == "COMPLETE_SURFACE_FIRST"
    assert events[0]["recovery_delay_days"] == 18
    assert events[0]["censored_delay_lower_bound_days"] is None


def test_censored_event_not_misreported_as_complete():
    events = detect_recovery(fake_daily(root_recovery=False))
    assert len(events) == 1
    assert events[0]["status"] == "RIGHT_CENSORED_AT_RECORD_END"
    assert events[0]["recovery_delay_days"] is None
    assert events[0]["censored_delay_lower_bound_days"] > 0


def test_root_first_not_mislabeled_as_hidden_drought():
    frame = fake_daily()
    frame.loc["2022-02-08":, "root_pct"] = 0.55
    events = detect_recovery(frame)
    assert events[0]["status"] == "ROOT_FIRST"
    assert events[0]["recovery_delay_days"] < 0


def test_inadequate_history_does_not_claim_anomaly():
    result = empirical_lag_review([{"status": "COMPLETE_SURFACE_FIRST", "recovery_delay_days": 12}])
    assert result["status"] == "INSUFFICIENT_COMPLETE_EVENTS"


def test_month_windows_partition_exclusive_dates():
    assert list(month_windows("2022-01-15", "2022-03-02")) == [
        ("2022-01-15", "2022-02-01"),
        ("2022-02-01", "2022-03-01"),
        ("2022-03-01", "2022-03-02"),
    ]
    assert CATALOG["smap"] == "NASA/SMAP/SPL4SMGP/008"


def test_irregular_dates_rejected():
    frame = fake_daily().drop(index=pd.Timestamp("2022-02-15"))
    with pytest.raises(ValueError, match="complete daily"):
        detect_recovery(frame)
