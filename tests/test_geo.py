"""Tests for the offline city lookup HTTP endpoint and geo service."""

from __future__ import annotations

import pytest
from app import create_app
from app.services.geo import search_cities


@pytest.fixture(scope="module")
def client():
    app = create_app()
    app.config.update(TESTING=True)
    return app.test_client()


def test_search_cities_direct() -> None:
    delhi = search_cities("delhi")
    assert len(delhi) > 0
    assert delhi[0]["name"] == "New Delhi"
    assert delhi[0]["tz_offset"] == 5.5

    ny = search_cities("new york")
    assert len(ny) > 0
    assert ny[0]["name"] == "New York"
    assert ny[0]["tz_offset"] == -5.0


def test_geo_search_endpoint_returns_matching_cities(client) -> None:
    res = client.get("/api/v1/geo/search?q=delhi")
    assert res.status_code == 200
    data = res.get_json()
    assert "results" in data
    results = data["results"]
    assert any(c["name"] == "New Delhi" and c["tz_offset"] == 5.5 for c in results)


def test_geo_search_endpoint_empty_query(client) -> None:
    res = client.get("/api/v1/geo/search?q=")
    assert res.status_code == 200
    assert res.get_json() == {"results": []}


def test_geo_search_endpoint_limit_clamped(client) -> None:
    res = client.get("/api/v1/geo/search?q=a&limit=2")
    assert res.status_code == 200
    assert len(res.get_json()["results"]) <= 2
