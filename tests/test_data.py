import hashlib
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))
from rootshadow.data import IntegrityError, _write_cache, parse_nasa, request_url, validate_request, verify_cache


def test_cache_integrity_rejects_altered_data(tmp_path):
    raw = tmp_path / "snapshot.json"
    manifest = tmp_path / "manifest.json"
    _write_cache(b'{"original":true}', "https://example.org/source", raw, manifest)
    result, meta = verify_cache(raw, manifest)
    assert result["original"] is True
    assert meta["sha256"] == hashlib.sha256(raw.read_bytes()).hexdigest()
    raw.write_text('{"original":false}', encoding="utf-8")
    with pytest.raises(IntegrityError):
        verify_cache(raw, manifest)


def test_url_is_pinned_to_nasa_and_encoded():
    url = request_url(25.3, 51.5, "2014-01-01", "2024-12-31")
    assert url.startswith("https://power.larc.nasa.gov/api/temporal/daily/point?")
    assert "community=AG" in url
    assert "PRECTOTCORR" in url
    assert "GWETTOP" in url


def test_invalid_coordinates_rejected():
    with pytest.raises(ValueError):
        validate_request(105, 51, "2014-01-01", "2024-12-31")


def test_nasa_parser_handles_missing_values():
    dates = [str(20150101 + i) for i in range(5)]
    dates = ["20150101", "20150102", "20150103", "20150104"]
    source = {name: {date: 0.5 for date in dates} for name in ("GWETTOP", "GWETROOT", "GWETPROF", "PRECTOT", "T2M")}
    source["GWETTOP"]["20150102"] = -999
    data = {"properties": {"parameter": source}}
    with pytest.raises(Exception, match="Too few"):
        parse_nasa(data)
