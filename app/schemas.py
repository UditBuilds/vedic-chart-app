"""Request parsing for the chart endpoint.

Kept separate from :mod:`app.services.astrology` so that swapping the
calculation engine does not touch the wire contract, and so that "the input
was malformed" stays clearly distinguishable from "the calculation failed".
"""

from __future__ import annotations

import datetime as _dt
from typing import Any

from app.services.astrology import BirthData, InvalidBirthDataError

#: Every field is mandatory in v1. Birth time in particular has no fallback --
#: an unknown-birth-time strategy is a separate design decision, not something
#: to improvise by defaulting to noon.
REQUIRED_FIELDS: tuple[str, ...] = ("date", "time", "lat", "lon", "tz_offset")

_DATE_FORMAT = "%Y-%m-%d"
_TIME_FORMATS = ("%H:%M:%S", "%H:%M")


class RequestValidationError(ValueError):
    """The request body could not be turned into a :class:`BirthData`."""


def _require_number(payload: dict[str, Any], field: str) -> float:
    """Coerce a JSON field to float, rejecting bools and non-numeric strings."""
    value = payload[field]
    # bool is a subclass of int; `True` must not silently become latitude 1.0.
    if isinstance(value, bool):
        raise RequestValidationError(f"'{field}' must be a number, got a boolean")
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError as exc:
            raise RequestValidationError(
                f"'{field}' must be a number, got {value!r}"
            ) from exc
    raise RequestValidationError(
        f"'{field}' must be a number, got {type(value).__name__}"
    )


def parse_birth_data(payload: Any) -> BirthData:
    """Turn a decoded JSON body into a validated :class:`BirthData`.

    :raises RequestValidationError: Any field missing, mistyped or out of range.
    """
    if not isinstance(payload, dict):
        raise RequestValidationError(
            f"request body must be a JSON object, got {type(payload).__name__}"
        )

    missing = [f for f in REQUIRED_FIELDS if f not in payload or payload[f] is None]
    if missing:
        raise RequestValidationError(
            f"missing required field(s): {', '.join(missing)}. "
            f"All of {', '.join(REQUIRED_FIELDS)} are required; birth time has no default."
        )

    raw_date = payload["date"]
    if not isinstance(raw_date, str):
        raise RequestValidationError("'date' must be a string formatted YYYY-MM-DD")
    try:
        birth_date = _dt.datetime.strptime(raw_date.strip(), _DATE_FORMAT).date()
    except ValueError as exc:
        raise RequestValidationError(
            f"'date' must be formatted YYYY-MM-DD, got {raw_date!r}"
        ) from exc

    raw_time = payload["time"]
    if not isinstance(raw_time, str):
        raise RequestValidationError("'time' must be a string formatted HH:MM:SS")
    birth_time: _dt.time | None = None
    for fmt in _TIME_FORMATS:
        try:
            birth_time = _dt.datetime.strptime(raw_time.strip(), fmt).time()
            break
        except ValueError:
            continue
    if birth_time is None:
        raise RequestValidationError(
            f"'time' must be formatted HH:MM:SS (24-hour), got {raw_time!r}"
        )

    latitude = _require_number(payload, "lat")
    longitude = _require_number(payload, "lon")
    tz_offset = _require_number(payload, "tz_offset")

    try:
        return BirthData(
            date=birth_date,
            time=birth_time,
            lat=latitude,
            lon=longitude,
            tz_offset=tz_offset,
        )
    except InvalidBirthDataError as exc:
        # Range problems detected by the domain type are still client errors.
        raise RequestValidationError(str(exc)) from exc
