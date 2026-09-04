"""HTTP surface for the chart service.

The API returns facts only. There is no generated prose here and no LLM in the
path -- interpretation is a separate concern built on top of this output.
"""

from __future__ import annotations

import logging
from typing import Any

from flask import Blueprint, jsonify, request

from app.schemas import RequestValidationError, parse_birth_data
from app.services.astrology import (
    AYANAMSA_NAME,
    CalculationError,
    EphemerisRangeError,
    InvalidBirthDataError,
    calculate_chart,
)
from app.services.geo import search_cities

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
