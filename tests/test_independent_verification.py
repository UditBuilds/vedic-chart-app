"""Cross-checks against an independent ephemeris: NASA/JPL Horizons.

Why JPL rather than a Vedic site: the numbers below come from a completely
different ephemeris (JPL DE441) than the one this service runs on (pyswisseph's
built-in Moshier model). Agreement between them is real evidence that the
planetary longitudes are right. A second Vedic *website* would mostly re-run
the same Swiss Ephemeris code we already use, and could not be captured as a
reproducible fixture in any case.

The reference values were fetched from
    https://ssd.jpl.nasa.gov/api/horizons.api
        EPHEM_TYPE=OBSERVER  CENTER=500@399 (geocentric)  QUANTITIES=31
on 2026-08-09, and are quoted verbatim below so this test needs no network.
QUANTITY 31 is "observer-centred IAU76/80 ecliptic-of-date longitude of the
target's *apparent* position, with light-time, gravitational deflection and
stellar aberration".

Two systematic offsets are expected and accounted for by TOLERANCE_ARCSEC:

    * PyJHora requests swisseph's FLG_TRUEPOS, i.e. *geometric* positions with
      no light-time or aberration correction. Against JPL's apparent positions
      that is worth up to ~43" (Mercury), ~20" for the Sun.
    * `swe.get_ayanamsa_ut` excludes nutation while the body longitudes include
      it, worth a further ~17".

Neither shifts a sign, nakshatra or pada except within an arcminute of a
boundary, which the tests below check for explicitly rather than assume.
"""

from __future__ import annotations

import datetime as _dt

import pytest
import swisseph as swe

from app.services.astrology import (
    NAKSHATRA_NAMES,
    SIGN_NAMES,
    BirthData,
    calculate_chart,
)

#: Combined allowance for the geometric-vs-apparent and nutation offsets above.
TOLERANCE_ARCSEC = 60.0

#: How close to a sign/nakshatra/pada edge a body must be before we stop
#: asserting the *label* matches and check only the longitude.
BOUNDARY_GUARD_ARCSEC = 120.0

_ARCSEC = 1.0 / 3600.0
_NAKSHATRA_SPAN = 360.0 / 27.0   # 13 deg 20'
_PADA_SPAN = _NAKSHATRA_SPAN / 4  # 3 deg 20'


class Reference:
    """One JPL Horizons sample: longitudes a minute apart, for interpolation."""

    def __init__(self, body: str, at_hhmm: float, lon_0: float, lon_1: float):
        self.body = body
        self.at_hhmm = at_hhmm
        self.lon_0 = lon_0
        self.lon_1 = lon_1

    def at_second(self, second: int) -> float:
        """Linear interpolation between the two one-minute samples."""
        return self.lon_0 + (second / 60.0) * (self.lon_1 - self.lon_0)


# --------------------------------------------------------------------------
# Chart 1 -- the brief's worked example.
# 1998-05-24 14:40:43 IST (UTC+5:30), New Delhi 28.6139N 77.2090E
# => 09:10:43 UT. JPL sampled at 09:10 and 09:11 UT.
# --------------------------------------------------------------------------
CHART_1 = BirthData(
    date=_dt.date(1998, 5, 24), time=_dt.time(14, 40, 43),
    lat=28.6139, lon=77.2090, tz_offset=5.5,
)
CHART_1_UT = (1998, 5, 24, 9, 10, 43)
CHART_1_REFERENCE = [
    Reference("Sun",     910,  63.0086832,  63.0093508),
    Reference("Moon",    910,  43.0922685,  43.1026360),
    Reference("Mercury", 910,  44.8168796,  44.8181059),
    Reference("Venus",   910,  23.5051329,  23.5059364),
    Reference("Mars",    910,  60.1621056,  60.1626001),
    Reference("Jupiter", 910, 353.5969376, 353.5970431),
    Reference("Saturn",  910,  28.3255098,  28.3255875),
]

# --------------------------------------------------------------------------
# Chart 2 -- a deliberately different regime: 19th century, different
# longitude, local mean time rather than a modern zone offset.
# M. K. Gandhi's widely published birth data (Porbandar, 2 October 1869,
# 07:11:54 LMT). LMT offset is longitude/15. => 02:33:28 UT.
# --------------------------------------------------------------------------
CHART_2 = BirthData(
    date=_dt.date(1869, 10, 2), time=_dt.time(7, 11, 54),
    lat=21.6417, lon=69.6293, tz_offset=69.6293 / 15.0,
)
CHART_2_UT = (1869, 10, 2, 2, 33, 28)
CHART_2_REFERENCE = [
    Reference("Sun",  233, 188.9271963, 188.9278805),
    Reference("Moon", 233, 139.9672821, 139.9773022),
]

CASES = [
    pytest.param(CHART_1, CHART_1_UT, CHART_1_REFERENCE, id="1998-delhi"),
    pytest.param(CHART_2, CHART_2_UT, CHART_2_REFERENCE, id="1869-porbandar"),
]


def _absolute_longitude(planet: dict) -> float:
    """Sign + degrees-in-sign back to a 0..360 sidereal longitude."""
    return SIGN_NAMES.index(planet["sign"]) * 30.0 + planet["degree"]


def _ayanamsa_at(ut: tuple[int, int, int, int, int, int]) -> float:
    year, month, day, hour, minute, second = ut
    jd = swe.julday(year, month, day, hour + minute / 60.0 + second / 3600.0)
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    return swe.get_ayanamsa_ut(jd)


def _distance_to_boundary(longitude: float, span: float) -> float:
    """Angular distance to the nearest multiple of ``span``, in degrees."""
    offset = longitude % span
    return min(offset, span - offset)


