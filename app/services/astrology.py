"""Deterministic Vedic (sidereal) chart calculation, backed by PyJHora + pyswisseph.

This module is the single source of astrological *fact* for the application.
Everything it returns is computed from the ephemeris; nothing is inferred,
interpolated or guessed. Callers outside this package should use
:func:`calculate_chart` and the exception types declared here, and should not
import ``jhora`` directly -- that keeps the engine swappable.

Scope (v1, deliberately thin):
    * D1 / Rashi chart only -- ascendant, 9 grahas, whole-sign houses.
    * Vimshottari Mahadasha + Antardasha only.

Notes on the underlying library, verified empirically against PyJHora 4.8.7:

Ayanamsa
    PyJHora's declared default is ``TRUE_PUSHYA``, *not* Lahiri, and until
    :func:`jhora.panchanga.drik.set_ayanamsa_mode` is called at least once,
    pyswisseph is left on *its* own default (Fagan/Bradley) regardless of what
    ``const._DEFAULT_AYANAMSA_MODE`` claims. We therefore set Lahiri
    explicitly before every calculation. This is not cosmetic: on the sample
    chart, the choice moves the Vimshottari timeline by ~484 days.

Global state
    ``swe.set_sid_mode`` is process-global, and PyJHora additionally mutates
    ``jhora.const._DEFAULT_AYANAMSA_MODE`` as a side effect of setting the
    mode. Flask serves requests on multiple threads, so every calculation runs
    under :data:`_ENGINE_LOCK` with the ayanamsa re-asserted inside the lock.

Ephemeris
    PyJHora requests ``FLG_SWIEPH`` but ships no ``.se1`` planetary files, so
    pyswisseph silently falls back to its built-in Moshier model. That is what
    makes "no data files to download" true, and it also fixes the valid date
    range -- see :data:`_MOSHIER_MIN_JD` / :data:`_MOSHIER_MAX_JD`.

Two deliberate departures from astronomical best practice
    Both of the following make this service *less* astronomically rigorous and
    *more* consistent with the Vedic software our users already check their
    charts against (verified against AstroSage's free kundli, 2026-08-09).
    They are intentional. Please do not "correct" them back without reading
    :data:`_MEAN_NODE_RATIONALE` and :data:`_DELTA_T_RATIONALE` first.

    1. Rahu/Ketu use the **mean** lunar node, not the true node.
    2. Positions are computed **without** the UT->TT (Delta T) correction.
"""

from __future__ import annotations

import datetime as _dt
import threading
from dataclasses import dataclass
from typing import Any, Final

import swisseph as _swe

from jhora import const as _jhora_const
from jhora import utils as _jhora_utils
from jhora.horoscope.chart import charts as _charts
from jhora.horoscope.dhasa.graha import vimsottari as _vimsottari
from jhora.panchanga import drik as _drik


# --------------------------------------------------------------------------
# Errors
# --------------------------------------------------------------------------
class AstrologyError(Exception):
    """Base class for every failure raised by this service."""


class InvalidBirthDataError(AstrologyError):
    """Birth input was structurally unusable (bad date, out-of-range latitude...)."""


class EphemerisRangeError(AstrologyError):
    """The requested moment lies outside the ephemeris' valid range."""


class CalculationError(AstrologyError):
    """The underlying engine failed to produce a chart for otherwise valid input."""


# --------------------------------------------------------------------------
# Constants
# --------------------------------------------------------------------------

#: Ayanamsa we pin. The output contract promises Lahiri; see module docstring.
AYANAMSA_NAME: Final[str] = "Lahiri"
_AYANAMSA_MODE: Final[str] = "LAHIRI"

