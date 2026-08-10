"""Vimshottari dasha timeline maths.

This is the part of the service most likely to carry a silent off-by-one at a
period boundary, so it gets the most scrutiny. The tests below check:

    1. Structural invariants of the public timeline (order, contiguity, span).
    2. That period *durations* match the canonical Vimshottari allocations.
    3. Boundary behaviour at Julian Day precision -- including the fact that a
       dasha changes at a specific *instant*, not at midnight, so the lord in
       force on the changeover date depends on the time of day.

Point 3 is white-box on purpose: it reaches into the module's internal
intervals, because a date-granular assertion cannot distinguish "correct" from
"off by one day" when the switch happens mid-afternoon.
"""

from __future__ import annotations

import datetime as _dt

import pytest

from app.services import astrology as svc
from app.services.astrology import (
    _VIMSHOTTARI_TOTAL_YEARS,
    _VIMSHOTTARI_YEAR_DAYS,
    PLANET_NAMES,
    BirthData,
    calculate_chart,
)

# Reference nativity used throughout: 1998-05-24 14:40:43 IST, New Delhi.
REFERENCE_BIRTH = BirthData(
    date=_dt.date(1998, 5, 24),
    time=_dt.time(14, 40, 43),
    lat=28.6139,
    lon=77.2090,
    tz_offset=5.5,
)

#: Canonical Vimshottari allocations, in years. Sum == 120.
CANONICAL_YEARS: dict[str, int] = {
    "Ketu": 7, "Venus": 20, "Sun": 6, "Moon": 10, "Mars": 7,
    "Rahu": 18, "Jupiter": 16, "Saturn": 19, "Mercury": 17,
}

#: The fixed cyclic order of the mahadasha lords.
CANONICAL_ORDER: tuple[str, ...] = (
    "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
)

#: calculate_chart resolves a bare `as_of` date at local noon; the boundary
#: tests below need the same reference point to reason about changeover times.
_RESOLUTION_HOUR = 12.0


@pytest.fixture(scope="module")
def chart() -> dict:
    return calculate_chart(REFERENCE_BIRTH, as_of=_dt.date(2026, 8, 9))


@pytest.fixture(scope="module")
def timeline(chart) -> list[dict[str, str]]:
    return chart["dasha"]["full_mahadasha_timeline"]


@pytest.fixture(scope="module")
def intervals() -> tuple[list, list]:
    """Raw (lord, lord, start_jd, end_jd) intervals, at full JD precision."""
    jd = svc._local_julian_day(REFERENCE_BIRTH)
    with svc._ENGINE_LOCK:
        svc._drik.set_ayanamsa_mode(svc._AYANAMSA_MODE)
        return svc._dasha_intervals(jd, svc._place(REFERENCE_BIRTH))


def _as_date(value: str) -> _dt.date:
    return _dt.date.fromisoformat(value)


def _boundary_hour(jd: float) -> float:
    """Local time of day, in hours, at which a boundary JD falls."""
    return svc._jhora_utils.jd_to_gregorian(jd)[3]


# ---------------------------------------------------------------- structure

def test_canonical_years_sum_to_120() -> None:
    """Guards the reference table this module tests against."""
    assert sum(CANONICAL_YEARS.values()) == _VIMSHOTTARI_TOTAL_YEARS


def test_planet_names_cover_every_dasha_lord() -> None:
    assert set(CANONICAL_YEARS) == set(PLANET_NAMES)


def test_timeline_has_all_nine_lords_exactly_once(timeline) -> None:
    lords = [p["lord"] for p in timeline]
    assert len(lords) == 9
    assert set(lords) == set(CANONICAL_YEARS)


def test_timeline_follows_canonical_cyclic_order(timeline) -> None:
    """Lords must follow Ketu->Venus->Sun->... wrapping, starting anywhere."""
    lords = [p["lord"] for p in timeline]
    start = CANONICAL_ORDER.index(lords[0])
    expected = [CANONICAL_ORDER[(start + i) % 9] for i in range(9)]
    assert lords == expected


def test_timeline_is_contiguous_with_no_gaps_or_overlaps(timeline) -> None:
    """Each period must end exactly where the next begins.

    A gap means a date can fall into no dasha; an overlap means it falls into
    two. Either is the off-by-one this module exists to catch.
    """
    for earlier, later in zip(timeline, timeline[1:]):
        assert _as_date(earlier["end"]) == _as_date(later["start"]), (
            f"discontinuity between {earlier['lord']} and {later['lord']}: "
            f"{earlier['end']} != {later['start']}"
        )


def test_intervals_are_exactly_contiguous_in_julian_days(intervals) -> None:
    """Contiguity must hold at full precision, not merely after truncation."""
    mahadashas, antardashas = intervals
    for series in (mahadashas, antardashas):
        for earlier, later in zip(series, series[1:]):
            assert earlier[3] == later[2], (
                f"JD discontinuity: {earlier[3]!r} != {later[2]!r}"
            )


