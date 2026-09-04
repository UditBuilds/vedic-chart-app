"""Tests for the web UI, chat, and geo lookup HTTP endpoints."""

from __future__ import annotations

import pytest
from unittest.mock import patch

from app import create_app, db

VALID_BIRTH = {
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



def test_geo_search_returns_matching_cities(client) -> None:
    """City search finds New Delhi, Mumbai, and New York with accurate offsets."""
    res_delhi = client.get("/api/v1/geo/search?q=delhi")
    assert res_delhi.status_code == 200
    results_delhi = res_delhi.get_json()["results"]
    assert any(c["name"] == "New Delhi" and c["tz_offset"] == 5.5 for c in results_delhi)

    res_ny = client.get("/api/v1/geo/search?q=new%20york")
    assert res_ny.status_code == 200
    results_ny = res_ny.get_json()["results"]
    assert any(c["name"] == "New York" and c["tz_offset"] == -5.0 for c in results_ny)


def test_geo_search_empty_query(client) -> None:
    response = client.get("/api/v1/geo/search?q=")
    assert response.status_code == 200
    assert response.get_json() == {"results": []}


def test_chat_endpoint_validates_input(client) -> None:
    # 1. Missing body
    res1 = client.post("/api/v1/chat", json=None)
    assert res1.status_code == 400

    # 2. Missing message
    res2 = client.post("/api/v1/chat", json={"birth": VALID_BIRTH})
    assert res2.status_code == 400
    assert "message" in res2.get_json()["error"]["message"]

    # 3. Missing birth data
    res3 = client.post("/api/v1/chat", json={"message": "hello"})
    assert res3.status_code == 400
    assert "birth" in res3.get_json()["error"]["message"]

    # 4. Out of range date
    invalid_birth = dict(VALID_BIRTH, date="3500-01-01")
    res4 = client.post("/api/v1/chat", json={"birth": invalid_birth, "message": "hello"})
    assert res4.status_code == 422


def test_chat_endpoint_with_mocked_llm(client) -> None:
    user_id = "test-api-user"
    mock_reply = "Your Sun is placed in Taurus in the 9th house."

    with patch("app.services.llm.complete", return_value=mock_reply):
        response = client.post(
            "/api/v1/chat",
            json={
                "user_id": user_id,
                "birth": VALID_BIRTH,
                "message": "Tell me about my Sun.",
            },
        )
        assert response.status_code == 200
        body = response.get_json()
        assert body["reply"] == mock_reply
        assert "FACTS:" in body["prompt"]
        assert "planets" in body["transits"]

    # Verify history
    history_res = client.get(f"/api/v1/chat/history?user_id={user_id}")
    assert history_res.status_code == 200
    history_body = history_res.get_json()
    assert len(history_body["messages"]) >= 2
    assert history_body["messages"][-2]["role"] == "user"
    assert history_body["messages"][-1]["role"] == "assistant"
    assert history_body["messages"][-1]["content"] == mock_reply

    # Test reset
    reset_res = client.post("/api/v1/chat/reset", json={"user_id": user_id})
    assert reset_res.status_code == 200
    assert reset_res.get_json()["status"] == "ok"

    # History should now be empty
    history_after = client.get(f"/api/v1/chat/history?user_id={user_id}").get_json()
    assert len(history_after["messages"]) == 0


def test_chat_prompt_endpoint(client) -> None:
    response = client.post("/api/v1/chat/prompt", json={"birth": VALID_BIRTH})
    assert response.status_code == 200
    body = response.get_json()
    assert "prompt" in body
    assert "FACTS:" in body["prompt"]
    assert "Natal:" in body["prompt"]
    assert "Ascendant (lagna): Virgo" in body["prompt"]
