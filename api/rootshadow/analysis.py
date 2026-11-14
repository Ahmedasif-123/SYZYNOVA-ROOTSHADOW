"""End-to-end ROOTSHADOW analysis: fixed-baseline recovery lag → annual metric → corrected trend → null model → audit."""
import numpy as np
import pandas as pd

from .null_model import surrogate_comparison
from .recovery import annual_mismatch, complete_lags, detect_recovery, empirical_lag_review, event_lag_trend, seasonal_percentiles_fixed
from .trend import trend_summary

PRIMARY = {"drought_threshold": 0.20, "drought_days": 30, "recovery_threshold": 0.40, "recovery_days": 7}
GRID_DROUGHT = (0.15, 0.20, 0.25)
GRID_RECOVERY = (0.35, 0.40, 0.50)
MIN_COVERAGE = 0.90
MIN_COMPLETE_EVENTS = 8
MIN_YEARS = 20


def _reliable_years(frame):
    both = frame[["top_pct", "root_pct"]].notna().all(axis=1)
    years = []
    for year, group in both.groupby(frame.index.year):
        possible = 366 if pd.Timestamp(year, 12, 31).is_leap_year else 365
        if group.sum() / possible >= MIN_COVERAGE:
            years.append(int(year))
    return years


def _annual_records(events, years, frame):
    annual = annual_mismatch(events, years, frame)
    out = []
    for y in years:
        out.append({"year": y, "events": annual[y]["events"], "mismatch_days": annual[y]["mismatch_days"], "max_lag_days": max(annual[y]["lags"]) if annual[y]["lags"] else 0})
    return out


def sensitivity_grid(frame, primary_slope):
    cells = []
    for d in GRID_DROUGHT:
        for r in GRID_RECOVERY:
            ev = detect_recovery(frame, **dict(PRIMARY, drought_threshold=d, recovery_threshold=r))
            lt = event_lag_trend(ev)
            cells.append({"drought_percentile": int(d * 100), "recovery_percentile": int(r * 100), "events": len(ev), "complete_events": len(complete_lags(ev)),
                          "lag_slope_days_per_decade": lt["slope_days_per_decade"], "kendall_p": lt["p_value"]})
    tested = [c for c in cells if c["lag_slope_days_per_decade"] is not None]
    agree = None
    if primary_slope is not None and tested and primary_slope != 0:
        agree = sum(1 for c in tested if np.sign(c["lag_slope_days_per_decade"]) == np.sign(primary_slope))
    return {"cells": cells, "sign_agreement_with_primary": agree, "cells_tested": len(tested), "cells_total": len(cells),
            "note": "The 9-cell grid and the 7/9 agreement rule are PROPOSED robustness checks, not established scientific standards."}


def audit(coverage, complete_events, n_years, lag_trend, annual_trend, null, grid):
    checks = []
    def add(name, passed, detail):
        checks.append({"check": name, "passed": None if passed is None else bool(passed), "detail": detail})
    add("Data coverage ≥ 90% paired days", coverage >= MIN_COVERAGE, f"{coverage:.1%} of days have both layers")
    add(f"≥ {MIN_COMPLETE_EVENTS} complete drought–recovery cycles", complete_events >= MIN_COMPLETE_EVENTS, f"{complete_events} complete cycles")
    add(f"≥ {MIN_YEARS} usable years", n_years >= MIN_YEARS, f"{n_years} usable years")
    p = lag_trend.get("p_value")
    add("Recovery-delay trend: Kendall p < 0.05 (primary)", None if p is None else p < 0.05, "not tested" if p is None else f"p = {p}, slope = {lag_trend['slope_days_per_decade']} days/decade")
    sp = (null or {}).get("p_values", {}).get("lag_slope_two_sided")
    add("Slope exceeds surrogate (model-inherent) null, p < 0.05", None if sp is None else sp < 0.05, "not computed" if sp is None else f"surrogate p = {sp}")
    agree = grid.get("sign_agreement_with_primary")
    add("Slope sign agrees in ≥ 7 of 9 threshold settings", None if agree is None else agree >= 7, "not computed" if agree is None else f"{agree} of {grid['cells_tested']} testable settings agree")
    hr = annual_trend.get("p_value")
    support = {"check": "Supporting: annual mismatch days, Hamed–Rao p < 0.05", "passed": None if hr is None else hr < 0.05, "detail": "not tested" if hr is None else f"Hamed–Rao p = {hr} (zero-inflated, low power; informational)"}
    blockers = [c for c in checks[:3] if not c["passed"]]
    if blockers:
        verdict, why = "INCONCLUSIVE", "Insufficient data or events: " + "; ".join(c["check"] for c in blockers)
    elif p is None:
        verdict, why = "INCONCLUSIVE", "Too few complete recovery events to test a trend."
    elif all(c["passed"] for c in checks[3:]):
        verdict, why = "TREND_SUPPORTED_EXPLORATORY", "All proposed checks passed. This is a single-site screening result, not a validated finding."
    elif p >= 0.05:
        verdict, why = "NO_SIGNIFICANT_TREND", "No significant change in recovery delay detected; delayed recovery episodes may still occur."
    else:
        verdict, why = "TREND_NOT_ROBUST", "A nominal trend exists but fails the null-model or sensitivity check, so it may reflect model behaviour or threshold choice."
    return {"verdict": verdict, "explanation": why, "checks": checks + [support],
            "caution": "Thresholds in these checks are proposed rules, not established standards. Passing them does not establish causation or a real-world drought impact."}


