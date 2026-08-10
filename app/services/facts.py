"""Render chart facts as short labelled English lines for the system prompt.

Why not just dump the JSON: the model reasons better over prose than over
nested objects, and a raw dump invites it to echo schema noise ("your
house_from_ascendant is 11") back at the user. Formatting here also puts a hard
edge on what the model is allowed to know -- if a fact is not in these strings,
it is not in the prompt, and the model is instructed to say it does not have it.

Everything here is pure string formatting over an existing chart payload. No
astrology is computed in this module.
"""

from __future__ import annotations

from typing import Any

from app.services.astrology import NAKSHATRA_NAMES

#: Rough cap on how much conversation history we replay. Groq's free tier
#: allows 12,000 tokens per minute on llama-3.3-70b-versatile, and the facts
#: block plus instructions already costs roughly 700-900, so the history is the
#: part that has to stay bounded.
MAX_HISTORY_CHARS = 4000

#: Ordinal suffixes for 1..27, so "Bharani (2nd of 27)" reads naturally.
_ORDINAL_SUFFIXES = {1: "st", 2: "nd", 3: "rd"}


def nakshatra_ordinal(name: str) -> int:
    """Position of a nakshatra in the canonical 1..27 sequence.

    Recovered from :data:`~app.services.astrology.NAKSHATRA_NAMES` rather than
    a second hand-written table. That tuple is the same ordered sequence the
    engine's own 1-based nakshatra number indexes into, so name -> position is
    an exact round trip of what the ephemeris returned; the two cannot disagree.

    PyJHora's ``utils.NAKSHATRA_LIST`` was considered and rejected as the
    source: it is language-dependent (its default is Tamil transliterations --
    "Karthigai", "Poosam") and shifts with ``utils.set_language``, so ordinals
    read from it would not line up with the names we publish.

    :raises KeyError: ``name`` is not a nakshatra we know.
    """
    try:
        return NAKSHATRA_NAMES.index(name) + 1
    except ValueError as exc:
        raise KeyError(f"unknown nakshatra {name!r}") from exc


def describe_nakshatra(name: str) -> str:
    """e.g. ``"Bharani (2nd of 27)"``.

    The ordinal is included because the model was observed inventing one --
    it called Ardra "the 8th nakshatra" when it is the 6th. It is a fixed,
    deterministic value, so stating it turns a fabrication risk into a
    grounded fact rather than something to keep declining.
    """
    position = nakshatra_ordinal(name)
    suffix = _ORDINAL_SUFFIXES.get(position if position not in (11, 12, 13) else 0, "th")
    return f"{name} ({position}{suffix} of {len(NAKSHATRA_NAMES)})"


def format_natal(chart: dict[str, Any]) -> str:
    """Ascendant plus all nine placements, one graha per line."""
    ascendant = chart["ascendant"]
    lines = [
        f"Ascendant (lagna): {ascendant['sign']} rising, "
        f"nakshatra {ascendant['nakshatra']} pada {ascendant['pada']}.",
        f"Moon sign (rashi): {chart['moon_rashi']}.",
    ]
    for planet in chart["planets"]:
        retrograde = ", retrograde" if planet["retrograde"] else ""
        # The Moon carries its ordinal; the other eight do not. Nakshatra
        # position is asked about for the Moon and almost never for the rest,
        # and nine extra clauses is real prompt budget under an 8k/min ceiling.
        nakshatra = (
            describe_nakshatra(planet["nakshatra"])
            if planet["name"] == "Moon"
            else planet["nakshatra"]
        )
        lines.append(
            f"{planet['name']}: {planet['sign']}, house {planet['house']}, "
            f"nakshatra {nakshatra} pada {planet['pada']}{retrograde}."
        )
    return "\n".join(lines)


def format_dasha(chart: dict[str, Any]) -> str:
    """The running periods, plus the whole mahadasha sequence.

    The full timeline is included because "what comes after this one" is a
    legitimately answerable question and the data already exists in the chart
    payload. Previously only the immediately-following period was rendered, so
    anything beyond one step ahead had no grounded answer available -- and the
    model was observed filling that gap by inventing relationships instead of
    declining. Nine extra lines is a cheap way to remove the temptation.
    """
    dasha = chart["dasha"]
    maha = dasha["current_mahadasha"]
    antara = dasha["current_antardasha"]
    lines = [
        f"Mahadasha: {maha['lord']}, running {maha['start']} to {maha['end']}.",
        f"Antardasha: {antara['lord']}, running {antara['start']} to {antara['end']}.",
    ]

    timeline = dasha.get("full_mahadasha_timeline", [])
    for index, period in enumerate(timeline):
        if period["lord"] == maha["lord"] and period["start"] == maha["start"]:
            if index + 1 < len(timeline):
                following = timeline[index + 1]
                lines.append(
                    f"Next mahadasha: {following['lord']}, beginning {following['start']}."
                )
            break

    if timeline:
        lines.append(
            "Full mahadasha sequence for this chart (this is the complete list; "
            "there is no other order):"
        )
        for period in timeline:
            lines.append(f"  {period['lord']}: {period['start']} to {period['end']}.")
    return "\n".join(lines)


def format_transits(transits: dict[str, Any]) -> str:
    """Today's sky, with the Moon called out because it is what changes daily.

    The transiting Moon's house is repeated on its own summary line rather than
    left to the per-planet list below. Observed failure: asked how the week
    looked, the model correctly took the transiting Moon's *nakshatra* from
    this line and then took its *house* from the natal Moon -- reporting the
    transiting Moon in the 8th when it was in the 10th. Keeping the two halves
    of that fact on one line, explicitly labelled against the natal Moon,
    removes the seam it fell through.
    """
    transiting_moon = next(
        (p for p in transits["planets"] if p["name"] == "Moon"), None
    )
    if transiting_moon is None:
        raise KeyError("transit payload has no Moon")

    lines = [
        f"Date: {transits['as_of']}.",
        f"Transiting Moon (today's Moon, NOT the natal Moon): "
        f"{transiting_moon['sign']}, "
        f"house {transiting_moon['house_from_ascendant']} from the natal ascendant, "
        f"nakshatra {describe_nakshatra(transits['moon_nakshatra'])} "
        f"pada {transits['moon_pada']}.",
    ]
    for planet in transits["planets"]:
        lines.append(
            f"{planet['name']} transiting {planet['sign']}, "
            f"house {planet['house_from_ascendant']} from the natal ascendant."
        )
    return "\n".join(lines)


def format_history(messages: list[dict[str, str]]) -> str:
    """Recent turns as a readable script.

    Trimmed from the *front* when over budget, so the most recent exchanges --
    the ones the next reply actually has to follow on from -- always survive.
    """
    if not messages:
        return "(no earlier conversation)"

    rendered = [
        f"{'User' if m['role'] == 'user' else 'You'}: {m['content']}"
        for m in messages
    ]
    while rendered and sum(len(line) for line in rendered) > MAX_HISTORY_CHARS:
        rendered.pop(0)
    return "\n".join(rendered)
