"""Gochar (transit) positions read against the natal ascendant.

The AstroSage figures below were captured on 2026-08-10 by casting a chart at
the transit instant itself -- a chart for "now" *is* the current planetary
position -- with the same matched inputs used elsewhere in this repo
(28:37:N, 77:13:E, TZ 5.5, ayanamsa "N.C.Lahiri").
"""

from __future__ import annotations

import datetime as _dt

import pytest

from app.services.astrology import (
    NAKSHATRA_NAMES,
    PLANET_NAMES,
    SIGN_NAMES,
    BirthData,
    InvalidBirthDataError,
    calculate_chart,
    calculate_transits,
)

REFERENCE_BIRTH = BirthData(
    date=_dt.date(1998, 5, 24), time=_dt.time(14, 40, 43),
    lat=28.6139, lon=77.2090, tz_offset=5.5,
)
NATAL_ASCENDANT = "Virgo"

#: 2026-08-10 06:00 UTC == 11:30 IST, the instant the AstroSage chart was cast.
TRANSIT_INSTANT = _dt.datetime(2026, 8, 10, 6, 0, 0, tzinfo=_dt.timezone.utc)

#: AstroSage's displayed signs at that instant.
ASTROSAGE_SIGNS = {
    "Sun": "Cancer", "Moon": "Gemini", "Mars": "Gemini", "Mercury": "Cancer",
    "Jupiter": "Cancer", "Venus": "Virgo", "Saturn": "Pisces",
    "Rahu": "Aquarius", "Ketu": "Leo",
}
ASTROSAGE_MOON_NAKSHATRA = "Ardra"
ASTROSAGE_MOON_PADA = 4

#: AstroSage panchang, New Delhi 10 Aug 2026: "Nakshatra: Ardra upto 12:27:45".
ARDRA_ENDS_IST = _dt.datetime(2026, 8, 10, 12, 27, 45)
ARDRA_ENDS_UTC = ARDRA_ENDS_IST - _dt.timedelta(hours=5.5)


@pytest.fixture(scope="module")
def transits() -> dict:
    return calculate_transits(REFERENCE_BIRTH, NATAL_ASCENDANT, at=TRANSIT_INSTANT)


# ------------------------------------------------------------------- shape

def test_all_nine_grahas_present_in_order(transits) -> None:
    assert [p["name"] for p in transits["planets"]] == list(PLANET_NAMES)


def test_each_transit_row_has_only_position_and_house(transits) -> None:
    """Scope guard: position + house only, no scoring, no aspects."""
    for planet in transits["planets"]:
        assert set(planet) == {"name", "sign", "house_from_ascendant"}
        assert planet["sign"] in SIGN_NAMES
        assert 1 <= planet["house_from_ascendant"] <= 12


def test_as_of_is_the_local_date_at_the_birth_place(transits) -> None:
    assert transits["as_of"] == "2026-08-10"


def test_moon_nakshatra_and_pada_are_reported(transits) -> None:
    assert transits["moon_nakshatra"] in NAKSHATRA_NAMES
    assert 1 <= transits["moon_pada"] <= 4


# ------------------------------------------------------- against AstroSage

def test_every_transit_sign_matches_astrosage(transits) -> None:
    actual = {p["name"]: p["sign"] for p in transits["planets"]}
    assert actual == ASTROSAGE_SIGNS


def test_transiting_moon_nakshatra_matches_astrosage(transits) -> None:
    assert transits["moon_nakshatra"] == ASTROSAGE_MOON_NAKSHATRA
    assert transits["moon_pada"] == ASTROSAGE_MOON_PADA


def test_nakshatra_changes_when_astrosage_says_it_does() -> None:
    """The Moon's nakshatra is the fastest-moving fact we publish.

    AstroSage's panchang puts the Ardra -> Punarvasu handover at 12:27:45 IST.
    Bracketing it is a far stronger check than a single midday sample, because
    it pins the Moon's *rate* as well as its position.
    """
    before = calculate_transits(
        REFERENCE_BIRTH, NATAL_ASCENDANT,
        at=ARDRA_ENDS_UTC.replace(tzinfo=_dt.timezone.utc) - _dt.timedelta(minutes=5),
    )
    after = calculate_transits(
        REFERENCE_BIRTH, NATAL_ASCENDANT,
        at=ARDRA_ENDS_UTC.replace(tzinfo=_dt.timezone.utc) + _dt.timedelta(minutes=5),
    )
    assert before["moon_nakshatra"] == "Ardra"
    assert after["moon_nakshatra"] == "Punarvasu"


def test_nakshatra_handover_is_within_two_minutes_of_astrosage() -> None:
    """Binary-search our own handover instant and compare. Observed: 28 seconds."""
    low = ARDRA_ENDS_UTC.replace(tzinfo=_dt.timezone.utc) - _dt.timedelta(hours=1)
    high = ARDRA_ENDS_UTC.replace(tzinfo=_dt.timezone.utc) + _dt.timedelta(hours=1)
    while (high - low).total_seconds() > 1:
        middle = low + (high - low) / 2
        if calculate_transits(REFERENCE_BIRTH, NATAL_ASCENDANT, at=middle)["moon_nakshatra"] == "Ardra":
            low = middle
        else:
            high = middle
    drift = abs((low - ARDRA_ENDS_UTC.replace(tzinfo=_dt.timezone.utc)).total_seconds())
    assert drift < 120, f"handover is {drift:.0f}s from AstroSage's 12:27:45 IST"


