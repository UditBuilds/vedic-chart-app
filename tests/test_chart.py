"""Chart structure, retrograde detection, houses, and failure modes."""

from __future__ import annotations

import datetime as _dt

import pytest
import swisseph as swe

from app.services.astrology import (
    NAKSHATRA_NAMES,
    PLANET_NAMES,
    SIGN_ELEMENTS,
    SIGN_MODALITIES,
    SIGN_NAMES,
    BirthData,
    CalculationError,
    EphemerisRangeError,
    InvalidBirthDataError,
    calculate_chart,
    describe_sign,
)

REFERENCE_BIRTH = BirthData(
    date=_dt.date(1998, 5, 24), time=_dt.time(14, 40, 43),
    lat=28.6139, lon=77.2090, tz_offset=5.5,
)
AS_OF = _dt.date(2026, 8, 9)


@pytest.fixture(scope="module")
def chart() -> dict:
    return calculate_chart(REFERENCE_BIRTH, as_of=AS_OF)


# ------------------------------------------------------------------ shape

def test_input_is_echoed_verbatim(chart) -> None:
    assert chart["input_echo"] == {
        "date": "1998-05-24", "time": "14:40:43",
        "lat": 28.6139, "lon": 77.2090, "tz_offset": 5.5,
    }


def test_exactly_nine_planets_in_canonical_order(chart) -> None:
    assert [p["name"] for p in chart["planets"]] == list(PLANET_NAMES)


def test_every_planet_has_a_complete_record(chart) -> None:
    for planet in chart["planets"]:
        assert planet["sign"] in SIGN_NAMES
        assert 0.0 <= planet["degree"] < 30.0
        assert 1 <= planet["house"] <= 12
        assert planet["nakshatra"] in NAKSHATRA_NAMES
        assert 1 <= planet["pada"] <= 4
        assert isinstance(planet["retrograde"], bool)


def test_ascendant_is_complete(chart) -> None:
    ascendant = chart["ascendant"]
    assert ascendant["sign"] in SIGN_NAMES
    assert 0.0 <= ascendant["degree"] < 30.0
    assert ascendant["nakshatra"] in NAKSHATRA_NAMES
    assert 1 <= ascendant["pada"] <= 4


def test_moon_rashi_matches_the_moon_row(chart) -> None:
    moon = next(p for p in chart["planets"] if p["name"] == "Moon")
    assert chart["moon_rashi"] == moon["sign"]


def test_declared_ayanamsa_and_house_system(chart) -> None:
    assert chart["ayanamsa"] == "Lahiri"
    assert chart["house_system"] == "Whole Sign"


# ----------------------------------------------------------------- houses

def test_ascendant_sign_is_house_one(chart) -> None:
    """Under whole sign, anything in the rising sign is in house 1."""
    ascendant_sign = chart["ascendant"]["sign"]
    for planet in chart["planets"]:
        if planet["sign"] == ascendant_sign:
            assert planet["house"] == 1


def test_house_follows_sign_distance_from_the_ascendant(chart) -> None:
    ascendant_index = SIGN_NAMES.index(chart["ascendant"]["sign"])
    for planet in chart["planets"]:
        expected = (SIGN_NAMES.index(planet["sign"]) - ascendant_index) % 12 + 1
        assert planet["house"] == expected, f"{planet['name']} house mismatch"


def test_planets_sharing_a_sign_share_a_house(chart) -> None:
    by_sign: dict[str, set[int]] = {}
    for planet in chart["planets"]:
        by_sign.setdefault(planet["sign"], set()).add(planet["house"])
    for sign, houses in by_sign.items():
        assert len(houses) == 1, f"{sign} maps to more than one house: {houses}"


def test_rahu_and_ketu_are_six_houses_apart(chart) -> None:
    by_name = {p["name"]: p for p in chart["planets"]}
    separation = (by_name["Ketu"]["house"] - by_name["Rahu"]["house"]) % 12
    assert separation == 6


# ------------------------------------------------------------- retrograde

def test_rahu_and_ketu_are_always_retrograde(chart) -> None:
    """The nodes move backwards by definition; the engine must reflect it."""
    by_name = {p["name"]: p for p in chart["planets"]}
    assert by_name["Rahu"]["retrograde"] is True
    assert by_name["Ketu"]["retrograde"] is True


def test_sun_and_moon_are_never_retrograde(chart) -> None:
    by_name = {p["name"]: p for p in chart["planets"]}
    assert by_name["Sun"]["retrograde"] is False
    assert by_name["Moon"]["retrograde"] is False


