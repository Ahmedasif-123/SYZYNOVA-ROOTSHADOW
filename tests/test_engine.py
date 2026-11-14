import json
from types import SimpleNamespace

import numpy as np
import pandas as pd
import pytest

from rootshadow.analysis import analyze
from rootshadow.data import (DataUnavailable, IntegrityError, chunk_windows, list_sites, load_site, obtain_nasa, request_url, synthetic_demo)
from rootshadow.null_model import fit_transfer, simulate_root
from rootshadow.recovery import _close_gaps, event_lag_trend
from rootshadow.service import run_analysis
from rootshadow.trend import modified_mann_kendall


def test_scattered_dry_days_are_not_chained_into_a_drought():
    rng = np.random.default_rng(3)
    mask = rng.random(2000) < 0.2  # isolated random dry days, no real drought
    closed = _close_gaps(mask, 5)
    runs = np.diff(np.flatnonzero(np.diff(np.r_[0, closed.astype(int), 0])))[::2]
    assert (runs.max() if len(runs) else 0) < 30


def test_real_dry_spells_separated_by_short_gap_are_merged():
    mask = np.zeros(100, dtype=bool)
    mask[0:20] = True
    mask[23:50] = True
    assert _close_gaps(mask, 5)[0:50].all()


def test_modified_mk_is_less_inflated_than_naive_on_autocorrelated_noise():
    rng = np.random.default_rng(11)
    corrected = naive = 0
    trials = 300
    for _ in range(trials):
        e = rng.normal(size=45)
        x = np.zeros(45)
        for i in range(1, 45):
            x[i] = 0.7 * x[i - 1] + e[i]
        corrected += modified_mann_kendall(x)["p"] < 0.05
        naive += modified_mann_kendall(x, correct_autocorrelation=False)["p"] < 0.05
    assert corrected < naive  # correction helps; it does NOT remove inflation at small n, so never overclaim


def test_mk_detects_real_trend():
    rng = np.random.default_rng(5)
    y = 0.3 * np.arange(45) + rng.normal(0, 1, 45)
    assert modified_mann_kendall(y)["p"] < 0.001


def test_event_lag_trend_needs_enough_events():
    assert event_lag_trend([])["status"] == "insufficient_events"


def test_demo_analysis_structure_and_strict_json():
    result = run_analysis("demo", n_surrogates=40)
    json.dumps(result, allow_nan=False)
    assert result["ready_for_scientific_claims"] is False
    assert result["source"]["mode"] == "synthetic_demonstration"
    assert result["audit"]["verdict"] in {"INCONCLUSIVE", "NO_SIGNIFICANT_TREND", "TREND_NOT_ROBUST", "TREND_SUPPORTED_EXPLORATORY"}
    assert len(result["sensitivity"]["cells"]) == 9
    assert result["period"]["usable_years"] >= 40


def test_surrogate_null_reproduces_lag_from_pure_smoothing():
    """A series whose 'root zone' is only a smoothed copy of the surface must NOT look anomalous against the null."""
    rng = np.random.default_rng(1)
    idx = pd.date_range("1981-01-01", "2025-12-31", freq="D")
    s = np.zeros(len(idx))
    e = rng.normal(size=len(idx))
    for i in range(1, len(idx)):
        s[i] = 0.95 * s[i - 1] + e[i]
    r = pd.Series(s).ewm(alpha=0.03).mean().to_numpy()
    frame = pd.DataFrame({"GWETTOP": 0.5 + 0.05 * s / s.std(), "GWETROOT": 0.5 + 0.05 * r / r.std()}, index=idx)
    result = analyze(frame, {"mode": "test"}, n_surrogates=60)
    p = result["null_model"]["p_values"]
    assert p["median_lag_greater_than_null"] > 0.05
    assert result["audit"]["verdict"] != "TREND_SUPPORTED_EXPLORATORY"


def test_transfer_fit_and_simulation_have_expected_shape():
    rng = np.random.default_rng(2)
    n = 365 * 12
    top = rng.uniform(0.01, 0.99, n)
    root = np.clip(pd.Series(top).ewm(alpha=0.1).mean().to_numpy(), 0.01, 0.99)
    fit = fit_transfer(top, root, np.ones(n, dtype=bool))
    sim = simulate_root(fit, np.random.default_rng(0))
    assert sim.shape == (n,) and np.all((sim >= 0) & (sim <= 1))


def test_chunk_windows_partition_range():
    windows = list(chunk_windows("1981-01-01", "2025-12-31"))
    assert windows[0][0] == pd.Timestamp("1981-01-01") and windows[-1][1] == pd.Timestamp("2025-12-31")
    assert all(b[0] == a[1] + pd.Timedelta(days=1) for a, b in zip(windows, windows[1:]))


def test_request_has_no_30_year_cap_and_uses_hy_precip_name():
    url = request_url(36, -97, "1981-01-01", "2025-12-31")
    assert "PRECTOT" in url and "PRECTOT%2C" not in url
    assert "PRECTOT" not in request_url(36, -97, "1981-01-01", "1990-12-31", include_precip=False)


class _Resp(SimpleNamespace):
    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError("http error")