#: WHY WE USE THE MEAN NODE. Rahu and Ketu can be taken as either the *mean*
#: lunar node (a smoothed, uniformly-moving point) or the *true* node (the
#: instantaneous osculating one). They sit up to ~16.5 arcminutes apart -- on
#: this project's reference chart, 12 deg 34' 15" versus 12 deg 17' 46" of Leo.
#: Mainstream Vedic practice, and every mass-market kundli tool our users will
#: check against, uses the MEAN node; PyJHora defaults to the TRUE node.
#: 16.5' is easily enough to move a graha across a pada boundary, which is the
#: kind of error a user who knows their own chart spots instantly. We therefore
#: match convention over astronomical purity. This is deliberate: do not switch
#: to swe.TRUE_NODE to be "more accurate".
_MEAN_NODE_RATIONALE: Final[str] = (
    "Rahu/Ketu use swe.MEAN_NODE to match mainstream Vedic software "
    "(verified against AstroSage, 2026-08-09). The true node sits ~16.5' away."
)

#: WHY WE DISABLE THE DELTA T CORRECTION. Ephemerides are computed in Terrestrial
#: Time; converting a civil (UT) birth moment to TT means adding Delta T, which
#: was ~63 seconds in 1998. ``swe.calc_ut`` does this automatically and is
#: astronomically correct. Traditional panchanga software -- AstroSage included
#: -- does not apply it, effectively treating the civil time as ephemeris time.
#: The gap is negligible for slow bodies but moves the Moon by ~39 arcseconds,
#: and because the Vimshottari balance is a fraction of the Moon's position
#: within its nakshatra, that cascades into a ~7-day shift in every dasha
#: boundary. Users comparing our dasha dates against their existing kundli
#: would see a week's discrepancy and conclude we are wrong.
#:
#: ``swe.set_delta_t_userdef(0.0)`` pins Delta T to zero, which makes
#: ``calc_ut`` behave exactly like ``calc``. This is the documented pyswisseph
#: override and it reaches PyJHora's internal ``calc_ut`` calls without
#: patching or forking the library. Verified: it reproduces AstroSage's Moon
#: to 0.8 arcseconds. This is deliberate: do not remove it to be "more correct".
_DELTA_T_RATIONALE: Final[str] = (
    "Delta T pinned to zero so civil time is treated as ephemeris time, "
    "matching traditional panchanga software. Without this, dasha boundaries "
    "land ~7 days away from what users see elsewhere."
)

#: Fixed Delta T value, in days, handed to swisseph. Zero means "no UT->TT shift".
_DELTA_T_DAYS: Final[float] = 0.0

#: Valid Julian Day range of pyswisseph's Moshier model. These are the bounds
#: swisseph itself reports ("outside Moshier planet range 625000.50 ..
#: 2818000.50"); beyond them it tries to open .se1 files that we do not ship.
_MOSHIER_MIN_JD: Final[float] = 625000.5   # ~3001-02-02 BCE (proleptic Gregorian)
_MOSHIER_MAX_JD: Final[float] = 2818000.5  # ~3003-04-28 CE

#: Human-readable form of the above, used in error messages.
_RANGE_DESCRIPTION: Final[str] = "0001-01-01 through 2999-12-31 CE (safely inside the engine's 3001 BCE - 3003 CE limit)"

#: Conservative calendar bounds we enforce *before* touching the ephemeris, so
#: that callers get a clean error instead of a swisseph exception.
_MIN_YEAR: Final[int] = 1
_MAX_YEAR: Final[int] = 2999

#: PyJHora returns chart rows keyed 0..8 in traditional Vedic order. This is
#: NOT the swisseph body order (e.g. ``jhora.const._MARS`` is 4, the swisseph
#: id, while index 4 in a chart row is Jupiter). Verified by matching every
#: chart longitude back to a raw ``swe.calc_ut`` result.
PLANET_NAMES: Final[tuple[str, ...]] = (
    "Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu",
)

#: Chart indices of the lunar nodes, whose positions we override -- see
#: :data:`_MEAN_NODE_RATIONALE`.
_RAHU_INDEX: Final[int] = PLANET_NAMES.index("Rahu")
_KETU_INDEX: Final[int] = PLANET_NAMES.index("Ketu")

