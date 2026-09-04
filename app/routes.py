"""HTTP surface for the chart and chat services.

The API provides deterministic astrological calculations, city lookup,
and grounded conversation endpoints.
"""

from __future__ import annotations

import logging
from typing import Any

from flask import Blueprint, jsonify, request

from app import db
from app.schemas import RequestValidationError, parse_birth_data
from app.services import chat_service
from app.services.astrology import (
    AYANAMSA_NAME,
    AstrologyError,
    CalculationError,
    DashaRangeError,
    EphemerisRangeError,
    InvalidBirthDataError,
    calculate_chart,
    calculate_transits,
)
from app.services.geo import search_cities
from app.services.llm import LLMError, MissingAPIKeyError

logger = logging.getLogger(__name__)

bp = Blueprint("api", __name__)


def _error(message: str, status: int, kind: str) -> tuple[Any, int]:
    """Uniform error envelope. Never returns a partial or guessed chart."""
    return jsonify({"error": {"type": kind, "message": message}}), status


@bp.get("/health")
def health() -> tuple[Any, int]:
    """Liveness probe. Does no ephemeris work."""
    return jsonify({"status": "ok", "ayanamsa": AYANAMSA_NAME}), 200


@bp.post("/api/v1/chart")
def chart() -> tuple[Any, int]:
    """Compute a D1 chart plus Vimshottari dasha state from birth data."""
    payload = request.get_json(silent=True)
    if payload is None:
        return _error(
            "request body must be valid JSON with Content-Type: application/json",
            400,
            "invalid_request",
        )

    try:
        birth = parse_birth_data(payload)
    except RequestValidationError as exc:
        return _error(str(exc), 400, "invalid_request")
    except EphemerisRangeError as exc:
        # A well-formed date we simply cannot compute -- distinct from a
        # malformed one, so it gets 422 rather than 400.
        return _error(str(exc), 422, "ephemeris_range")

    try:
        result = calculate_chart(birth)
    except EphemerisRangeError as exc:
        # Client asked for a moment we cannot compute. Say so plainly rather
        # than returning a chart that would be quietly wrong.
        return _error(str(exc), 422, "ephemeris_range")
    except DashaRangeError as exc:
        return _error(str(exc), 422, "dasha_range")
    except InvalidBirthDataError as exc:
        return _error(str(exc), 400, "invalid_request")
    except CalculationError as exc:
        # The engine returned something we refuse to vouch for.
        logger.exception("chart calculation produced untrustworthy output")
        return _error(str(exc), 500, "calculation_failed")

    return jsonify(result), 200


@bp.get("/api/v1/geo/search")
def geo_search() -> tuple[Any, int]:
    """Offline city autocomplete search."""
    q = request.args.get("q", "").strip()
    limit = min(max(request.args.get("limit", 10, type=int), 1), 50)
    results = search_cities(q, limit=limit)
    return jsonify({"results": results}), 200


@bp.post("/api/v1/chat")
def chat() -> tuple[Any, int]:
    """Handle one conversation turn end-to-end with the grounded AI companion."""
    payload = request.get_json(silent=True)
    if payload is None or not isinstance(payload, dict):
        return _error(
            "request body must be a JSON object with 'birth' and 'message'",
            400,
            "invalid_request",
        )

    user_message = payload.get("message", "").strip()
    if not user_message:
        return _error("missing or empty 'message'", 400, "invalid_request")

    birth_payload = payload.get("birth")
    if birth_payload is None:
        return _error("missing required 'birth' object", 400, "invalid_request")

    try:
        birth = parse_birth_data(birth_payload)
    except RequestValidationError as exc:
        return _error(str(exc), 400, "invalid_request")
    except EphemerisRangeError as exc:
        return _error(str(exc), 422, "ephemeris_range")

    user_id = str(payload.get("user_id", db.DEFAULT_USER_ID)).strip() or db.DEFAULT_USER_ID
    connection = db.connect()

    try:
        result = chat_service.respond(connection, user_id, birth, user_message)
    except MissingAPIKeyError as exc:
        return _error(str(exc), 503, "missing_api_key")
    except LLMError as exc:
        return _error(str(exc), 502, "inference_failed")
    except EphemerisRangeError as exc:
        return _error(str(exc), 422, "ephemeris_range")
    except DashaRangeError as exc:
        return _error(str(exc), 422, "dasha_range")
    except AstrologyError as exc:
        logger.exception("astrology error during chat turn")
        return _error(str(exc), 500, "calculation_failed")

    return jsonify(result), 200


@bp.get("/api/v1/chat/history")
def chat_history() -> tuple[Any, int]:
    """Get recent conversation messages for a user."""
    user_id = request.args.get("user_id", db.DEFAULT_USER_ID).strip() or db.DEFAULT_USER_ID
    connection = db.connect()
    messages = db.recent_messages(connection, user_id)
    return jsonify({"user_id": user_id, "messages": messages}), 200


@bp.post("/api/v1/chat/reset")
def chat_reset() -> tuple[Any, int]:
    """Reset conversation history for a user."""
    payload = request.get_json(silent=True) or {}
    user_id = str(payload.get("user_id", db.DEFAULT_USER_ID)).strip() or db.DEFAULT_USER_ID
    connection = db.connect()
    cleared = db.clear_messages(connection, user_id)
    return jsonify({"status": "ok", "user_id": user_id, "cleared": cleared}), 200


@bp.post("/api/v1/chat/prompt")
def chat_prompt() -> tuple[Any, int]:
    """Inspect the exact prompt the model receives (the /facts equivalent)."""
    payload = request.get_json(silent=True)
    if payload is None or not isinstance(payload, dict):
        return _error("request body must be valid JSON", 400, "invalid_request")

    birth_payload = payload.get("birth")
    if birth_payload is None:
        return _error("missing required 'birth' object", 400, "invalid_request")

    try:
        birth = parse_birth_data(birth_payload)
    except RequestValidationError as exc:
        return _error(str(exc), 400, "invalid_request")
    except EphemerisRangeError as exc:
        return _error(str(exc), 422, "ephemeris_range")

    user_id = str(payload.get("user_id", db.DEFAULT_USER_ID)).strip() or db.DEFAULT_USER_ID
    connection = db.connect()

    try:
        chart_data = chat_service.ensure_chart(connection, user_id, birth)
        transits_data = calculate_transits(birth, chart_data["ascendant"]["sign"])
        history = db.recent_messages(connection, user_id)
        prompt = chat_service.build_system_prompt(chart_data, transits_data, history)
    except EphemerisRangeError as exc:
        return _error(str(exc), 422, "ephemeris_range")
    except DashaRangeError as exc:
        return _error(str(exc), 422, "dasha_range")
    except AstrologyError as exc:
        return _error(str(exc), 500, "calculation_failed")

    return jsonify({"prompt": prompt}), 200

