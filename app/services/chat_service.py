"""Turn orchestration: chart facts in, grounded reply out.

Split from ``app.chat`` (the CLI) so the prompt assembly can be tested without
a Groq key or a terminal, and split from ``app.services.llm`` so the transport
can be swapped without touching the voice.

The flow for one turn:
    1. Load the cached natal chart (computed once; it never changes).
    2. Recompute transits *now* -- never cached, staleness here is a real bug.
    3. Read the last 20 messages.
    4. Render all of it into the system prompt as plain English.
    5. Call Groq, then append both turns to history.
"""

from __future__ import annotations

import datetime as _dt
import sqlite3
from typing import Any, Final

from app import db
from app.services import facts, llm
from app.services.astrology import BirthData, calculate_chart, calculate_transits

#: The voice. A first draft, deliberately -- it is meant to be tested against
#: real transcripts and revised, not treated as settled.
#:
#: The banned-phrase list is the load-bearing part. Generic astrology-app
#: filler is what makes an interpretation feel machine-made, and a model asked
#: only to "be specific" will still reach for it.
SYSTEM_PROMPT_TEMPLATE: Final[str] = """\
You are a calm, direct Vedic astrology companion. You interpret facts about a
person's birth chart. You never invent, guess, or approximate a placement,
dasha period, or transit that isn't given to you below - if something isn't in
the facts, say plainly you don't have that calculated yet.

Voice:
- Calm and specific. Ground any claim about how someone might feel in a fact
  first.
- Never use any of these phrases:
{banned_list}
- Two chart facts maximum per message. Don't data-dump the chart.
- End on an observation, not an affirmation.
- Short, plain sentences. Reference earlier conversation naturally instead of
  re-explaining the chart from scratch each turn.
- Match the fact to the question's timescale: life-pattern questions ->
  natal/dasha. "This week/today" questions -> transiting Moon nakshatra or
  transit house. "Who am I" questions -> natal placements.

FACTS:
Natal:
{natal_summary}

Current dasha:
{dasha_summary}

Today's transits:
{transit_summary}

Recent conversation:
{recent_messages}
"""

#: Phrases the voice rules forbid. Kept here rather than only in the prompt so
#: the verification script and the tests check the same list the model is given.
BANNED_PHRASES: Final[tuple[str, ...]] = (
    "trust the process",
    "the universe is telling you",
    "this is your sign to",
    "take a deep breath",
    "honor your feelings",
    "honour your feelings",
    "lean into it",
)


def banned_phrases_in(text: str) -> list[str]:
    """Which forbidden phrases appear in ``text``, case-insensitively."""
    lowered = text.lower()
    return [phrase for phrase in BANNED_PHRASES if phrase in lowered]


def _render_banned_list() -> str:
    """The forbidden phrases as prompt bullets.

    Generated from :data:`BANNED_PHRASES` rather than written out in the
    template, so the list the model is given and the list the verifier greps
    for cannot drift apart. Writing them inline also let the template's line
    wrapping split a phrase mid-way, which silently weakened both.
    """
    return "\n".join(f'  - "{phrase}"' for phrase in BANNED_PHRASES)


def birth_from_row(row: dict[str, Any]) -> BirthData:
    """Rebuild a :class:`BirthData` from the stored birth columns."""
    return BirthData(
        date=_dt.date.fromisoformat(row["date"]),
        time=_dt.time.fromisoformat(row["time"]),
        lat=float(row["lat"]),
        lon=float(row["lon"]),
        tz_offset=float(row["tz_offset"]),
    )


def ensure_chart(
    connection: sqlite3.Connection, user_id: str, birth: BirthData
) -> dict[str, Any]:
    """Return the cached natal chart, computing and storing it on first use."""
    stored = db.load_chart(connection, user_id)
    if stored is not None:
        return stored["chart"]
    chart = calculate_chart(birth)
    db.save_chart(connection, user_id, birth, chart)
    saved = db.load_chart(connection, user_id)
    if saved is None:  # pragma: no cover - would mean the write silently failed
        raise RuntimeError("chart was saved but could not be read back")
    return saved["chart"]


def build_system_prompt(
    chart: dict[str, Any],
    transits: dict[str, Any],
    history: list[dict[str, str]],
) -> str:
    """Assemble the grounded prompt for one turn."""
    return SYSTEM_PROMPT_TEMPLATE.format(
        banned_list=_render_banned_list(),
        natal_summary=facts.format_natal(chart),
        dasha_summary=facts.format_dasha(chart),
        transit_summary=facts.format_transits(transits),
        recent_messages=facts.format_history(history),
    )


def respond(
    connection: sqlite3.Connection,
    user_id: str,
    birth: BirthData,
    user_message: str,
    now: _dt.datetime | None = None,
) -> dict[str, Any]:
    """Handle one turn end to end and persist both halves of it.

    :returns: ``{"reply": str, "prompt": str, "transits": dict}`` -- the prompt
        is returned so a caller can audit exactly what the model was told,
        which is what makes the fact-by-fact verification possible.
    """
    chart = ensure_chart(connection, user_id, birth)
    # Fresh every turn, by design. See app/db.py on why this is not cached.
    transits = calculate_transits(birth, chart["ascendant"]["sign"], at=now)
    history = db.recent_messages(connection, user_id)

    prompt = build_system_prompt(chart, transits, history)
    reply = llm.complete(prompt, user_message)

    db.append_message(connection, user_id, "user", user_message)
    db.append_message(connection, user_id, "assistant", reply)
    return {"reply": reply, "prompt": prompt, "transits": transits}