@pytest.mark.parametrize(
    "birth_date,expected_retrograde",
    [
        # 2020-06-20: Mercury, Venus, Jupiter and Saturn were all retrograde;
        # Mars was direct. Cross-checked below against swisseph's own speeds.
        (_dt.date(2020, 6, 20), {"Mercury", "Venus", "Jupiter", "Saturn"}),
        # 2022-09-10: Jupiter, Saturn retrograde; Mercury had just stationed.
        (_dt.date(2022, 9, 10), None),
    ],
)
def test_retrograde_matches_swisseph_longitude_speed(birth_date, expected_retrograde) -> None:
    """A body is retrograde exactly when its ecliptic longitude speed is negative.

    This recomputes the answer straight from swisseph rather than trusting the
    library's helper, so a wrong index mapping (PyJHora's chart order is not
    the swisseph body order) would show up immediately.
    """
    birth = BirthData(
        date=birth_date, time=_dt.time(12, 0, 0),
        lat=28.6139, lon=77.2090, tz_offset=5.5,
    )
    result = calculate_chart(birth, as_of=birth_date + _dt.timedelta(days=365))
    reported = {p["name"] for p in result["planets"] if p["retrograde"]}

    swe.set_sid_mode(swe.SIDM_LAHIRI)
    jd_ut = swe.julday(birth_date.year, birth_date.month, birth_date.day, 12.0 - 5.5)
    bodies = {
        "Sun": swe.SUN, "Moon": swe.MOON, "Mars": swe.MARS, "Mercury": swe.MERCURY,
        "Jupiter": swe.JUPITER, "Venus": swe.VENUS, "Saturn": swe.SATURN,
    }
    truth = set()
    for name, body_id in bodies.items():
        values, _flag = swe.calc_ut(
            jd_ut, body_id, swe.FLG_SWIEPH | swe.FLG_SIDEREAL | swe.FLG_SPEED
        )
        if values[3] < 0:
            truth.add(name)

    assert reported - {"Rahu", "Ketu"} == truth
    if expected_retrograde is not None:
        assert truth == expected_retrograde


# ------------------------------------------------------- input validation

@pytest.mark.parametrize("latitude", [-91.0, 90.5, 1000.0])
def test_latitude_out_of_range_is_rejected(latitude) -> None:
    with pytest.raises(InvalidBirthDataError, match="latitude"):
        BirthData(_dt.date(2000, 1, 1), _dt.time(12, 0), latitude, 0.0, 0.0)


@pytest.mark.parametrize("longitude", [-181.0, 180.5])
def test_longitude_out_of_range_is_rejected(longitude) -> None:
    with pytest.raises(InvalidBirthDataError, match="longitude"):
        BirthData(_dt.date(2000, 1, 1), _dt.time(12, 0), 0.0, longitude, 0.0)


@pytest.mark.parametrize("offset", [-13.0, 15.0])
def test_impossible_timezone_offset_is_rejected(offset) -> None:
    with pytest.raises(InvalidBirthDataError, match="tz_offset"):
        BirthData(_dt.date(2000, 1, 1), _dt.time(12, 0), 0.0, 0.0, offset)


@pytest.mark.parametrize("year", [3000, 5000, 9999])
def test_year_beyond_the_ephemeris_is_rejected_by_name(year) -> None:
    """The error must name the supported range, not just fail."""
    with pytest.raises(EphemerisRangeError) as excinfo:
        BirthData(_dt.date(year, 1, 1), _dt.time(12, 0), 0.0, 0.0, 0.0)
    assert "2999" in str(excinfo.value)


def test_a_supported_edge_year_still_computes() -> None:
    """2999 is inside the range, so it must produce a chart, not an error."""
    birth = BirthData(_dt.date(2999, 1, 1), _dt.time(12, 0), 28.6, 77.2, 5.5)
    result = calculate_chart(birth, as_of=_dt.date(2999, 6, 1))
    assert len(result["planets"]) == 9


def test_timezone_offset_actually_changes_the_chart() -> None:
    """Same clock reading in a different zone is a different moment."""
    ist = calculate_chart(REFERENCE_BIRTH, as_of=AS_OF)
    utc = calculate_chart(
        BirthData(REFERENCE_BIRTH.date, REFERENCE_BIRTH.time,
                  REFERENCE_BIRTH.lat, REFERENCE_BIRTH.lon, 0.0),
        as_of=AS_OF,
    )
    assert ist["ascendant"] != utc["ascendant"]


