import hashlib
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from scripts.gate0_fetch import build_site, request_url, validate_payload, verify_manifests, windows


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
