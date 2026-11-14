"""Fixed-climatology recovery-delay detection (moved from scripts/gate1_screen.py so the API can use it)."""
import numpy as np
import pandas as pd
from scipy.stats import kendalltau, theilslopes


def _calendar_day(index):
    """Day of year on a common 366-day (leap-year) calendar so 1 March is day 61 in every year."""
    doy = index.dayofyear.to_numpy().astype(int)
    leap = index.is_leap_year
    return doy + ((~leap) & (doy >= 60)).astype(int)


def seasonal_percentiles_fixed(series, baseline_start=1991, baseline_end=2020, window=15, min_reference=100):
    if not isinstance(series.index, pd.DatetimeIndex):
        raise TypeError("A DatetimeIndex is required")
    series = pd.to_numeric(series, errors="coerce").sort_index()
    if series.index.has_duplicates:
        raise ValueError("Duplicate dates are not allowed")
    years = series.index.year.astype(int)
    baseline = series[(years >= baseline_start) & (years <= baseline_end)].dropna()
    if len(baseline) < 365 * 5:
        raise ValueError(f"The {baseline_start}–{baseline_end} baseline requires at least five usable reference years; widen the date range")
    day_all = _calendar_day(series.index)
    day_ref = _calendar_day(baseline.index)
    base_values = baseline.to_numpy(dtype=float)
    output = np.full(len(series), np.nan, dtype=float)
    valid = series.to_numpy(dtype=float)
    for day in np.unique(day_all):
        dist = np.abs(day_ref - day)
        ref = np.sort(base_values[np.minimum(dist, 366 - dist) <= window])
        if len(ref) < min_reference:
            continue
        selector = (day_all == day) & np.isfinite(valid)
        target = valid[selector]
        left = np.searchsorted(ref, target, side="left")
        right = np.searchsorted(ref, target, side="right")
        output[selector] = (left + right) / (2.0 * len(ref))
    return pd.Series(output, index=series.index, name=(series.name or "x") + "_percentile")


def _close_gaps(mask, max_gap, min_seed=10):
    """Bridge interruptions of <= max_gap days, but only BETWEEN established dry spells (>= min_seed days each),
    so scattered individual dry days are never chained into a fake drought."""
    mask = np.asarray(mask, dtype=bool)
    if max_gap <= 0 or not mask.any():
        return mask.copy()
    seeds = _runs(mask, min_seed)
    out = mask.copy()
    for (s0, e0), (s1, e1) in zip(seeds[:-1], seeds[1:]):
        if 0 < s1 - e0 - 1 <= max_gap:
            out[e0:s1] = True
    return out


def _runs(mask, minimum):
    active = np.asarray(mask, dtype=bool)
    starts = np.where(active & ~np.r_[False, active[:-1]])[0]
    ends = np.where(active & ~np.r_[active[1:], False])[0]
    return [(int(s), int(e)) for s, e in zip(starts, ends) if e - s + 1 >= minimum]


def _first_sustained(values, threshold, first, last, days):
    if first > last:
        return None
    valid = np.isfinite(values) & (values >= threshold)
    for s, _ in _runs(valid[first:last + 1], days):
        return first + s
    return None


def detect_recovery(frame, drought_threshold=0.20, drought_days=30, recovery_threshold=0.40, recovery_days=7, merge_gap_days=5):
    """For each root-zone drought, date the first sustained recovery of each layer using the SAME percentile threshold."""
    if frame.empty or not isinstance(frame.index, pd.DatetimeIndex):
        raise ValueError("Daily DatetimeIndex and non-empty observations required")
    if frame.index.has_duplicates or not frame.index.is_monotonic_increasing:
        raise ValueError("Dates must be ordered without duplicates")
    if len(frame) > 1 and not (np.diff(frame.index.values).astype("timedelta64[D]") == np.timedelta64(1, "D")).all():
        raise ValueError("Daily observations must have a complete daily index")
    surface = pd.to_numeric(frame["top_pct"], errors="coerce").to_numpy(dtype=float)
    root = pd.to_numeric(frame["root_pct"], errors="coerce").to_numpy(dtype=float)
    dry = _close_gaps(np.isfinite(root) & (root <= drought_threshold), merge_gap_days)
    droughts = _runs(dry, drought_days)
    output = []
    for i, (drought_start, drought_end) in enumerate(droughts):
        next_drought = droughts[i + 1][0] if i + 1 < len(droughts) else len(frame)
        end = next_drought - 1
        first = drought_start + drought_days
        if first > end:
            continue
        s_idx = _first_sustained(surface, recovery_threshold, first, end, recovery_days)
        r_idx = _first_sustained(root, recovery_threshold, first, end, recovery_days)
        if s_idx is None:
            status, lag, lower_bound, mismatch_days = "NO_SURFACE_RECOVERY", None, None, 0
        elif r_idx is None:
            status = "INTERRUPTED_BY_REDROUGHT" if next_drought < len(frame) else "RIGHT_CENSORED_AT_RECORD_END"
            lag = None
            lower_bound = int((frame.index[end] - frame.index[s_idx]).days)
            seg = slice(s_idx, end + 1)
            mismatch_days = int(np.count_nonzero((surface[seg] >= recovery_threshold) & (root[seg] < recovery_threshold)))
        else:
            lag = int((frame.index[r_idx] - frame.index[s_idx]).days)
            lower_bound = None
            status = "COMPLETE_SURFACE_FIRST" if lag > 0 else ("SIMULTANEOUS" if lag == 0 else "ROOT_FIRST")
            mismatch_days = int(np.count_nonzero((surface[s_idx:r_idx] >= recovery_threshold) & (root[s_idx:r_idx] < recovery_threshold))) if lag > 0 else 0
        output.append({
            "drought_start": frame.index[drought_start].date().isoformat(),
            "drought_end": frame.index[drought_end].date().isoformat(),
            "surface_recovery": frame.index[s_idx].date().isoformat() if s_idx is not None else None,
            "root_recovery": frame.index[r_idx].date().isoformat() if r_idx is not None else None,
            "status": status,
            "recovery_delay_days": lag,
            "censored_delay_lower_bound_days": lower_bound,
            "observed_mismatch_days": mismatch_days,
            "window_end": frame.index[end].date().isoformat(),
        })
    return output


