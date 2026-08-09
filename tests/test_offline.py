"""Proof that a chart calculation makes no network call.

PyJHora's `jhora.utils` imports `geocoder` and `geopy.geocoders.Nominatim` at
module scope, both of which are HTTP clients, and the library exposes helpers
that geolocate by IP or place name. This service never calls those helpers --
it takes latitude, longitude and offset directly -- but "never calls" is a
claim worth enforcing rather than asserting.

The test below replaces `socket.socket` with a type that raises on
construction, so any attempt to open a connection fails the test loudly.
"""

from __future__ import annotations

import datetime as _dt
import socket

import pytest

from app.services.astrology import BirthData, calculate_chart


class NetworkAccessAttempted(AssertionError):
    """Raised if anything tries to open a socket during a calculation."""


@pytest.fixture
def no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    def _forbidden(*args, **kwargs):
        raise NetworkAccessAttempted(
            "the chart service attempted to open a network socket; it must run "
            "fully offline from the four supplied inputs"
        )

    monkeypatch.setattr(socket, "socket", _forbidden)
    monkeypatch.setattr(socket, "create_connection", _forbidden)
    # getaddrinfo is where a DNS lookup would surface even without a socket.
    monkeypatch.setattr(socket, "getaddrinfo", _forbidden)


def test_chart_calculation_opens_no_socket(no_network) -> None:
    birth = BirthData(
        date=_dt.date(1998, 5, 24), time=_dt.time(14, 40, 43),
        lat=28.6139, lon=77.2090, tz_offset=5.5,
    )
    result = calculate_chart(birth, as_of=_dt.date(2026, 8, 9))
    assert len(result["planets"]) == 9
    assert result["dasha"]["current_mahadasha"]["lord"]


def test_second_chart_also_opens_no_socket(no_network) -> None:
    """A different era and hemisphere exercises different engine code paths."""
    birth = BirthData(
        date=_dt.date(1869, 10, 2), time=_dt.time(7, 11, 54),
        lat=21.6417, lon=69.6293, tz_offset=69.6293 / 15.0,
    )
    result = calculate_chart(birth, as_of=_dt.date(1930, 3, 12))
    assert len(result["planets"]) == 9


def test_no_api_key_style_configuration_is_required() -> None:
    """Nothing in the service reads credentials from the environment.

    If this ever fails, a paid or authenticated dependency has crept in.
    """
    import inspect

    from app.services import astrology

    source = inspect.getsource(astrology)
    for forbidden in ("os.environ", "getenv", "api_key", "API_KEY", "requests."):
        assert forbidden not in source, f"unexpected {forbidden!r} in the service"