# -------------------------------------------------------- house derivation

def test_houses_are_counted_from_the_natal_ascendant(transits) -> None:
    """Gochar convention: houses come from the natal lagna, not a fresh chart.

    At this instant AstroSage's *transit-moment* ascendant is Libra, while our
    houses are counted from the natal Virgo. That difference is the whole point
    of the convention, so it is asserted rather than treated as a mismatch.
    """
    ascendant_index = SIGN_NAMES.index(NATAL_ASCENDANT)
    for planet in transits["planets"]:
        expected = (SIGN_NAMES.index(planet["sign"]) - ascendant_index) % 12 + 1
        assert planet["house_from_ascendant"] == expected, planet["name"]


def test_a_planet_in_the_rising_sign_is_in_house_one(transits) -> None:
    for planet in transits["planets"]:
        if planet["sign"] == NATAL_ASCENDANT:
            assert planet["house_from_ascendant"] == 1


def test_nodes_stay_six_houses_apart(transits) -> None:
    by_name = {p["name"]: p for p in transits["planets"]}
    separation = (
        by_name["Ketu"]["house_from_ascendant"] - by_name["Rahu"]["house_from_ascendant"]
    ) % 12
    assert separation == 6


def test_a_different_natal_ascendant_shifts_every_house() -> None:
    """Houses must track the ascendant they are counted from."""
    virgo = calculate_transits(REFERENCE_BIRTH, "Virgo", at=TRANSIT_INSTANT)
    aries = calculate_transits(REFERENCE_BIRTH, "Aries", at=TRANSIT_INSTANT)
    for a, b in zip(virgo["planets"], aries["planets"]):
        assert a["sign"] == b["sign"], "signs must not depend on the ascendant"
        offset = (b["house_from_ascendant"] - a["house_from_ascendant"]) % 12
        assert offset == (SIGN_NAMES.index("Virgo") - SIGN_NAMES.index("Aries")) % 12


def test_unknown_ascendant_sign_is_rejected() -> None:
    with pytest.raises(InvalidBirthDataError, match="unknown ascendant sign"):
        calculate_transits(REFERENCE_BIRTH, "Ophiuchus", at=TRANSIT_INSTANT)


# ------------------------------------------------------------- integration

def test_chart_output_carries_transits() -> None:
    chart = calculate_chart(
        REFERENCE_BIRTH, as_of=_dt.date(2026, 8, 9), transits_at=TRANSIT_INSTANT
    )
    assert chart["transits"]["as_of"] == "2026-08-10"
    assert len(chart["transits"]["planets"]) == 9


def test_adding_transits_left_the_natal_chart_untouched() -> None:
    """This phase adds a field; nothing else may move.

    Everything except ``transits`` must be exactly what the service produced
    before transits existed.
    """
    chart = calculate_chart(
        REFERENCE_BIRTH, as_of=_dt.date(2026, 8, 9), transits_at=TRANSIT_INSTANT
    )
    natal_only = {k: v for k, v in chart.items() if k != "transits"}

    expected_keys = {
        "input_echo", "ayanamsa", "house_system", "ascendant",
        "planets", "moon_rashi", "dasha",
    }
    assert set(natal_only) == expected_keys
    assert natal_only["ascendant"] == {
        "sign": "Virgo", "degree": 12.032826, "nakshatra": "Hasta", "pada": 1,
    }
    assert natal_only["moon_rashi"] == "Aries"
    assert natal_only["dasha"]["current_mahadasha"] == {
        "lord": "Mars", "start": "2025-07-05", "end": "2032-07-05",
    }


def test_natal_positions_do_not_move_when_the_transit_time_does() -> None:
    """Guards against the transit path leaking engine state into the natal one."""
    first = calculate_chart(
        REFERENCE_BIRTH, as_of=_dt.date(2026, 8, 9),
        transits_at=_dt.datetime(2026, 1, 1, tzinfo=_dt.timezone.utc),
    )
    second = calculate_chart(
        REFERENCE_BIRTH, as_of=_dt.date(2026, 8, 9),
        transits_at=_dt.datetime(2026, 12, 31, tzinfo=_dt.timezone.utc),
    )
    assert {k: v for k, v in first.items() if k != "transits"} == \
           {k: v for k, v in second.items() if k != "transits"}
    assert first["transits"] != second["transits"]


def test_transits_actually_move_over_time() -> None:
    """A day apart the Moon must have moved; a slow planet need not have."""
    day_one = calculate_transits(REFERENCE_BIRTH, NATAL_ASCENDANT, at=TRANSIT_INSTANT)
    day_two = calculate_transits(
        REFERENCE_BIRTH, NATAL_ASCENDANT, at=TRANSIT_INSTANT + _dt.timedelta(days=1)
    )
    assert day_one["moon_nakshatra"] != day_two["moon_nakshatra"]
