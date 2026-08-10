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

#: Rough cap on how much conversation history we replay. Groq's free tier
#: allows 12,000 tokens per minute on llama-3.3-70b-versatile, and the facts
#: block plus instructions already costs roughly 700-900, so the history is the
#: part that has to stay bounded.
MAX_HISTORY_CHARS = 4000


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
        lines.append(
            f"{planet['name']}: {planet['sign']}, house {planet['house']}, "
            f"nakshatra {planet['nakshatra']} pada {planet['pada']}{retrograde}."
        )
    return "\n".join(lines)


def format_dasha(chart: dict[str, Any]) -> str:
    """The two periods that are actually running, plus what follows."""
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
    return "\n".join(lines)


def format_transits(transits: dict[str, Any]) -> str:
    """Today's sky, with the Moon called out because it is what changes daily."""
    lines = [
        f"Date: {transits['as_of']}.",
        f"Transiting Moon nakshatra: {transits['moon_nakshatra']} "
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