def test_latitude_actually_changes_the_ascendant() -> None:
    southern = calculate_chart(
        BirthData(REFERENCE_BIRTH.date, REFERENCE_BIRTH.time,
                  -33.8688, 151.2093, 10.0),
        as_of=AS_OF,
    )
    assert southern["ascendant"]["sign"] in SIGN_NAMES


def test_degree_is_within_its_sign_for_every_body(chart) -> None:
    """Guards against an absolute longitude leaking into a per-sign field."""
    for planet in chart["planets"]:
        assert 0.0 <= planet["degree"] < 30.0, planet


# ------------------------------------------------- static sign properties
#
# Grounded in FACTS because the model was observed asserting one from memory
# and getting it wrong: it called Gemini "water-sign-related". Gemini is air.
# Nothing in FACTS could contradict it, so there was no way for the answer to
# be caught -- the fix is to put the property in front of the model, not to add
# another rule telling it to be careful.


def test_gemini_is_air_which_is_the_bug_that_prompted_this() -> None:
    """The exact observed error, pinned."""
    assert SIGN_ELEMENTS[SIGN_NAMES.index("Gemini")] == "air"
    assert describe_sign("Gemini") == "Gemini (air, dual)"


def test_element_and_modality_are_read_from_the_engine_not_retyped() -> None:
    """A hand-copied table would be a second source of truth that can drift.

    Two assumed defaults have already cost this project real time (the
    ayanamsa, the node mode), so these are inverted out of ``jhora.const``'s
    own grouping lists rather than written out here. This asserts the values
    still agree with the library.
    """
    from jhora import const

    for group, expected in (
        (const.fire_signs, "fire"), (const.earth_signs, "earth"),
        (const.air_signs, "air"), (const.water_signs, "water"),
    ):
        for index in group:
            assert SIGN_ELEMENTS[index] == expected, SIGN_NAMES[index]
    for group, expected in (
        (const.movable_signs, "movable"), (const.fixed_signs, "fixed"),
        (const.dual_signs, "dual"),
    ):
        for index in group:
            assert SIGN_MODALITIES[index] == expected, SIGN_NAMES[index]


def test_element_is_a_four_cycle_and_modality_a_three_cycle() -> None:
    """An independent structural check, not a restatement of the table.

    Triplicity and quadruplicity are definitional: every 4th sign from Aries
    shares an element, every 3rd shares a modality. If the library's lists were
    ever wrong, or inverted wrongly here, the cycle breaks. This is the closest
    thing to a second source available offline.
    """
    for index in range(len(SIGN_NAMES)):
        assert SIGN_ELEMENTS[index] == SIGN_ELEMENTS[index % 4], SIGN_NAMES[index]
        assert SIGN_MODALITIES[index] == SIGN_MODALITIES[index % 3], SIGN_NAMES[index]


def test_every_sign_has_exactly_one_element_and_one_modality() -> None:
    assert len(SIGN_ELEMENTS) == len(SIGN_MODALITIES) == len(SIGN_NAMES) == 12
    assert set(SIGN_ELEMENTS) == {"fire", "earth", "air", "water"}
    assert set(SIGN_MODALITIES) == {"movable", "fixed", "dual"}
    for element in ("fire", "earth", "air", "water"):
        assert SIGN_ELEMENTS.count(element) == 3
    for modality in ("movable", "fixed", "dual"):
        assert SIGN_MODALITIES.count(modality) == 4


def test_the_sign_ruler_is_deliberately_not_grounded() -> None:
    """Scope decision, pinned so it is not "fixed" without reading why.

    A sign's ruling planet is just as static as its element, and PyJHora has
    the table (``const.house_lords_dict``). It is left out on purpose: it is
    the one static property that completes the chained house-lordship claim
    RULE_NO_DERIVED_CHART_FACTS blocks -- the 7th house is Pisces, Pisces is
    ruled by Jupiter, therefore "Jupiter rules your 7th house". Grounding the
    benign half would supply the missing link. See CONVENTIONS.md before
    changing this.
    """
    assert describe_sign("Aries") == "Aries (fire, movable)"
    for ruler in ("Mars", "Venus", "Mercury", "Jupiter", "Saturn"):
        assert ruler not in describe_sign("Aries")
        assert ruler not in describe_sign("Pisces")


def test_describe_sign_rejects_something_that_is_not_a_sign() -> None:
    with pytest.raises(KeyError, match="unknown sign"):
        describe_sign("Ophiuchus")