#: Rashis in zodiacal order, index 0 == Aries, matching PyJHora's rasi index.
SIGN_NAMES: Final[tuple[str, ...]] = (
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
)

#: The 27 nakshatras. We keep our own table rather than using
#: ``jhora.utils.NAKSHATRA_LIST`` because the library's default language ships
#: Tamil transliterations ("Karthigai", "Thiruvaathirai") and its sign/planet
#: tables embed astrological glyphs ("Sun*", "*Aries"), neither of which makes
#: a stable JSON contract. The *numbers* still come from the library.
NAKSHATRA_NAMES: Final[tuple[str, ...]] = (
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
    "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha",
    "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana",
    "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
)

#: Length of a Vimshottari "year" in days, as PyJHora computes it (a sidereal
#: year, not a Julian 365.25). Read from the library so the two can never drift.
_VIMSHOTTARI_YEAR_DAYS: Final[float] = _vimsottari.year_duration

#: Total span of the Vimshottari cycle, in years.
_VIMSHOTTARI_TOTAL_YEARS: Final[int] = 120

#: Serialises access to the process-global swisseph/PyJHora configuration.
_ENGINE_LOCK: Final[threading.Lock] = threading.Lock()


# --------------------------------------------------------------------------
# Input / output types
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class BirthData:
    """A fully specified birth moment. Birth time is required in v1.

    :param date: Civil date at the birth place.
    :param time: Local clock time at the birth place.
    :param lat: Latitude in decimal degrees, north positive.
    :param lon: Longitude in decimal degrees, east positive.
    :param tz_offset: Offset from UTC in hours that was in force at the birth
        place at that moment (e.g. ``5.5`` for IST). Supplied by the caller;
        this service does no timezone lookup and no geocoding.
    """

    date: _dt.date
    time: _dt.time
    lat: float
    lon: float
    tz_offset: float

    def __post_init__(self) -> None:
        if not -90.0 <= self.lat <= 90.0:
            raise InvalidBirthDataError(
                f"latitude {self.lat} is out of range; expected -90..90"
            )
        if not -180.0 <= self.lon <= 180.0:
            raise InvalidBirthDataError(
                f"longitude {self.lon} is out of range; expected -180..180"
            )
        # Real-world civil offsets span UTC-12 .. UTC+14.
        if not -12.0 <= self.tz_offset <= 14.0:
            raise InvalidBirthDataError(
                f"tz_offset {self.tz_offset} is out of range; expected -12..14"
            )
        if not _MIN_YEAR <= self.date.year <= _MAX_YEAR:
            raise EphemerisRangeError(
                f"birth year {self.date.year} is outside the supported range: "
                f"{_RANGE_DESCRIPTION}"
            )


@dataclass(frozen=True)
class DashaPeriod:
    """One contiguous dasha period, half-open: ``start <= t < end``."""

    lord: str
    start: _dt.date
    end: _dt.date

    def as_dict(self) -> dict[str, str]:
        return {
            "lord": self.lord,
            "start": self.start.isoformat(),
            "end": self.end.isoformat(),
        }


# --------------------------------------------------------------------------
# Internal helpers
# --------------------------------------------------------------------------
def _local_julian_day(birth: BirthData) -> float:
    """Julian Day for the *local clock reading*, which is what PyJHora expects.

    PyJHora's convention is that the JD you hand it encodes the local wall
    clock, and the :class:`~jhora.panchanga.drik.Place` you hand it alongside
    carries the offset used to convert to UT internally. Verified: holding the
    JD fixed and changing only ``Place.timezone`` moves the ascendant.
    """
    return _jhora_utils.julian_day_number(
        (birth.date.year, birth.date.month, birth.date.day),
        (birth.time.hour, birth.time.minute, birth.time.second),
    )


