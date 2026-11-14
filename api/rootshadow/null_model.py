"""Surrogate null: how much surface→root recovery lag does a linear transfer fitted to THIS site's own model output produce?

The surrogate root-zone series is driven by the REAL surface series through a linear filter (plus resampled residuals),
then rank-mapped onto the observed root-zone distribution. It therefore keeps the model-inherent smoothing of the root
zone (the circularity concern) and the surface forcing, but contains no site-specific extra persistence.
This is a descriptive calibration under linear/Gaussian assumptions, not a formal proof of anomaly."""
import numpy as np
from scipy.signal import lfilter
from scipy.stats import norm

from .recovery import annual_mismatch, complete_lags, detect_recovery, event_lag_trend

LAGS = (0, 1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90)


def _z(pct):
    return norm.ppf(np.clip(pct, 0.005, 0.995))


def _design(top_z):
    n = len(top_z)
    cols = [np.ones(n)]
    for k in LAGS:
        shifted = np.full(n, np.nan)
        shifted[k:] = top_z[:n - k] if k else top_z
        cols.append(shifted)
    return np.column_stack(cols)


def fit_transfer(top_pct, root_pct, fit_mask):
    top_z = _z(np.where(np.isfinite(top_pct), top_pct, 0.5))
    root_z = _z(np.where(np.isfinite(root_pct), root_pct, 0.5))
    X = _design(top_z)
    lagged_root = np.r_[np.nan, root_z[:-1]]
    X = np.column_stack([X, lagged_root])
    ok = fit_mask & np.isfinite(X).all(axis=1) & np.isfinite(root_pct)
    if ok.sum() < 365 * 3:
        raise ValueError("Too few observations to fit the surrogate transfer model")
    beta, *_ = np.linalg.lstsq(X[ok], root_z[ok], rcond=None)
    resid = root_z[ok] - X[ok] @ beta
    ar = float(np.clip(beta[-1], -0.999, 0.999))
    return {"beta": beta[:-1], "ar": ar, "residuals": resid, "top_z": top_z, "root_z": root_z, "valid_root": np.isfinite(root_pct)}


def simulate_root(fit, rng):
    n = len(fit["top_z"])
    drive = np.nan_to_num(_design(fit["top_z"]), nan=0.0) @ fit["beta"]
    noise = rng.choice(fit["residuals"], size=n, replace=True)
    sim = lfilter([1.0], [1.0, -fit["ar"]], drive + noise)
    observed = np.sort(fit["root_z"][fit["valid_root"]])
    ranks = np.argsort(np.argsort(sim)) / (n - 1)
    mapped = observed[np.rint(ranks * (len(observed) - 1)).astype(int)]
    return norm.cdf(mapped)


def _statistics(frame_index, top_pct, root_pct, years, params):
    import pandas as pd
    frame = pd.DataFrame({"top_pct": top_pct, "root_pct": root_pct}, index=frame_index)
    events = detect_recovery(frame, **params)
    annual = annual_mismatch(events, years, frame)
    values = np.array([annual[y]["mismatch_days"] for y in years], dtype=float)
    lags = complete_lags(events)
    lag_trend = event_lag_trend(events)
    slope = lag_trend["slope_days_per_decade"] if lag_trend["slope_days_per_decade"] is not None else np.nan
    return {
        "median_lag": float(np.median(lags)) if lags else np.nan,
        "complete_events": len(lags),
        "mean_mismatch_days_per_year": float(values.mean()),
        "slope_per_decade": slope,  # event-level lag slope (days/decade); NaN if < 8 complete events
    }


def surrogate_comparison(frame_index, top_pct, root_pct, years, params, baseline=(1991, 2020), n_surrogates=200, seed=2026):
    top_pct = np.asarray(top_pct, dtype=float)
    root_pct = np.asarray(root_pct, dtype=float)
    yrs = frame_index.year.to_numpy()
    fit_mask = (yrs >= baseline[0]) & (yrs <= baseline[1])
    fit = fit_transfer(top_pct, root_pct, fit_mask)
    observed = _statistics(frame_index, top_pct, root_pct, years, params)
    rng = np.random.default_rng(seed)
    sims = []
    for _ in range(n_surrogates):
        sim = simulate_root(fit, rng)
        sim = np.where(fit["valid_root"] & np.isfinite(top_pct), sim, np.nan)
        sims.append(_statistics(frame_index, top_pct, sim, years, params))
    def col(key):
        return np.array([s[key] for s in sims], dtype=float)
    result = {
        "status": "DESCRIPTIVE_CALIBRATION_NOT_PROOF",
        "n_surrogates": n_surrogates,
        "fit_period": f"{baseline[0]}–{baseline[1]}",
        "transfer_ar_coefficient": round(fit["ar"], 3),
        "observed": {k: (None if np.isnan(v) else round(v, 3)) for k, v in observed.items()},
        "surrogate_mean": {},
        "p_values": {},
        "assumptions": "Linear Gaussian surface→root transfer fitted on the baseline period; residuals resampled i.i.d.; marginal distribution rank-matched to observed. Nonlinear model physics and residual autocorrelation are not captured.",
    }
    for key in ("median_lag", "mean_mismatch_days_per_year", "complete_events"):
        s = col(key)
        s = s[np.isfinite(s)]
        obs = observed[key]
        result["surrogate_mean"][key] = round(float(s.mean()), 3) if len(s) else None
        if len(s) and np.isfinite(obs):
            result["p_values"][key + "_greater_than_null"] = round((1 + int(np.sum(s >= obs))) / (len(s) + 1), 4)
    s = col("slope_per_decade")
    s = s[np.isfinite(s)]
    result["surrogate_mean"]["lag_slope_days_per_decade"] = round(float(s.mean()), 3) if len(s) else None
    result["surrogate_usable"] = int(len(s))
    if len(s) >= 20 and np.isfinite(observed["slope_per_decade"]):
        center = float(np.median(s))
        result["p_values"]["lag_slope_two_sided"] = round((1 + int(np.sum(np.abs(s - center) >= abs(observed["slope_per_decade"] - center)))) / (len(s) + 1), 4)
    return result
