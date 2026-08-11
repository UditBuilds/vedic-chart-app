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

# --------------------------------------------------------------------------
# Prompt rules
#
# Every piece of instruction text is a single-line constant, interpolated into
# the template below. Nothing is typed as prose inside the triple-quoted block.
#
# This is not stylistic. Twice now, rule text typed inline picked up a literal
# newline where a space belonged, because the source was wrapped to fit 79
# columns: once splitting "this is your sign to" in the banned-phrase list, and
# later splitting "It never means a planet moved" in the relational rule. Both
# times the rendered prompt silently stopped containing the phrase that a check
# searched for, so the check passed while the prompt was wrong. The second one
# happened *after* the first was fixed, because the first fix was applied to
# the instance rather than the class.
#
# A string with no newlines in it cannot be wrapped by the template. Keeping
# every rule in a constant makes the bug structurally impossible for new rules,
# and :data:`PROMPT_RULES` gives the tests something to assert against.
# --------------------------------------------------------------------------

ROLE: Final[str] = (
    "You are a calm, direct Vedic astrology companion. You interpret facts about"
    " a person's birth chart."
)

RULE_NO_INVENTION: Final[str] = (
    "You never invent, guess, or approximate a placement, dasha period, or"
    " transit that isn't given to you below - if something isn't in the facts,"
    " say plainly you don't have that calculated yet."
)

RULE_NO_RELATIONSHIPS: Final[str] = (
    "Never state a relationship, comparison, sequence, or change between two"
    " facts - which planet is stronger, what moves where, what comes before or"
    " after - unless that specific relationship is itself present in FACTS"
    " below. A dasha period ending or beginning only changes which period is"
    " active. It never means a planet moved: natal placements are fixed for"
    " life."
)

VOICE_GROUNDED: Final[str] = (
    "Calm and specific. Ground any claim about how someone might feel in a fact"
    " first."
)
#: Relevance, not a count. The flat "two facts maximum" this replaced held for
#: narrow questions and broke on broad ones: answering "How is this week
#: looking?" honestly needed the Moon, Mars, Sun, Mercury and Jupiter, so the
#: cap forced either an incomplete answer or an arbitrary drop. A ceiling
#: cannot know how many facts a question needs; the question can.
VOICE_FACT_RELEVANCE: Final[str] = (
    "Cite only the facts that directly answer what was asked. For a narrow"
    " question that is usually one or two. A broad question - \"how is this week"
    " looking\" - may need several, but every fact you cite has to earn its"
    " place: don't pad with facts the question didn't ask for, and don't drop"
    " one it needs. Never data-dump the chart."
)
VOICE_END_ON_OBSERVATION: Final[str] = (
    "End on an observation, not an affirmation."
)
VOICE_PLAIN_AND_CONTINUOUS: Final[str] = (
    "Short, plain sentences. Reference earlier conversation naturally instead of"
    " re-explaining the chart from scratch each turn."
)
VOICE_MATCH_TIMESCALE: Final[str] = (
    'Match the fact to the question\'s timescale: life-pattern questions ->'
    ' natal/dasha. "This week/today" questions -> transiting Moon nakshatra or'
    ' transit house. "Who am I" questions -> natal placements.'
)

#: Voice bullets, in the order they appear. The banned-phrase list is rendered
#: separately because it expands into many lines.
VOICE_RULES: Final[tuple[str, ...]] = (
    VOICE_GROUNDED,
    VOICE_FACT_RELEVANCE,
    VOICE_END_ON_OBSERVATION,
    VOICE_PLAIN_AND_CONTINUOUS,
    VOICE_MATCH_TIMESCALE,
)

#: Every rule that must survive into the rendered prompt intact. The line-wrap
#: guard iterates this; adding a rule without adding it here means it is not
#: covered, so keep them together.
PROMPT_RULES: Final[tuple[str, ...]] = (
    ROLE,
    RULE_NO_INVENTION,
    RULE_NO_RELATIONSHIPS,
) + VOICE_RULES

#: Structure only. All prose lives in the constants above -- see the note there,
#: and ``test_template_carries_structure_not_prose``.
SYSTEM_PROMPT_TEMPLATE: Final[str] = """\
{role} {rule_no_invention}

{rule_no_relationships}

Voice:
{voice_block}

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


#: Where the banned-phrase block sits among the voice bullets. It was second
#: before the rules were extracted into constants, and is pinned here so the
#: refactor did not quietly reorder what the model reads.
_BANNED_LIST_POSITION: Final[int] = 1


def _render_voice_block() -> str:
    """Voice bullets with the banned-phrase list spliced in at its old place."""
    bullets = [f"- {rule}" for rule in VOICE_RULES]
    bullets.insert(
        _BANNED_LIST_POSITION,
        "- Never use any of these phrases:\n" + _render_banned_list(),
    )
    return "\n".join(bullets)


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
        role=ROLE,
        rule_no_invention=RULE_NO_INVENTION,
        rule_no_relationships=RULE_NO_RELATIONSHIPS,
        voice_block=_render_voice_block(),
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