def _assert_within_ephemeris(jd_local: float, tz_offset: float) -> None:
    """Fail loudly, naming the range, rather than let swisseph return nonsense."""
    jd_ut = jd_local - tz_offset / 24.0
    if not _MOSHIER_MIN_JD <= jd_ut <= _MOSHIER_MAX_JD:
        raise EphemerisRangeError(
            f"Julian Day {jd_ut:.5f} (UT) is outside the ephemeris' valid range "
            f"[{_MOSHIER_MIN_JD}, {_MOSHIER_MAX_JD}]. Supported dates: {_RANGE_DESCRIPTION}."
        )


def _place(birth: BirthData) -> Any:
    """Build the ``Place`` tuple PyJHora expects. Name is unused by the maths."""
    return _drik.Place("birthplace", birth.lat, birth.lon, birth.tz_offset)


def _jd_to_date(jd: float) -> _dt.date:
    """Convert a PyJHora Julian Day back to a civil date in the same frame.

    Because every JD in this module is a *local clock* JD, the date returned is
    the local date at the birth place -- which is what a reader expects to see
    against a dasha boundary.
    """
    year, month, day, _hours = _jhora_utils.jd_to_gregorian(jd)
    try:
        return _dt.date(year, month, day)
    except ValueError as exc:
        raise CalculationError(
            f"engine produced an unrepresentable calendar date from JD {jd}: {exc}"
        ) from exc


def _nakshatra_and_pada(absolute_longitude: float) -> tuple[str, int]:
    """Map an absolute sidereal longitude to its nakshatra name and pada.

    ``drik.nakshatra_pada`` returns ``[nakshatra, pada, remainder]`` with the
    nakshatra 1-indexed; we convert to a name and keep the pada as 1..4.
    """
    nakshatra_number, pada, _remainder = _drik.nakshatra_pada(absolute_longitude)
    index = int(nakshatra_number) - 1
    if not 0 <= index < len(NAKSHATRA_NAMES):
        raise CalculationError(
            f"engine returned nakshatra number {nakshatra_number} for longitude "
            f"{absolute_longitude}; expected 1..{len(NAKSHATRA_NAMES)}"
        )
    if not 1 <= int(pada) <= 4:
        raise CalculationError(
            f"engine returned pada {pada} for longitude {absolute_longitude}; expected 1..4"
        )
    return NAKSHATRA_NAMES[index], int(pada)


def _mean_node_longitude(jd_local: float, place: Any) -> float:
    """Sidereal longitude of Rahu (the ascending lunar node), mean not true.

    PyJHora *appears* to expose a switch for this -- ``const.set_node_mode()``
    flips ``const._RAHU`` between ``swe.TRUE_NODE`` and ``swe.MEAN_NODE``. It
    does not work once the library is loaded: ``drik._sidereal_planet_list`` is
    built at import time and captures the old ``const._RAHU`` as a dictionary
    *key*, so flipping the constant afterwards changes nothing. Verified
    empirically -- calling ``set_node_mode(False)`` and recomputing moved Rahu
    by 0.0 arcseconds. Its own docstring ("call this ONCE at process start")
    concedes the limitation, and relying on import ordering to get a correct
    chart is exactly the kind of fragility that already bit us once with
    PyJHora's leaked ``year_duration`` global.

    So we compute the node ourselves. We deliberately reuse
    ``drik.PLANET_FLAGS`` rather than composing our own flag set, so the node
    is computed under byte-identical conditions to the other seven bodies
    (same ephemeris, same sidereal mode, same FLG_TRUEPOS convention).

    See :data:`_MEAN_NODE_RATIONALE` for why mean rather than true.
    """
    jd_utc = _jhora_utils.julian_day_utc(jd_local, place)
    values, _retflag = _swe.calc_ut(jd_utc, _swe.MEAN_NODE, _drik.PLANET_FLAGS)
    longitude = float(values[0]) % 360.0
    if not 0.0 <= longitude < 360.0:
        raise CalculationError(
            f"mean node longitude {longitude} is outside 0..360"
        )
    return longitude


