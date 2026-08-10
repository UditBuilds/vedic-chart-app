"""Guards for two deliberate departures from astronomical best practice.

Both choices below make this service *less* rigorous and *more* consistent
with the Vedic software our users already trust. They look like bugs to anyone
reading the code cold, so they are pinned here: if someone "corrects" either
one back, these tests fail and point them at the rationale.

See ``_MEAN_NODE_RATIONALE`` and ``_DELTA_T_RATIONALE`` in
``app.services.astrology``.
"""

from __future__ import annotations

import datetime as _dt

import pytest
import swisseph as swe

from app.services import astrology as svc
from app.services.astrology import BirthData, calculate_chart

REFERENCE_BIRTH = BirthData(
    date=_dt.date(1998, 5, 24), time=_dt.time(14, 40, 43),
    lat=28.6139, lon=77.2090, tz_offset=5.5,
)
AS_OF = _dt.date(2026, 8, 9)

_ARCSEC = 1.0 / 3600.0

#: AstroSage's displayed values for the reference chart, captured 2026-08-09
#: from its free kundli tool with matched inputs (28:37:N, 77:13:E, TZ 5.5,
#: ayanamsa "N.C.Lahiri"). Degrees within sign.
ASTROSAGE_RAHU_LEO = 12 + 17 / 60 + 46 / 3600
ASTROSAGE_MOON_ARIES = 19 + 15 / 60 + 25 / 3600

#: The true node sits this far from the mean node on the reference chart.
#: Quoted so the failure message can say how big a revert would be.
TRUE_NODE_GAP_ARCSEC = 989.0


@pytest.fixture(scope="module")
def chart() -> dict:
    return calculate_chart(REFERENCE_BIRTH, as_of=AS_OF)


def _absolute(planet: dict) -> float:
    return svc.SIGN_NAMES.index(planet["sign"]) * 30.0 + planet["degree"]


def test_rahu_uses_the_mean_node_not_the_true_node(chart) -> None:
    """Rahu must track swisseph's MEAN_NODE, matching mainstream Vedic tools.

    If this fails with a ~989 arcsec error, someone has switched back to
    swe.TRUE_NODE. That is astronomically defensible and wrong for this
    product -- read _MEAN_NODE_RATIONALE before changing it.
    """
    rahu = next(p for p in chart["planets"] if p["name"] == "Rahu")
    delta_arcsec = abs(_absolute(rahu) - (120.0 + ASTROSAGE_RAHU_LEO)) / _ARCSEC
    assert delta_arcsec < 60.0, (
        f"Rahu is {delta_arcsec:.1f} arcsec from AstroSage's mean-node value; "
        f"a switch back to the true node would show ~{TRUE_NODE_GAP_ARCSEC:.0f}"
    )


def test_ketu_is_exactly_opposite_the_mean_node(chart) -> None:
    by_name = {p["name"]: p for p in chart["planets"]}
    separation = (_absolute(by_name["Ketu"]) - _absolute(by_name["Rahu"])) % 360.0
    assert abs(separation - 180.0) < 1e-9


def test_delta_t_is_pinned_to_zero_during_calculation(chart) -> None:
    """The Delta T override must survive a calculation, not just be set once.

    ``calculate_chart`` re-asserts it inside the engine lock; this checks the
    process is left in that state, which is what makes repeated requests and
    PyJHora's internal ``calc_ut`` calls agree.
    """
    assert swe.deltat(2450958.0) == 0.0


def test_moon_matches_astrosage_within_two_arcseconds(chart) -> None:
    """The Delta T convention is what makes this hold.

    With the correction applied (astronomically correct) the Moon lands ~39
    arcsec away and every dasha boundary moves about a week.
    """
    moon = next(p for p in chart["planets"] if p["name"] == "Moon")
    delta_arcsec = abs(moon["degree"] - ASTROSAGE_MOON_ARIES) / _ARCSEC
    assert delta_arcsec < 2.0, (
        f"Moon is {delta_arcsec:.1f} arcsec from AstroSage; if this is ~39, "
        f"the Delta T correction has been re-enabled"
    )


def test_dasha_boundaries_match_astrosage_within_two_days(chart) -> None:
    """AstroSage: Mars mahadasha 6/7/2025-6/7/2032, Rahu antardasha to 21/12/2026.

    These dates are downstream of the Moon, so they are the user-visible
    symptom of the Delta T choice -- a revert moves them ~7 days.
    """
    maha = chart["dasha"]["current_mahadasha"]
    antara = chart["dasha"]["current_antardasha"]
    assert maha["lord"] == "Mars"
    assert antara["lord"] == "Rahu"

    expected = {
        maha["start"]: _dt.date(2025, 7, 6),
        maha["end"]: _dt.date(2032, 7, 6),
        antara["start"]: _dt.date(2025, 12, 3),
        antara["end"]: _dt.date(2026, 12, 21),
    }
    for actual_iso, astrosage_date in expected.items():
        drift = abs((_dt.date.fromisoformat(actual_iso) - astrosage_date).days)
        assert drift <= 2, (
            f"{actual_iso} is {drift} days from AstroSage's {astrosage_date}; "
            f"~7 days means the Delta T correction is back"
        )


def test_the_pyjhora_node_switch_is_still_ineffective() -> None:
    """Documents *why* we compute the node ourselves rather than configuring it.

    ``const.set_node_mode`` flips ``const._RAHU``, but ``drik`` captured the old
    value as a dict key at import time, so the switch does not reach the chart.
    If a future PyJHora release fixes this, this test starts failing and the
    manual override in ``_mean_node_longitude`` can be replaced by the setting.
    """
    from jhora import const
    from jhora.panchanga import drik

    original = const._use_true_nodes_for_rahu_ketu
    try:
        const.set_node_mode(False)
        assert const._RAHU == swe.MEAN_NODE, "set_node_mode should flip the constant"
        assert swe.TRUE_NODE in drik._sidereal_planet_list, (
            "drik no longer caches the true node -- PyJHora may have fixed the "
            "switch; re-evaluate _mean_node_longitude"
        )
    finally:
        const.set_node_mode(original)


def test_labels_are_unaffected_by_the_convention_choices(chart) -> None:
    """Both fixes move degrees, not labels, on the reference chart.

    Recorded because it is the reason these changes were safe to make: no sign,
    house, nakshatra or pada moved.
    """
    by_name = {p["name"]: p for p in chart["planets"]}
    assert (by_name["Rahu"]["sign"], by_name["Rahu"]["nakshatra"], by_name["Rahu"]["pada"]) == (
        "Leo", "Magha", 4,
    )
    assert (by_name["Ketu"]["sign"], by_name["Ketu"]["nakshatra"], by_name["Ketu"]["pada"]) == (
        "Aquarius", "Shatabhisha", 2,
    )
    assert (by_name["Moon"]["sign"], by_name["Moon"]["nakshatra"], by_name["Moon"]["pada"]) == (
        "Aries", "Bharani", 2,
    )
    assert chart["moon_rashi"] == "Aries"
    assert chart["ascendant"]["sign"] == "Virgo"