def analyze(frame, metadata, n_surrogates=200, baseline=(1991, 2020)):
    frame = frame.sort_index()
    if len(frame) < 365 * 10:
        raise ValueError("At least ten years of data are required")
    work = pd.DataFrame(index=frame.index)
    work["top_pct"] = seasonal_percentiles_fixed(frame["GWETTOP"], *baseline)
    work["root_pct"] = seasonal_percentiles_fixed(frame["GWETROOT"], *baseline)
    events = detect_recovery(work, **PRIMARY)
    years = _reliable_years(work)
    annual = _annual_records(events, years, work)
    values = [a["mismatch_days"] for a in annual]
    trend = trend_summary(years, values) if years else {"status": "insufficient_years", "slope_per_decade": None, "p_value": None}
    lag_trend = event_lag_trend(events)
    grid = sensitivity_grid(work, lag_trend["slope_days_per_decade"])
    null = surrogate_comparison(work.index, work["top_pct"].to_numpy(), work["root_pct"].to_numpy(), years, PRIMARY, baseline, n_surrogates) if len(years) >= MIN_YEARS else None
    coverage = float(work[["top_pct", "root_pct"]].notna().all(axis=1).mean())
    complete = len(complete_lags(events))
    verdict = audit(coverage, complete, len(years), lag_trend, trend, null, grid)
    monthly = work.resample("MS").median()
    monthly_records = [{"month": d.strftime("%Y-%m"), "top_percentile": None if pd.isna(r.top_pct) else round(float(r.top_pct * 100), 1),
                        "root_percentile": None if pd.isna(r.root_pct) else round(float(r.root_pct * 100), 1)} for d, r in monthly.iterrows()]
    return {
        "title": "ROOTSHADOW — Surface vs root-zone recovery-lag trend audit",
        "source": metadata,
        "period": {"start": work.index.min().strftime("%Y-%m-%d"), "end": work.index.max().strftime("%Y-%m-%d"), "days": int(len(work)), "usable_years": len(years)},
        "method": {
            "baseline": f"Fixed {baseline[0]}–{baseline[1]} seasonal percentiles, ±15-day circular window, midranks for ties.",
            "drought": "Root-zone percentile ≤ 20 for ≥ 30 days (gaps ≤ 5 days bridged).",
            "recovery": "First sustained (≥ 7 days) return of EACH layer to ≥ 40th percentile — the same threshold for both layers. Delay = root recovery − surface recovery.",
            "censoring": "Delays cut off by record end or a new drought are reported as lower bounds, never as complete lags.",
            "annual_metric": "Mismatch days (surface recovered, root zone not) assigned to their actual calendar years; event counts assigned to the year of surface recovery.",
            "trend": "PRIMARY: Theil–Sen slope + Kendall tau of completed recovery delays vs date. SECONDARY: annual mismatch days with Hamed–Rao autocorrelation-corrected Mann–Kendall and block-bootstrap CI (zero-inflated, low power).",
            "null_model": "Surrogate root-zone series from a linear transfer fitted on the model's own surface→root behaviour; compares observed lag and slope to that null.",
            "limitations": "POWER wetness is MERRA-2 model output (gridded, not in-situ). Surface and root zone come from the same land model, so a recovery lag alone is not evidence of an unusual environmental event. Forcing/assimilation changes in the reanalysis can create spurious trends. Not validated against independent data (SMAP, GLDAS, stations, MODIS) in this build.",
        },
        "quality": {"paired_day_coverage": round(coverage, 4), "total_days": int(len(work))},
        "events": events,
        "lag_review": empirical_lag_review(events),
        "annual": annual,
        "lag_trend": lag_trend,
        "trend": trend,
        "null_model": null,
        "sensitivity": grid,
        "audit": verdict,
        "monthly": monthly_records,
        "ready_for_scientific_claims": False,
    }