def _node_rows(jd_local: float, place: Any) -> dict[int, tuple[int, float]]:
    """Rahu and Ketu as ``chart index -> (sign, degrees into sign)``.

    Ketu is always exactly opposite Rahu, so it is derived rather than fetched;
    this also matches PyJHora, which never asks swisseph for Ketu directly.
    """
    rahu = _mean_node_longitude(jd_local, place)
    ketu = (rahu + 180.0) % 360.0
    return {
        _RAHU_INDEX: (int(rahu // 30.0), rahu % 30.0),
        _KETU_INDEX: (int(ketu // 30.0), ketu % 30.0),
    }


def _whole_sign_house(planet_sign: int, ascendant_sign: int) -> int:
    """House number 1..12 under the whole-sign system.

    The sign holding the ascendant is house 1 in its entirety, the next sign is
    house 2, and so on. This is the system implied by PyJHora's ``rasi_chart``,
    which reports each body as ``(sign_index, degrees_into_sign)`` and carries
    no cusps of its own.
    """
    return (planet_sign - ascendant_sign) % 12 + 1


#: One interval of the dasha tree, kept at Julian Day precision internally:
#: ``(mahadasha lord index, antardasha lord index, start JD, end JD)``.
_Interval = tuple[int, int, float, float]


def _engine_date_tuple_to_jd(value: tuple[int, int, int, float]) -> float:
    """Convert PyJHora's ``(year, month, day, hours)`` result tuple to a JD.

    ``julian_day_number`` derives its hour as ``h + m/60 + s/3600``, so passing
    the fractional hour in the first slot preserves full precision.
    """
    year, month, day, hours = value
    return _jhora_utils.julian_day_number((year, month, day), (hours, 0.0, 0.0))


def _dasha_intervals(jd_local: float, place: Any) -> tuple[list[_Interval], list[_Interval]]:
    """Build the whole Vimshottari tree from a *single* engine call.

    Both the mahadasha timeline and the running-period lookup are derived from
    the same 81 antardasha rows, so the two can never disagree. This matters:
    PyJHora's separate ``get_running_dhasa_for_given_date`` helper is not used
    here because it assigns ``vimsottari.year_duration`` as a module global and
    never restores it (365.256364 -> 365.25898927636445), which makes every
    later call in the same process return a slightly different timeline. We
    also re-pin that global before each run so results do not depend on
    whatever ran before us in this process.

    :returns: ``(mahadasha intervals, antardasha intervals)``, chronological.
    """
    _vimsottari.year_duration = _jhora_const.sidereal_year

    _balance, rows = _vimsottari.get_vimsottari_dhasa_bhukthi(jd_local, place)
    # The engine recomputes year_duration internally; read back what it used so
    # the closing boundary is derived with the same constant as the rest.
    year_days = float(_vimsottari.year_duration)

    expected_rows = len(PLANET_NAMES) ** 2  # 9 mahadashas x 9 antardashas
    if len(rows) != expected_rows:
        raise CalculationError(
            f"expected {expected_rows} antardasha rows, engine returned {len(rows)}"
        )

    starts: list[tuple[int, int, float, float]] = []
    for (maha_index, antara_index), start_tuple, duration_years in rows:
        starts.append(
            (int(maha_index), int(antara_index),
             _engine_date_tuple_to_jd(start_tuple), float(duration_years))
        )

    for earlier, later in zip(starts, starts[1:]):
        if later[2] < earlier[2]:
            raise CalculationError(
                "engine returned dasha periods out of chronological order"
            )

    # The cycle closes one final antardasha after the last row begins.
    cycle_end_jd = starts[-1][2] + starts[-1][3] * year_days

    antardashas: list[_Interval] = []
    for position, (maha_index, antara_index, start_jd, _years) in enumerate(starts):
        end_jd = starts[position + 1][2] if position + 1 < len(starts) else cycle_end_jd
        antardashas.append((maha_index, antara_index, start_jd, end_jd))

    # Collapse consecutive runs of the same mahadasha lord into one interval.
    mahadashas: list[_Interval] = []
    for maha_index, _antara_index, start_jd, end_jd in antardashas:
        if mahadashas and mahadashas[-1][0] == maha_index:
            previous = mahadashas[-1]
            mahadashas[-1] = (previous[0], previous[1], previous[2], end_jd)
        else:
            mahadashas.append((maha_index, maha_index, start_jd, end_jd))

    if len(mahadashas) != len(PLANET_NAMES):
        raise CalculationError(
            f"expected {len(PLANET_NAMES)} mahadasha periods, derived {len(mahadashas)}"
        )
    return mahadashas, antardashas


def _interval_containing(intervals: list[_Interval], moment_jd: float, label: str) -> _Interval:
    """The interval holding ``moment_jd``, half-open: ``start <= t < end``.

    Half-open is what makes a boundary unambiguous -- the instant a period ends
    belongs to the period beginning, never to both or neither.
    """
    for interval in intervals:
        if interval[2] <= moment_jd < interval[3]:
            return interval
    raise CalculationError(
        f"requested date falls outside the 120-year Vimshottari {label} cycle "
        f"for this nativity; the cycle runs from JD {intervals[0][2]:.5f} to "
        f"{intervals[-1][3]:.5f}"
    )


def _to_period(interval: _Interval, lord_slot: int) -> DashaPeriod:
    """Render an internal interval as the public, date-granular period."""
    return DashaPeriod(
        lord=PLANET_NAMES[interval[lord_slot]],
        start=_jd_to_date(interval[2]),
        end=_jd_to_date(interval[3]),
    )


def _transit_julian_day(birth: BirthData, moment_utc: _dt.datetime) -> tuple[float, _dt.date]:
    """Local-clock Julian Day at the birth place for a given UTC instant.

    PyJHora wants a JD encoding the *local wall clock* paired with a Place that
    carries the offset, so we shift the UTC moment by the birth place's offset
    and hand back the matching local date for the output's ``as_of``.

    Planetary longitudes are geocentric and do not actually depend on latitude
    or longitude -- verified: the same JD at Delhi and at Sydney yields
    identical positions, and only the ascendant moves. The place still matters
    here because it fixes which UT instant "today" refers to.
    """
    local = moment_utc + _dt.timedelta(hours=birth.tz_offset)
    jd_local = _jhora_utils.julian_day_number(
        (local.year, local.month, local.day),
        (local.hour, local.minute, local.second),
    )
    return jd_local, local.date()


# --------------------------------------------------------------------------
# Public API
# --------------------------------------------------------------------------
def calculate_transits(
    birth: BirthData,
    natal_ascendant_sign: str,
    at: _dt.datetime | None = None,
) -> dict[str, Any]:
    """Where the nine grahas are *now*, in houses counted from the natal lagna.

    This is gochar: the transiting positions are read against the natal
    ascendant rather than against a fresh chart cast for the current moment.
    Only placement is reported -- no benefic/malefic scoring and no
    transit-to-natal aspects.

    ``calculate_chart`` cannot be reused for this. Its ``as_of`` parameter only
    selects which dasha period is current; the positions it returns are always
    natal (verified: the planet list is identical for ``as_of`` 2001 and 2026).
    So this is a separate path, but it shares every primitive that matters --
    the same engine lock, the same Lahiri ayanamsa, the same mean-node
    override and the same Delta T convention -- so a transit position is
    computed exactly the way a natal one is.

    :param birth: The nativity, used for its place and UTC offset.
    :param natal_ascendant_sign: Rising sign from the natal chart, e.g. "Virgo".
        Houses are counted from here.
    :param at: UTC instant to compute for. Defaults to now. Naive datetimes are
        assumed to be UTC.
    :raises InvalidBirthDataError: ``natal_ascendant_sign`` is not a rashi.
    :raises EphemerisRangeError: The moment lies outside the ephemeris range.
    """
    if natal_ascendant_sign not in SIGN_NAMES:
        raise InvalidBirthDataError(
            f"unknown ascendant sign {natal_ascendant_sign!r}; "
            f"expected one of {', '.join(SIGN_NAMES)}"
        )
    ascendant_index = SIGN_NAMES.index(natal_ascendant_sign)

    if at is None:
        at = _dt.datetime.now(_dt.timezone.utc)
    elif at.tzinfo is not None:
        at = at.astimezone(_dt.timezone.utc)

    jd_local, local_date = _transit_julian_day(birth, at.replace(tzinfo=None))
    _assert_within_ephemeris(jd_local, birth.tz_offset)
    place = _place(birth)

    with _ENGINE_LOCK:
        _drik.set_ayanamsa_mode(_AYANAMSA_MODE)
        _swe.set_delta_t_userdef(_DELTA_T_DAYS)
        chart_rows = _charts.rasi_chart(jd_local, place)
        node_rows = _node_rows(jd_local, place)

    planets: list[dict[str, Any]] = []
    moon_nakshatra: str | None = None
    moon_pada: int | None = None
    for row in chart_rows:
        key, (sign_index, degree_in_sign) = row
        if key == _jhora_const._ascendant_symbol:
            # The transiting ascendant is meaningless for gochar -- houses come
            # from the natal lagna -- so it is deliberately dropped.
            continue
        index = int(key)
        if not 0 <= index < len(PLANET_NAMES):
            raise CalculationError(
                f"engine returned unexpected body index {index} in the transit chart"
            )
        if index in node_rows:
            sign_index, degree_in_sign = node_rows[index]
        name = PLANET_NAMES[index]
        if name == "Moon":
            # The one transit fact that changes on a human timescale, so it is
            # surfaced separately rather than left for the caller to dig out.
            moon_nakshatra, moon_pada = _nakshatra_and_pada(
                sign_index * 30.0 + degree_in_sign
            )
        planets.append(
            {
                "name": name,
                "sign": SIGN_NAMES[sign_index],
                "house_from_ascendant": _whole_sign_house(sign_index, ascendant_index),
            }
        )

    if len(planets) != len(PLANET_NAMES):
        raise CalculationError(
            f"expected {len(PLANET_NAMES)} transiting bodies, engine returned {len(planets)}"
        )
    if moon_nakshatra is None or moon_pada is None:
        raise CalculationError("engine returned no transiting Moon position")

    return {
        "as_of": local_date.isoformat(),
        "planets": planets,
        "moon_nakshatra": moon_nakshatra,
        "moon_pada": moon_pada,
    }


def calculate_chart(
    birth: BirthData,
    as_of: _dt.date | None = None,
    transits_at: _dt.datetime | None = None,
) -> dict[str, Any]:
    """Compute the D1 chart, Vimshottari dasha state and current transits.

    :param birth: The birth moment and place.
    :param as_of: Date against which "current" mahadasha/antardasha are
        resolved. Defaults to today (UTC). Exposed so results are reproducible
        in tests.
    :param transits_at: UTC instant for the transit snapshot. Defaults to now.
        Exposed for the same reason.
    :returns: A JSON-serialisable dict matching the documented output contract.
    :raises EphemerisRangeError: The moment lies outside the ephemeris range.
    :raises CalculationError: The engine returned something we cannot trust.
    """
    if as_of is None:
        as_of = _dt.datetime.now(_dt.timezone.utc).date()

    jd_local = _local_julian_day(birth)
    _assert_within_ephemeris(jd_local, birth.tz_offset)
    place = _place(birth)
    # Midday avoids any ambiguity about which side of a boundary a bare date sits.
    as_of_jd = _jhora_utils.julian_day_number(
        (as_of.year, as_of.month, as_of.day), (12.0, 0.0, 0.0)
    )

    with _ENGINE_LOCK:
        # Re-assert every time: this is process-global state that any other
        # caller (or PyJHora itself) may have changed since the last request.
        _drik.set_ayanamsa_mode(_AYANAMSA_MODE)
        # Must be set before any position is computed -- it changes every body,
        # and the Moon by enough to move the whole dasha timeline. See
        # _DELTA_T_RATIONALE; this is a deliberate convention match.
        _swe.set_delta_t_userdef(_DELTA_T_DAYS)

        ascendant_raw = _drik.ascendant(jd_local, place)
        chart_rows = _charts.rasi_chart(jd_local, place)
        retrograde_indices = set(_drik.planets_in_retrograde(jd_local, place))
        node_rows = _node_rows(jd_local, place)
        maha_intervals, antara_intervals = _dasha_intervals(jd_local, place)

    mahadasha_timeline = [_to_period(i, 0) for i in maha_intervals]
    current_maha = _to_period(_interval_containing(maha_intervals, as_of_jd, "mahadasha"), 0)
    current_antara = _to_period(
        _interval_containing(antara_intervals, as_of_jd, "antardasha"), 1
    )

    ascendant_sign = int(ascendant_raw[0])
    ascendant_degree = float(ascendant_raw[1])
    ascendant_nakshatra, ascendant_pada = _nakshatra_and_pada(
        ascendant_sign * 30.0 + ascendant_degree
    )

    planets: list[dict[str, Any]] = []
    moon_sign: str | None = None
    for row in chart_rows:
        key, (sign_index, degree_in_sign) = row
        if key == _jhora_const._ascendant_symbol:  # the 'L' row; already handled
            continue
        index = int(key)
        if not 0 <= index < len(PLANET_NAMES):
            raise CalculationError(
                f"engine returned unexpected body index {index} in the rasi chart"
            )
        # Substitute our mean-node figures for PyJHora's true-node ones. Done
        # here so the nodes go through exactly the same sign / nakshatra / pada
        # / house derivation as the other seven bodies.
        if index in node_rows:
            sign_index, degree_in_sign = node_rows[index]
        nakshatra, pada = _nakshatra_and_pada(sign_index * 30.0 + degree_in_sign)
        name = PLANET_NAMES[index]
        if name == "Moon":
            moon_sign = SIGN_NAMES[sign_index]
        planets.append(
            {
                "name": name,
                "sign": SIGN_NAMES[sign_index],
                "degree": round(float(degree_in_sign), 6),
                "house": _whole_sign_house(sign_index, ascendant_sign),
                "nakshatra": nakshatra,
                "pada": pada,
                "retrograde": index in retrograde_indices,
            }
        )

    if len(planets) != len(PLANET_NAMES):
        raise CalculationError(
            f"expected {len(PLANET_NAMES)} bodies, engine returned {len(planets)}"
        )
    if moon_sign is None:
        raise CalculationError("engine returned no Moon position")

    return {
        "input_echo": {
            "date": birth.date.isoformat(),
            "time": birth.time.isoformat(),
            "lat": birth.lat,
            "lon": birth.lon,
            "tz_offset": birth.tz_offset,
        },
        "ayanamsa": AYANAMSA_NAME,
        "house_system": "Whole Sign",
        "ascendant": {
            "sign": SIGN_NAMES[ascendant_sign],
            "degree": round(ascendant_degree, 6),
            "nakshatra": ascendant_nakshatra,
            "pada": ascendant_pada,
        },
        "planets": planets,
        "moon_rashi": moon_sign,
        "dasha": {
            "system": "Vimshottari",
            "as_of": as_of.isoformat(),
            "current_mahadasha": current_maha.as_dict(),
            "current_antardasha": current_antara.as_dict(),
            "full_mahadasha_timeline": [p.as_dict() for p in mahadasha_timeline],
        },
        # Transits are a snapshot of *now*, so unlike everything above they go
        # stale. Anything that caches this payload must recompute them with
        # calculate_transits() rather than serving what is stored here.
        "transits": calculate_transits(
            birth, SIGN_NAMES[ascendant_sign], at=transits_at
        ),
    }
