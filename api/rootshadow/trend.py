"""Trend statistics that respect serial dependence: Hamed–Rao modified Mann–Kendall + block-bootstrap Theil–Sen."""
import numpy as np
from scipy.stats import norm, rankdata, theilslopes


def _mk_s_and_var(x):
    n = len(x)
    s = 0.0
    for i in range(n - 1):
        s += np.sign(x[i + 1:] - x[i]).sum()
    _, counts = np.unique(x, return_counts=True)
    var = (n * (n - 1) * (2 * n + 5) - np.sum(counts * (counts - 1) * (2 * counts + 5))) / 18.0
    return float(s), float(var)


def _acf(r, nlags):
    r = r - r.mean()
    denom = float(np.sum(r * r))
    if denom == 0:
        return np.zeros(nlags + 1)
    return np.array([1.0] + [float(np.sum(r[:-k] * r[k:]) / denom) for k in range(1, nlags + 1)])


def modified_mann_kendall(y, correct_autocorrelation=True):
    """Return dict(tau, s, z, p, correction). correction>1 inflates the variance for positive autocorrelation (Hamed & Rao 1998)."""
    y = np.asarray(y, dtype=float)
    n = len(y)
    if n < 8:
        raise ValueError("At least eight annual values are required")
    s, var = _mk_s_and_var(y)
    correction = 1.0
    if correct_autocorrelation and np.ptp(y) > 0:
        t = np.arange(n, dtype=float)
        slope = theilslopes(y, t)[0]
        ranks = rankdata(y - slope * t)
        rho = _acf(ranks, n - 1)
        k = np.arange(1, n)
        lo = (-1 - 1.96 * np.sqrt(n - k - 1)) / (n - k)
        hi = (-1 + 1.96 * np.sqrt(n - k - 1)) / (n - k)
        significant = (rho[1:] > hi) | (rho[1:] < lo)
        weights = (n - k) * (n - k - 1) * (n - k - 2) * rho[1:]
        correction = 1.0 + 2.0 / (n * (n - 1) * (n - 2)) * float(np.sum(weights[significant]))
        correction = max(correction, 1e-6)
    var_adj = var * correction
    z = 0.0 if s == 0 or var_adj <= 0 else (s - np.sign(s)) / np.sqrt(var_adj)
    pairs = n * (n - 1) / 2
    return {"s": s, "tau": s / pairs, "z": float(z), "p": float(2 * (1 - norm.cdf(abs(z)))), "variance_correction": float(correction)}


def ols_slope(x, y):
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    xc = x - x.mean()
    return float(np.sum(xc * (y - y.mean())) / np.sum(xc * xc))


def block_bootstrap_slope_ci(x, y, n_boot=1000, seed=7, alpha=0.05):
    """Moving-block bootstrap of residuals around the OLS line (keeps short-range dependence)."""
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    n = len(y)
    slope = ols_slope(x, y)
    fit = y.mean() + slope * (x - x.mean())
    resid = y - fit
    block = max(2, int(np.ceil(n ** (1 / 3))))
    rng = np.random.default_rng(seed)
    n_blocks = int(np.ceil(n / block))
    xc = x - x.mean()
    denom = float(np.sum(xc * xc))
    slopes = np.empty(n_boot)
    for b in range(n_boot):
        starts = rng.integers(0, n - block + 1, size=n_blocks)
        r = np.concatenate([resid[s:s + block] for s in starts])[:n]
        slopes[b] = np.sum(xc * (fit + r - (fit + r).mean())) / denom
    return float(np.quantile(slopes, alpha / 2)), float(np.quantile(slopes, 1 - alpha / 2))


def trend_summary(years, values, with_ci=True):
    years = np.asarray(years, dtype=float)
    values = np.asarray(values, dtype=float)
    if len(years) < 20:
        return {"status": "insufficient_years", "n_years": int(len(years)), "slope_per_decade": None, "p_value": None, "naive_mk_p_value": None, "significant_at_0_05": None}
    if np.ptp(values) == 0:
        return {"status": "flat", "n_years": int(len(years)), "slope_per_decade": 0.0, "p_value": 1.0, "naive_mk_p_value": 1.0, "significant_at_0_05": False}
    hr = modified_mann_kendall(values)
    naive = modified_mann_kendall(values, correct_autocorrelation=False)
    out = {
        "status": "tested", "n_years": int(len(years)),
        "slope_per_decade": round(ols_slope(years, values) * 10, 3),
        "theil_sen_slope_per_decade": round(float(theilslopes(values, years)[0]) * 10, 3),
        "tau": round(hr["tau"], 4),
        "p_value": round(hr["p"], 5),
        "naive_mk_p_value": round(naive["p"], 5),
        "variance_correction": round(hr["variance_correction"], 3),
        "significant_at_0_05": bool(hr["p"] < 0.05),
        "method": "Hamed–Rao (1998) modified Mann–Kendall for significance; OLS slope with block-bootstrap CI",
        "caveat": "Annual event metrics are sparse and zero-inflated, so the Theil–Sen slope is often exactly 0 (median of pairwise slopes) and is reported only for reference; the OLS slope is the headline. p-values are approximate. Significance is not causal attribution.",
    }
    if with_ci:
        lo, hi = block_bootstrap_slope_ci(years, values)
        out["slope_ci95_per_decade_block_bootstrap"] = [round(lo * 10, 3), round(hi * 10, 3)]
    return out