def test_each_period_matches_its_canonical_duration(timeline) -> None:
    """Duration in days must equal allotted_years * sidereal year, +/- a day.

    The one-day tolerance absorbs rounding when the engine's JD boundary is
    reduced to a calendar date; anything larger indicates a real error.
    """
    for period in timeline:
        span_days = (_as_date(period["end"]) - _as_date(period["start"])).days
        expected = CANONICAL_YEARS[period["lord"]] * _VIMSHOTTARI_YEAR_DAYS
        assert abs(span_days - expected) <= 1.0, (
            f"{period['lord']} spans {span_days}d, expected ~{expected:.2f}d"
        )


def test_full_cycle_spans_120_sidereal_years(timeline) -> None:
    total_days = (_as_date(timeline[-1]["end"]) - _as_date(timeline[0]["start"])).days
    expected = _VIMSHOTTARI_TOTAL_YEARS * _VIMSHOTTARI_YEAR_DAYS
    assert abs(total_days - expected) <= 1.0


def test_there_are_81_antardashas_nine_per_mahadasha(intervals) -> None:
    mahadashas, antardashas = intervals
    assert len(antardashas) == 81
    for maha in mahadashas:
        children = [a for a in antardashas if a[2] >= maha[2] and a[3] <= maha[3]]
        assert len(children) == 9, f"{PLANET_NAMES[maha[0]]} has {len(children)} antardashas"


def test_first_period_starts_before_birth(timeline) -> None:
    """The dasha running at birth began before it -- that is the 'balance'."""
    assert _as_date(timeline[0]["start"]) < REFERENCE_BIRTH.date
    assert _as_date(timeline[0]["end"]) > REFERENCE_BIRTH.date


def test_birth_moment_falls_inside_the_first_period(timeline) -> None:
    first = timeline[0]
    assert _as_date(first["start"]) <= REFERENCE_BIRTH.date < _as_date(first["end"])


# ----------------------------------------------------------- boundary logic

@pytest.mark.parametrize("boundary_index", range(8))
def test_day_after_boundary_is_the_incoming_lord(intervals, boundary_index) -> None:
    """One day past a changeover the new lord must be in force, unambiguously."""
    mahadashas, _ = intervals
    boundary_jd = mahadashas[boundary_index][3]
    boundary_date = svc._jd_to_date(boundary_jd)
    incoming = PLANET_NAMES[mahadashas[boundary_index + 1][0]]

    result = calculate_chart(REFERENCE_BIRTH, as_of=boundary_date + _dt.timedelta(days=1))
    assert result["dasha"]["current_mahadasha"]["lord"] == incoming


@pytest.mark.parametrize("boundary_index", range(8))
def test_day_before_boundary_is_the_outgoing_lord(intervals, boundary_index) -> None:
    """The mirror case: a day early and the old lord must still hold."""
    mahadashas, _ = intervals
    boundary_jd = mahadashas[boundary_index][3]
    boundary_date = svc._jd_to_date(boundary_jd)
    outgoing = PLANET_NAMES[mahadashas[boundary_index][0]]

    result = calculate_chart(REFERENCE_BIRTH, as_of=boundary_date - _dt.timedelta(days=1))
    assert result["dasha"]["current_mahadasha"]["lord"] == outgoing


@pytest.mark.parametrize("boundary_index", range(8))
def test_changeover_date_resolves_against_the_clock_not_the_calendar(
    intervals, boundary_index
) -> None:
    """The precise off-by-one guard.

    A mahadasha turns over at an *instant*, which for this nativity is rarely
    midnight. Asking for the changeover date resolves at local noon, so the
    incoming lord is in force on that date only when the switch happened before
    noon. Getting this backwards -- or truncating to the calendar day and
    always returning the incoming lord -- is exactly the error this catches.
    """
    mahadashas, _ = intervals
    boundary_jd = mahadashas[boundary_index][3]
    boundary_date = svc._jd_to_date(boundary_jd)
    switch_hour = _boundary_hour(boundary_jd)

    outgoing = PLANET_NAMES[mahadashas[boundary_index][0]]
    incoming = PLANET_NAMES[mahadashas[boundary_index + 1][0]]
    expected = incoming if switch_hour <= _RESOLUTION_HOUR else outgoing

    result = calculate_chart(REFERENCE_BIRTH, as_of=boundary_date)
    assert result["dasha"]["current_mahadasha"]["lord"] == expected, (
        f"changeover {outgoing}->{incoming} on {boundary_date} at "
        f"{switch_hour:.3f}h local: expected {expected}"
    )


def test_every_sampled_date_lands_in_exactly_one_mahadasha(intervals) -> None:
    """Sweep the whole cycle; no date may fall into zero or two periods."""
    mahadashas, _ = intervals
    start_jd, end_jd = mahadashas[0][2], mahadashas[-1][3]
    step = (end_jd - start_jd) / 500.0
    moment = start_jd
    while moment < end_jd:
        holders = [m for m in mahadashas if m[2] <= moment < m[3]]
        assert len(holders) == 1, f"JD {moment} sits in {len(holders)} mahadashas"
        moment += step