def _payload(start, end, with_precip):
    days = pd.date_range(start, end).strftime("%Y%m%d")
    rng = np.random.default_rng(0)
    params = {n: {d: float(v) for d, v in zip(days, rng.uniform(0.2, 0.8, len(days)))} for n in ("GWETTOP", "GWETROOT", "GWETPROF", "T2M")}
    if with_precip:
        params["PRECTOT"] = {d: 1.0 for d in days}
    return {"properties": {"parameter": params}}


class _Session:
    """Rejects any request that includes the precipitation parameter (simulating an unknown-name 422)."""
    def __init__(self):
        self.calls = 0

    def get(self, url, **kw):
        self.calls += 1
        if "PRECTOT" in url:
            return _Resp(status_code=422, headers={"content-type": "application/json"}, content=b"{}", json=lambda: {})
        q = dict(p.split("=") for p in url.split("?")[1].split("&"))
        payload = _payload(pd.Timestamp(q["start"]), pd.Timestamp(q["end"]), False)
        return _Resp(status_code=200, headers={"content-type": "application/json"}, content=json.dumps(payload).encode(), json=lambda: payload)


def test_live_fetch_survives_rejected_precip_parameter_and_chunks(tmp_path):
    session = _Session()
    frame, meta = obtain_nasa(36, -97, "2000-01-01", "2012-12-31", cache_dir=tmp_path, session=session)
    assert meta["mode"] == "live_nasa" and len(meta["chunks"]) == 2
    assert frame["PRECIP"].isna().all() and frame["GWETROOT"].notna().all()


def test_live_fetch_falls_back_to_verified_cache(tmp_path):
    obtain_nasa(36, -97, "2000-01-01", "2012-12-31", cache_dir=tmp_path, session=_Session())

    class Offline:
        def get(self, *a, **k):
            raise ConnectionError("offline")
    frame, meta = obtain_nasa(36, -97, "2000-01-01", "2012-12-31", cache_dir=tmp_path, session=Offline())
    assert meta["mode"] == "verified_cached_nasa" and meta["cache_fallback"] is True


def test_missing_site_snapshot_is_reported(tmp_path):
    with pytest.raises(DataUnavailable):
        load_site("nowhere", [tmp_path])


def test_site_loader_rejects_tampered_csv(tmp_path):
    import hashlib
    (tmp_path / "processed").mkdir()
    (tmp_path / "manifests").mkdir()
    frame, _ = synthetic_demo()
    out = frame[["GWETTOP", "GWETROOT"]].reset_index()
    out["date"] = out["date"].dt.strftime("%Y-%m-%d")
    csv = tmp_path / "processed" / "s_1981_2025.csv"
    out.to_csv(csv, index=False)
    record = {"site": "s", "latitude": 1.0, "longitude": 2.0, "processed_csv": str(csv), "processed_sha256": hashlib.sha256(csv.read_bytes()).hexdigest(),
              "source_chunks": [{"sha256": "x", "url": "u", "retrieved_utc": "t"}]}
    (tmp_path / "manifests" / "s.json").write_text(json.dumps(record))
    loaded, meta = load_site("s", [tmp_path])
    assert meta["mode"] == "verified_prefetched_nasa" and "s" in list_sites([tmp_path])
    csv.write_text(csv.read_text().replace("1981-01-01", "1981-01-02", 1))
    with pytest.raises(IntegrityError):
        load_site("s", [tmp_path])


def test_annual_mismatch_days_are_attributed_to_actual_year():
    from rootshadow.recovery import annual_mismatch
    idx = pd.date_range("2020-12-20", "2021-01-20", freq="D")
    frame = pd.DataFrame({"top_pct": 0.70, "root_pct": 0.10}, index=idx)
    frame.loc["2021-01-10":, "root_pct"] = 0.70
    event = {
        "drought_start": "2020-11-01", "drought_end": "2020-12-19",
        "surface_recovery": "2020-12-29", "root_recovery": "2021-01-10",
        "status": "COMPLETE_SURFACE_FIRST", "recovery_delay_days": 12,
        "observed_mismatch_days": 12, "window_end": "2021-01-20",
    }
    records = annual_mismatch([event], [2020, 2021], frame)
    assert records[2020]["events"] == 1
    assert records[2021]["events"] == 0
    assert records[2020]["mismatch_days"] == 3
    assert records[2021]["mismatch_days"] == 9
    assert records[2020]["mismatch_days"] + records[2021]["mismatch_days"] == event["observed_mismatch_days"]

def test_censored_mismatch_days_cross_year_boundary():
    from rootshadow.recovery import annual_mismatch
    idx = pd.date_range("2020-12-20", "2021-01-20", freq="D")
    frame = pd.DataFrame({"top_pct": 0.70, "root_pct": 0.10}, index=idx)
    event = {
        "surface_recovery": "2020-12-29", "root_recovery": None,
        "status": "RIGHT_CENSORED_AT_RECORD_END", "recovery_delay_days": None,
        "observed_mismatch_days": 23, "window_end": "2021-01-20",
    }
    records = annual_mismatch([event], [2020, 2021], frame)
    assert records[2020]["mismatch_days"] == 3
    assert records[2021]["mismatch_days"] == 20
