"""HTTP layer: contract shape and error handling."""

from __future__ import annotations

import pytest

from app import create_app

VALID_PAYLOAD = {
    "date": "1998-05-24",
    "time": "14:40:43",
    "lat": 28.6139,
    "lon": 77.2090,
    "tz_offset": 5.5,
}


@pytest.fixture(scope="module")
def client():
    app = create_app()
    app.config.update(TESTING=True)
    return app.test_client()


def test_health_reports_the_ayanamsa(client) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.get_json() == {"status": "ok", "ayanamsa": "Lahiri"}


def test_chart_returns_the_documented_contract(client) -> None:
    response = client.post("/api/v1/chart", json=VALID_PAYLOAD)
    assert response.status_code == 200
    body = response.get_json()

    assert set(body) >= {
        "input_echo", "ayanamsa", "ascendant", "planets", "moon_rashi", "dasha",
    }
    assert body["input_echo"] == VALID_PAYLOAD
    assert len(body["planets"]) == 9
    assert body["dasha"]["system"] == "Vimshottari"
    assert len(body["dasha"]["full_mahadasha_timeline"]) == 9
    for key in ("current_mahadasha", "current_antardasha"):
        assert set(body["dasha"][key]) == {"lord", "start", "end"}


def test_response_contains_no_generated_prose(client) -> None:
    """This service returns facts. Interpretation belongs to a later layer."""
    body = response_json = client.post("/api/v1/chart", json=VALID_PAYLOAD).get_json()
    assert "interpretation" not in body
    assert "summary" not in body
    assert "text" not in body
    # No free-text field should be long enough to be a sentence.
    for planet in response_json["planets"]:
        for value in planet.values():
            if isinstance(value, str):
                assert len(value.split()) <= 3


@pytest.mark.parametrize("missing", list(VALID_PAYLOAD))
def test_every_field_is_required(client, missing) -> None:
    payload = {k: v for k, v in VALID_PAYLOAD.items() if k != missing}
    response = client.post("/api/v1/chart", json=payload)
    assert response.status_code == 400
    assert missing in response.get_json()["error"]["message"]


def test_null_field_is_rejected(client) -> None:
    response = client.post("/api/v1/chart", json={**VALID_PAYLOAD, "time": None})
    assert response.status_code == 400


@pytest.mark.parametrize("bad_date", ["24-05-1998", "1998/05/24", "not-a-date", "1998-13-01"])
def test_malformed_date_is_rejected(client, bad_date) -> None:
    response = client.post("/api/v1/chart", json={**VALID_PAYLOAD, "date": bad_date})
    assert response.status_code == 400
    assert "date" in response.get_json()["error"]["message"]


@pytest.mark.parametrize("bad_time", ["2:40 PM", "25:00:00", "noon"])
def test_malformed_time_is_rejected(client, bad_time) -> None:
    response = client.post("/api/v1/chart", json={**VALID_PAYLOAD, "time": bad_time})
    assert response.status_code == 400
    assert "time" in response.get_json()["error"]["message"]


def test_hh_mm_time_is_accepted(client) -> None:
    response = client.post("/api/v1/chart", json={**VALID_PAYLOAD, "time": "14:40"})
    assert response.status_code == 200


def test_boolean_is_not_accepted_as_a_number(client) -> None:
    """`True` must not silently become latitude 1.0."""
    response = client.post("/api/v1/chart", json={**VALID_PAYLOAD, "lat": True})
    assert response.status_code == 400


@pytest.mark.parametrize("field,value", [("lat", 91.0), ("lon", 200.0), ("tz_offset", 20.0)])
def test_out_of_range_values_are_rejected(client, field, value) -> None:
    response = client.post("/api/v1/chart", json={**VALID_PAYLOAD, field: value})
    assert response.status_code == 400
    assert field in response.get_json()["error"]["message"]


def test_date_outside_the_ephemeris_returns_422_naming_the_range(client) -> None:
    response = client.post("/api/v1/chart", json={**VALID_PAYLOAD, "date": "5000-01-01"})
    assert response.status_code == 422
    message = response.get_json()["error"]["message"]
    assert response.get_json()["error"]["type"] == "ephemeris_range"
    assert "2999" in message


def test_non_json_body_is_rejected(client) -> None:
    response = client.post("/api/v1/chart", data="not json",
                           content_type="text/plain")
    assert response.status_code == 400


def test_json_array_body_is_rejected(client) -> None:
    response = client.post("/api/v1/chart", json=[1, 2, 3])
    assert response.status_code == 400


def test_numeric_strings_are_accepted(client) -> None:
    """Form-style clients send everything as strings."""
    payload = {k: str(v) for k, v in VALID_PAYLOAD.items()}
    response = client.post("/api/v1/chart", json=payload)
    assert response.status_code == 200


def test_repeated_requests_are_identical(client) -> None:
    """Guards the process-global engine state PyJHora is prone to leaking."""
    first = client.post("/api/v1/chart", json=VALID_PAYLOAD).get_json()
    for _ in range(3):
        assert client.post("/api/v1/chart", json=VALID_PAYLOAD).get_json() == first
