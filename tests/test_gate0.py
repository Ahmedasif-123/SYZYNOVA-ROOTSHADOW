import hashlib
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from scripts.gate0_fetch import NASARequestError, build_site, fetch_bytes, process_chunk, request_url, validate_payload, verify_manifests, windows


def fake_payload():
    return {"properties": {"parameter": {
        "GWETTOP": {"20200101": 0.4, "20200102": 0.5},
        "GWETROOT": {"20200101": 0.2, "20200102": 0.3},
        "PRECTOT": {"20200101": 1.0, "20200102": 0.0},
        "T2M": {"20200101": 10.0, "20200102": 11.0},
    }}}


class FakeSession:
    def get(self, url, **kwargs):
        raw = json.dumps(fake_payload()).encode()
        return SimpleNamespace(content=raw, headers={"content-type": "application/json"}, raise_for_status=lambda: None)


def test_windows_are_nonoverlapping():
    assert list(windows(1981, 1995)) == [("19810101", "19901231"), ("19910101", "19951231")]


def test_url_uses_hydrology_parameters():
    url = request_url(35.5, -97.5, "20200101", "20201231")
    assert "community=HY" in url
    assert "GWETTOP%2CGWETROOT%2CPRECTOT%2CT2M" in url
    assert "time-standard=UTC" in url


def test_validated_payload():
    variables, dates, valid = validate_payload(fake_payload(), "20200101", "20200102")
    assert dates == ["20200101", "20200102"]
    assert valid == 2
    assert variables["GWETROOT"]["20200102"] == 0.3


def test_bad_soil_values_are_rejected():
    payload = fake_payload()
    payload["properties"]["parameter"]["GWETROOT"]["20200102"] = 1.3
    with pytest.raises(ValueError, match="Invalid fractional"):
        validate_payload(payload, "20200101", "20200102")


def test_manifest_and_corruption_detection(tmp_path):
    p = build_site("us_oklahoma", tmp_path, 2020, 2020, FakeSession())
    data = json.loads(p.read_text())
    raw = Path(data["source_chunks"][0]["path"])
    assert hashlib.sha256(raw.read_bytes()).hexdigest() == data["source_chunks"][0]["sha256"]
    assert verify_manifests(tmp_path) == (1, 1)
    raw.write_bytes(raw.read_bytes() + b" ")
    with pytest.raises(ValueError, match="corrupted"):
        verify_manifests(tmp_path)


def test_null_soil_values_do_not_count_as_valid():
    payload = fake_payload()
    payload["properties"]["parameter"]["GWETTOP"]["20200102"] = None
    _, _, valid = validate_payload(payload, "20200101", "20200102")
    assert valid == 1


def test_boolean_or_nonfinite_readings_are_rejected():
    payload = fake_payload()
    payload["properties"]["parameter"]["GWETROOT"]["20200102"] = float("nan")
    with pytest.raises(ValueError, match="Non-numeric or non-finite"):
        validate_payload(payload, "20200101", "20200102")
    payload["properties"]["parameter"]["GWETROOT"]["20200102"] = True
    with pytest.raises(ValueError, match="Non-numeric or non-finite"):
        validate_payload(payload, "20200101", "20200102")


def test_http_422_reports_exact_nasa_validation_message():
    class Rejected:
        status_code = 422
        headers = {"content-type": "application/json"}
        content = b'{"messages":["Invalid community selection"]}'

        def json(self):
            return {"messages": ["Invalid community selection"]}

    class BrokenSession:
        def __init__(self):
            self.calls = 0

        def get(self, url, **kwargs):
            self.calls += 1
            return Rejected()

    session = BrokenSession()
    with pytest.raises(NASARequestError, match="Invalid community selection"):
        fetch_bytes("https://power.larc.nasa.gov/api/test", session=session)
    assert session.calls == 1


def test_hy_rejection_falls_back_to_ag_and_normalizes_precipitation(tmp_path):
    class AGSession:
        def __init__(self):
            self.urls = []

        def get(self, url, **kwargs):
            self.urls.append(url)
            if "community=HY" in url:
                return SimpleNamespace(status_code=422, content=b'{"messages":["HY not available"]}', headers={"content-type": "application/json"}, json=lambda: {"messages": ["HY not available"]})
            payload = fake_payload()
            payload["properties"]["parameter"]["PRECTOTCORR"] = payload["properties"]["parameter"].pop("PRECTOT")
            data = json.dumps(payload).encode()
            return SimpleNamespace(status_code=200, content=data, headers={"content-type": "application/json"}, raise_for_status=lambda: None)

    session = AGSession()
    record, data, profile = process_chunk("us_oklahoma", 35.5, -97.5, "20200101", "20200102", tmp_path, session)
    assert session.urls[0].find("community=HY") >= 0
    assert session.urls[1].find("community=AG") >= 0
    assert data["PRECTOT"]["20200101"] == 1.0
    assert record["community"] == "AG"
    assert "PRECTOTCORR" in record["source_variables"]
    assert record["sha256"] == hashlib.sha256(Path(record["path"]).read_bytes()).hexdigest()
    assert profile[0] == "AG"

def test_all_422_failures_report_server_reasons(tmp_path):
    class Fails:
        def get(self, url, **kwargs):
            return SimpleNamespace(status_code=422, content=b'{"messages":["date range not supported"]}', headers={"content-type": "application/json"}, json=lambda: {"messages": ["date range not supported"]})

    with pytest.raises(RuntimeError, match="date range not supported"):
        process_chunk("us_oklahoma", 35.5, -97.5, "19810101", "19901231", tmp_path, Fails())