def test_query_outside_the_cycle_fails_loudly(intervals) -> None:
    """Beyond 120 years there is no answer; we must say so, not invent one."""
    mahadashas, _ = intervals
    past_end = svc._jd_to_date(mahadashas[-1][3]) + _dt.timedelta(days=365)
    with pytest.raises(svc.CalculationError, match="outside the 120-year"):
        calculate_chart(REFERENCE_BIRTH, as_of=past_end)


# -------------------------------------------------------------- antardashas

def test_current_mahadasha_matches_the_timeline_entry(chart, timeline) -> None:
    """The running period must be the timeline row containing `as_of`."""
    as_of = _dt.date(2026, 8, 9)
    current = chart["dasha"]["current_mahadasha"]
    containing = [
        p for p in timeline if _as_date(p["start"]) <= as_of < _as_date(p["end"])
    ]
    assert len(containing) == 1
    assert containing[0] == current


def test_antardasha_sits_inside_its_mahadasha(chart) -> None:
    maha = chart["dasha"]["current_mahadasha"]
    antara = chart["dasha"]["current_antardasha"]
    assert _as_date(maha["start"]) <= _as_date(antara["start"])
    assert _as_date(antara["end"]) <= _as_date(maha["end"])


def test_antardasha_contains_the_as_of_date(chart) -> None:
    antara = chart["dasha"]["current_antardasha"]
    assert _as_date(antara["start"]) <= _dt.date(2026, 8, 9) < _as_date(antara["end"])


def test_every_antardasha_duration_is_proportional(intervals) -> None:
    """An antardasha lasts maha_years * antara_years / 120 years.

    Checked for all 81 periods against the canonical allocations, so neither a
    reordered sequence nor a rescaled year can slip through.
    """
    _, antardashas = intervals
    for maha_index, antara_index, start_jd, end_jd in antardashas:
        expected_days = (
            CANONICAL_YEARS[PLANET_NAMES[maha_index]]
            * CANONICAL_YEARS[PLANET_NAMES[antara_index]]
            / _VIMSHOTTARI_TOTAL_YEARS
            * _VIMSHOTTARI_YEAR_DAYS
        )
        actual_days = end_jd - start_jd
        assert abs(actual_days - expected_days) < 0.05, (
            f"{PLANET_NAMES[maha_index]}/{PLANET_NAMES[antara_index]} spans "
            f"{actual_days:.4f}d, expected {expected_days:.4f}d"
        )


def test_each_mahadasha_opens_with_its_own_lords_antardasha(intervals) -> None:
    """Every mahadasha's first antardasha is that mahadasha's own lord."""
    mahadashas, antardashas = intervals
    for maha in mahadashas:
        first = next(a for a in antardashas if a[2] >= maha[2])
        assert first[1] == maha[0], (
            f"{PLANET_NAMES[maha[0]]} mahadasha opens with "
            f"{PLANET_NAMES[first[1]]} antardasha"
        )
        assert first[2] == maha[2]


def test_antardasha_lords_follow_canonical_order_within_a_mahadasha(intervals) -> None:
    mahadashas, antardashas = intervals
    for maha in mahadashas:
        children = [a for a in antardashas if maha[2] <= a[2] < maha[3]]
        lords = [PLANET_NAMES[a[1]] for a in children]
        start = CANONICAL_ORDER.index(lords[0])
        assert lords == [CANONICAL_ORDER[(start + i) % 9] for i in range(9)]


def test_antardashas_exactly_fill_their_mahadasha(intervals) -> None:
    mahadashas, antardashas = intervals
    for maha in mahadashas:
        children = [a for a in antardashas if maha[2] <= a[2] < maha[3]]
        assert children[0][2] == maha[2]
        assert children[-1][3] == maha[3]


# ------------------------------------------------------------- determinism

def test_timeline_is_independent_of_the_as_of_date(timeline) -> None:
    """The timeline is a property of the birth, not of 'today'.

    This is a regression guard: PyJHora's `get_running_dhasa_for_given_date`
    leaks `year_duration` as a module global, which used to make the timeline
    drift depending on what had been computed earlier in the process.
    """
    for as_of in (_dt.date(2001, 1, 1), _dt.date(2050, 6, 1), _dt.date(2099, 12, 31)):
        other = calculate_chart(REFERENCE_BIRTH, as_of=as_of)
        assert other["dasha"]["full_mahadasha_timeline"] == timeline


def test_repeated_calculation_is_byte_identical() -> None:
    """Same input, same output -- no accumulated global state."""
    first = calculate_chart(REFERENCE_BIRTH, as_of=_dt.date(2026, 8, 9))
    for _ in range(3):
        assert calculate_chart(REFERENCE_BIRTH, as_of=_dt.date(2026, 8, 9)) == first
