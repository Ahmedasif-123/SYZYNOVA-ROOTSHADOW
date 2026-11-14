import pytest

pytest.importorskip("fastapi")
from fastapi.testclient import TestClient  # noqa: E402
from local_server import app  # noqa: E402


def test_demo_endpoint_returns_usable_json():
    response = TestClient(app).get("/api/analyze", params={"mode": "demo"})
    assert response.status_code == 200
    body = response.json()
    assert body["source"]["mode"] == "synthetic_demonstration"
    assert "audit" in body and "lag_trend" in body


def test_bad_date_rejected_without_external_request():
    response = TestClient(app).get("/api/analyze", params={"mode": "live", "start": "2024-01-01", "end": "2020-01-01"})
    assert response.status_code == 400


def test_site_mode_requires_site():
    assert TestClient(app).get("/api/analyze", params={"mode": "site"}).status_code == 400


def test_sites_endpoint():
    assert "sites" in TestClient(app).get("/api/sites").json()
