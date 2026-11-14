import json
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit

import pandas as pd
import pytest

from rootshadow.data import DataUnavailable, _fetch_chunk, validate_nasa_payload


def _payload(start="20200101", end="20200107"):
    days = pd.date_range(start, end).strftime("%Y%m%d")
    return {"properties": {"parameter": {
        "GWETTOP": {d: 0.3 for d in days},
        "GWETROOT": {d: 0.4 for d in days},
    }}}


def test_rejects_misaligned_soil_dates():
    payload = _payload()
    payload["properties"]["parameter"]["GWETROOT"].pop("20200103")
    with pytest.raises(DataUnavailable, match="date keys differ"):
        validate_nasa_payload(payload)


def test_rejects_missing_day_in_requested_period():
    payload = _payload()
    for series in payload["properties"]["parameter"].values():
        series.pop("20200103")
    with pytest.raises(DataUnavailable, match="incomplete or unexpected"):
        validate_nasa_payload(payload, pd.Timestamp("2020-01-01"), pd.Timestamp("2020-01-07"))


@pytest.mark.parametrize("invalid", [float("inf"), float("nan"), -0.2, 1.2, True, "0.5"])
def test_rejects_invalid_soil_wetness(invalid):
    payload = _payload()
    payload["properties"]["parameter"]["GWETROOT"]["20200103"] = invalid
    with pytest.raises(DataUnavailable, match="invalid GWETROOT"):
        validate_nasa_payload(payload)


def test_accepts_nasa_missing_value_marker_without_inventing_data():
    payload = _payload()
    payload["properties"]["parameter"]["GWETTOP"]["20200103"] = -999
    assert validate_nasa_payload(payload, pd.Timestamp("2020-01-01"), pd.Timestamp("2020-01-07"))


def test_rejected_server_response_is_not_cached(tmp_path):
    class TruncatedSession:
        def get(self, url, **kwargs):
            q = parse_qs(urlsplit(url).query)
            payload = _payload(q["start"][0], q["end"][0])
            for series in payload["properties"]["parameter"].values():
                series.pop(next(iter(series)))
            body = json.dumps(payload).encode()
            return SimpleNamespace(status_code=200, content=body, headers={"content-type": "application/json"},
                                   json=lambda: payload, raise_for_status=lambda: None)

    with pytest.raises(DataUnavailable, match="no verified cache"):
        _fetch_chunk(36.118, -97.091, pd.Timestamp("2020-01-01"), pd.Timestamp("2020-01-07"), tmp_path, TruncatedSession())
    assert not list(tmp_path.glob("*.json"))