def _angular_difference(first: float, second: float) -> float:
    """Smallest absolute separation between two longitudes, in degrees.

    Needed because a body near 0 deg can be reported as 359.68 by one source
    and -0.33 by another; those are the same direction, not 360 deg apart.
    """
    return abs((first - second + 180.0) % 360.0 - 180.0)


@pytest.mark.parametrize("birth,ut,references", CASES)
def test_longitudes_match_jpl_horizons(birth, ut, references) -> None:
    """Every sampled body must agree with JPL to within TOLERANCE_ARCSEC."""
    as_of = birth.date + _dt.timedelta(days=365 * 30)  # inside the dasha cycle
    result = calculate_chart(birth, as_of=as_of)
    by_name = {p["name"]: p for p in result["planets"]}
    ayanamsa = _ayanamsa_at(ut)

    for reference in references:
        expected_sidereal = (reference.at_second(ut[5]) - ayanamsa) % 360.0
        actual = _absolute_longitude(by_name[reference.body])
        delta_arcsec = _angular_difference(actual, expected_sidereal) / _ARCSEC
        assert delta_arcsec < TOLERANCE_ARCSEC, (
            f"{reference.body}: service says {actual:.6f} deg, JPL-derived "
            f"{expected_sidereal:.6f} deg, difference {delta_arcsec:.1f} arcsec"
        )


@pytest.mark.parametrize("birth,ut,references", CASES)
def test_sign_nakshatra_and_pada_agree_with_jpl(birth, ut, references) -> None:
    """The user-visible labels must be derivable from the independent source.

    A body sitting within BOUNDARY_GUARD_ARCSEC of an edge is skipped, because
    at that separation the known systematic offset could legitimately place it
    either side; the longitude assertion above still covers it.
    """
    as_of = birth.date + _dt.timedelta(days=365 * 30)
    result = calculate_chart(birth, as_of=as_of)
    by_name = {p["name"]: p for p in result["planets"]}
    ayanamsa = _ayanamsa_at(ut)
    guard = BOUNDARY_GUARD_ARCSEC * _ARCSEC

    checked = 0
    for reference in references:
        expected = (reference.at_second(ut[5]) - ayanamsa) % 360.0
        planet = by_name[reference.body]

        if _distance_to_boundary(expected, 30.0) > guard:
            assert planet["sign"] == SIGN_NAMES[int(expected // 30.0)], (
                f"{reference.body} sign mismatch against JPL"
            )
            checked += 1
        if _distance_to_boundary(expected, _NAKSHATRA_SPAN) > guard:
            index = int(expected // _NAKSHATRA_SPAN)
            assert planet["nakshatra"] == NAKSHATRA_NAMES[index], (
                f"{reference.body} nakshatra mismatch against JPL"
            )
        if _distance_to_boundary(expected, _PADA_SPAN) > guard:
            pada = int((expected % _NAKSHATRA_SPAN) // _PADA_SPAN) + 1
            assert planet["pada"] == pada, (
                f"{reference.body} pada mismatch against JPL: "
                f"service {planet['pada']}, JPL-derived {pada}"
            )

    assert checked > 0, "no body was far enough from a boundary to check"


def test_lahiri_ayanamsa_matches_its_official_definition() -> None:
    """Lahiri is defined as 23 deg 15' 00" at 21 March 1956, 00:00 UT.

    That is the value fixed by India's Calendar Reform Committee, and it is the
    single best external check that we are on the ayanamsa we claim to be on.
    Nutation must be included to reproduce it.
    """
    jd = swe.julday(1956, 3, 21, 0.0)
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    _retflag, with_nutation = swe.get_ayanamsa_ex_ut(jd, swe.FLG_SWIEPH)

    nominal = 23 + 15 / 60.0
    difference_arcsec = abs(with_nutation - nominal) / _ARCSEC
    assert difference_arcsec < 2.0, (
        f"Lahiri ayanamsa at the 1956 reference epoch is {with_nutation:.6f} deg, "
        f"expected {nominal:.6f} deg (off by {difference_arcsec:.2f} arcsec)"
    )


def test_service_reports_the_ayanamsa_it_actually_used() -> None:
    result = calculate_chart(CHART_1, as_of=_dt.date(2026, 8, 9))
    assert result["ayanamsa"] == "Lahiri"


def test_sun_house_is_consistent_with_the_time_of_day() -> None:
    """A physical sanity check on the ascendant, independent of any ephemeris.

    Bodies rise at the ascendant (house 1), culminate in house 10, and set in
    house 7. Chart 1 is a birth at 14:40 local clock time, roughly two hours
    past local apparent noon, so the Sun must have just passed culmination --
    house 9 or 10. If the ascendant were wrong by a few hours this fails.
    """
    result = calculate_chart(CHART_1, as_of=_dt.date(2026, 8, 9))
    sun = next(p for p in result["planets"] if p["name"] == "Sun")
    assert sun["house"] in (9, 10), (
        f"Sun in house {sun['house']} for an early-afternoon birth; "
        f"expected 9 or 10 (just past culmination)"
    )


def test_ketu_is_always_opposite_rahu() -> None:
    """Structural identity that any correct engine must satisfy."""
    for birth in (CHART_1, CHART_2):
        as_of = birth.date + _dt.timedelta(days=365 * 30)
        result = calculate_chart(birth, as_of=as_of)
        by_name = {p["name"]: p for p in result["planets"]}
        separation = (
            _absolute_longitude(by_name["Ketu"]) - _absolute_longitude(by_name["Rahu"])
        ) % 360.0
        assert abs(separation - 180.0) < 1e-6