def complete_lags(events):
    return [e["recovery_delay_days"] for e in events if e["status"] == "COMPLETE_SURFACE_FIRST"]


def empirical_lag_review(events, minimum_complete=5):
    complete = complete_lags(events)
    if len(complete) < minimum_complete:
        return {"status": "INSUFFICIENT_COMPLETE_EVENTS", "complete_lag_count": len(complete), "historical_lag_threshold_days": None}
    threshold = float(np.percentile(np.array(complete, dtype=float), 90))
    return {"status": "DESCRIPTIVE_ONLY_NOT_NULL_CALIBRATED", "complete_lag_count": len(complete), "historical_lag_p90_days": round(threshold, 2), "warning": "Threshold estimated from the same historical site, not a statistical significance test. See the surrogate null model for calibration."}


def annual_mismatch(events, years, frame):
    """Attribute each qualifying mismatch day to its actual calendar year."""
    if not isinstance(frame.index, pd.DatetimeIndex):
        raise TypeError("A DatetimeIndex is required")
    totals = {int(y): {"events": 0, "mismatch_days": 0, "lags": []} for y in years}
    for event in events:
        surface_date = event["surface_recovery"]
        if surface_date is None:
            continue
        first = pd.Timestamp(surface_date)
        start_year = first.year
        if start_year in totals:
            totals[start_year]["events"] += 1
            lag = event["recovery_delay_days"]
            if lag is not None and lag > 0:
                totals[start_year]["lags"].append(lag)
        root_date = event["root_recovery"]
        if root_date is not None:
            last = pd.Timestamp(root_date) - pd.Timedelta(days=1)
        else:
            last = pd.Timestamp(event["window_end"])
        if last < first:
            continue
        interval = frame.loc[first:last, ["top_pct", "root_pct"]]
        mask = (interval["top_pct"] >= 0.40) & (interval["root_pct"] < 0.40)
        if not mask.any():
            continue
        count_by_year = mask.groupby(interval.index.year).sum()
        for year, count in count_by_year.items():
            if year in totals:
                totals[year]["mismatch_days"] += int(count)
    return totals


MIN_LAG_TREND_EVENTS = 8


def event_lag_trend(events):
    """PRIMARY trend: do completed recovery delays lengthen over time? Theil–Sen slope of delay vs date of surface
    recovery with Kendall tau. Events are separated by months to years, so serial dependence is limited but NOT corrected."""
    done = [e for e in events if e["recovery_delay_days"] is not None]
    if len(done) < MIN_LAG_TREND_EVENTS:
        return {"status": "insufficient_events", "n_events": len(done), "slope_days_per_decade": None, "p_value": None}
    t = np.array([pd.Timestamp(e["surface_recovery"]).year + (pd.Timestamp(e["surface_recovery"]).dayofyear - 1) / 365.25 for e in done])
    y = np.array([e["recovery_delay_days"] for e in done], dtype=float)
    if np.ptp(y) == 0 or np.ptp(t) == 0:
        return {"status": "flat", "n_events": len(done), "slope_days_per_decade": 0.0, "p_value": 1.0, "tau": 0.0}
    tau, p = kendalltau(t, y)
    fit = theilslopes(y, t, alpha=0.95)
    return {"status": "tested", "n_events": len(done), "slope_days_per_decade": round(float(fit.slope) * 10, 2),
            "ci95_days_per_decade": [round(float(fit.low_slope) * 10, 2), round(float(fit.high_slope) * 10, 2)],
            "tau": round(float(tau), 4), "p_value": round(float(p), 5),
            "caveat": "Event-level test; serial dependence not corrected, few events, selection by thresholds. Approximate."}
