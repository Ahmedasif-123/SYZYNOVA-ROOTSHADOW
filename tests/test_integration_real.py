import hashlib
import json
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from local_server import app
from rootshadow.data import IntegrityError, default_data_dirs, list_sites, load_site, obtain_nasa


SITES = {"us_sgp_stillwater", "us_sgp_goodwell", "australia_narrabri", "spain_cordoba"}


def test_bundled_nasa_data_is_accessible_and_verified():
    base = Path(__file__).resolve().parents[1] / "api" / "data" / "gate0"
    assert set(list_sites([base])) == SITES
    for site in SITES:
        frame, meta = load_site(site, [base])
        assert meta["mode"] == "verified_prefetched_nasa"
        assert len(frame) == 16436
        assert int(frame[["GWETTOP", "GWETROOT"]].notna().all(axis=1).sum()) == 16436
        assert len(meta["chunks"]) == 5
        assert meta["sha256"]


def test_bundled_site_is_available_through_api():
    client = TestClient(app)
    result = client.get("/api/sites")
    assert result.status_code == 200
    assert set(result.json()["sites"]) == SITES
    response = client.get("/api/analyze", params={"mode": "site", "site": "us_sgp_goodwell"})
    assert response.status_code == 200
    data = response.json()
    assert data["source"]["mode"] == "verified_prefetched_nasa"
    assert data["period"]["days"] == 16436
    assert data["audit"]["verdict"] == "TREND_SUPPORTED_EXPLORATORY"
    assert data["ready_for_scientific_claims"] is False


def test_api_rejects_unknown_site_without_fallback_to_demo():
    r = TestClient(app).get("/api/analyze", params={"mode": "site", "site": "not_a_real_site"})
    assert r.status_code == 503
    assert "No prefetched NASA snapshot" in r.json()["detail"]


def test_api_client_uses_verified_ag_profile_and_corrected_precipitation(tmp_path):
    class AGSession:
        def __init__(self):
            self.urls = []

        def get(self, url, **kwargs):
            self.urls.append(url)
            query = parse_qs(urlsplit(url).query)
            if query["community"][0] != "AG":
                return SimpleNamespace(status_code=422, json=lambda: {"messages": ["bad community"]})
            dates = pd.date_range(pd.Timestamp(query["start"][0]), pd.Timestamp(query["end"][0]), freq="D")
            names = query["parameters"][0].split(",")
            params = {name: {d.strftime("%Y%m%d"): 0.5 if name.startswith("GWET") else 2.0 for d in dates} for name in names}
            content = json.dumps({"properties": {"parameter": params}}).encode()
            return SimpleNamespace(status_code=200, headers={"content-type": "application/json"}, content=content,
                                   json=lambda: json.loads(content), raise_for_status=lambda: None)

    session = AGSession()
    frame, meta = obtain_nasa(36.118, -97.091, "1991-01-01", "2001-12-31", cache_dir=tmp_path, session=session)
    assert all("community=AG" in url for url in session.urls)
    assert frame["PRECIP"].eq(2.0).all()
    assert frame[["GWETTOP", "GWETROOT"]].eq(0.5).all().all()
    assert meta["mode"] == "live_nasa"
    assert len(meta["chunks"]) == 2


def test_corrupted_compressed_snapshot_is_rejected(tmp_path):
    from gzip import compress
    base = tmp_path
    (base / "processed").mkdir()
    (base / "manifests").mkdir()
    csv = b"date,GWETTOP,GWETROOT\n19810101,0.2,0.3\n"
    (base / "processed" / "site_1981_2025.csv.gz").write_bytes(compress(csv))
    (base / "manifests" / "site_1981_2025.json").write_text(json.dumps({"site": "site", "processed_csv": "site_1981_2025.csv", "processed_sha256": hashlib.sha256(csv + b"changed").hexdigest(), "source_chunks": []}))
    with pytest.raises(IntegrityError):
        load_site("site", [base])


def test_default_site_data_search_matches_api_runtime_layout():
    from rootshadow import data as module
    api_dir = Path(module.__file__).resolve().parents[1]
    assert default_data_dirs()[0] == api_dir / "data" / "gate0"
