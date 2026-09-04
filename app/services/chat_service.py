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

#: A third fabrication class, distinct from the movement and ordinal ones.
#: FACTS carries every mahadasha's start and end date but exactly one
#: antardasha -- the running one. The model fills the gap from the Vimshottari
#: order it knows independently, and states the result as though it came from
#: the chart. Two shapes, both measured:
#:
#:   "The antardasha sequence will restart under Rahu's sub-periods"   2/4
#:   "Your next antardasha begins 2026-12-20 and it is Jupiter"        3/4
#:
#: The second is the more dangerous of the two, because Jupiter is *correct*
#: by the standard sequence -- which is exactly why it reads as grounded. It
#: is still not a fact about this chart, and nothing here computed it.
RULE_NO_UNSTATED_DASHA_STRUCTURE: Final[str] = (
    "FACTS gives exactly one antardasha: the one running now. Never name, date,"
    " sequence or describe any other sub-period - not the one that follows the"
    " running antardasha, and not the contents of any later mahadasha. You know"
    " the Vimshottari order from your own training; that is not a fact about"
    " this chart, and stating it as one is inventing. For every mahadasha other"
    " than the current one you have its start and end dates and nothing else -"
    " give those and stop. Asked which sub-period comes next or when it starts,"
    " say it is not calculated: knowing when the current one ends tells you"
    " nothing about what follows it."
)

#: A fourth fabrication class: astrology the model knows, presented as though
#: this service had computed it. Three sightings in unrelated runs before it
#: was probed deliberately -- "Venus, the ruler of your 7th house", and once
#: "Mars - the lord of your ninth house", which is simply **wrong** (Mars is
#: *placed* in the 9th; the 9th from Virgo is Taurus, ruled by Venus).
#:
#: Measured before this rule: rulership asked directly 3/3, nakshatra lord
#: 2/3. One run also invented an aspect outright -- "Jupiter is in Aquarius,
#: the sign before Pisces, so its influence touches the 7th house area."
#:
#: The boundary was found by testing, not assumed, and it is narrower than it
#: first looks. Two things that LOOK like this class are fine and must stay
#: that way:
#:   * Comparing house numbers FACTS already gives ("the 8th and the 12th are
#:     not opposite") -- 3/3 correct, arithmetic on supplied data.
#:   * A plain property of a sign ("Aries is a fire sign") -- adds no
#:     chart-specific claim beyond the placement already stated.
#: What is forbidden is the *chained* claim: ascendant -> house sign -> sign
#: ruler, which manufactures a lordship this service never calculated and
#: which is the input to exactly the predictive analysis it does not do.
RULE_NO_DERIVED_CHART_FACTS: Final[str] = (
    "Never assign a ruler, lord or dispositor to anything in this chart, and"
    " never claim an aspect, conjunction or influence between two placements."
    " Those come from correspondence tables this service does not compute, so"
    " \"Jupiter rules your 7th house\" presents as calculated something that"
    " was not - and being correct by the standard rules does not make it a"
    " fact about this chart. This holds whether you are asked for a ruler or"
    " just reaching for one while explaining something else. Two narrow things"
    " you may still do: name a sign's element or quality, and compare house"
    " numbers that FACTS already gives you. Neither covers lordship - a"
    " nakshatra's ruling planet is not a plain property, it is the thing this"
    " rule forbids."
)

VOICE_GROUNDED: Final[str] = (
    "Calm and specific. Ground any claim about how someone might feel in a fact"
    " first."
)
#: A scaled ceiling, and the third attempt at this rule. Its history is the
#: argument for the current shape, so it is worth keeping:
#:
#: 1. "Two chart facts maximum per message." Held for narrow questions, broke
#:    on broad ones -- "How is this week looking?" needed five facts, and the
#:    cap could only be met by dropping a relevant one.
#: 2. Pure relevance, no number: "cite what the question needs". Measured
#:    worse than the thing it replaced. "How is this week looking?" went to
#:    **all nine** transiting bodies, in FACTS order, Ketu included. The model
#:    read "relevant" as "in the timeframe asked about", and since every
#:    transit shares today's timeframe, the whole block qualified.
#:
#: So a number is load-bearing after all -- a principle with no ceiling gave
#: the model nothing to stop against. What it needs on top is a tie-break, or
#: it fills the quota positionally: the dasha lord for period questions, the
#: transiting Moon for day/week ones (fastest-moving body, so the one that
#: actually distinguishes this week from last), and otherwise whatever matches
#: the question's own theme. Category membership is explicitly not relevance.
VOICE_FACT_RELEVANCE: Final[str] = (
    "Cite one or two chart facts for a narrow question and at most four for a"
    " broad one. This is a hard ceiling, not an average, and it counts every"
    " planet you name. Sharing a timeframe with the question does not make a"
    " fact relevant - if you are listing placements one after another, you have"
    " already broken this rule. Choose by significance: the current dasha lord"
    " for questions about this period, the transiting Moon for today or this"
    " week, otherwise the fact that most directly matches what was asked. Leave"
    " everything else out, even if it is true. Bodies sharing a house or a sign"
    " are one fact, not one apiece - say it once, naming them together in a"
    " single phrase, and never give each its own sentence or its own meaning."
    " Before you answer, count the chart facts you are about to cite; if there"
    " are more than four, drop the least important ones until there are not."
)
#: The overshoot that survived both the ceiling and the shared-house clause.
#: "Give me a general read on where I'm at right now" kept landing at 5-6 facts
#: by citing the natal placement of *both* running lords:
#:
#:   "Mars, the Mahadasha lord, is natal in Taurus in the 9th house.
#:    Rahu, the antardasha lord, occupies Leo in the 12th house."
#:
#: Two distinct facts, not a groupable cluster, so the shared-house clause does
#: nothing here and an honest fix has to cite less rather than recount.
#:
#: This is under-specification rather than disobedience. VOICE_FACT_RELEVANCE
#: already said to prefer "the current dasha lord" -- singular -- but FACTS
#: gives two lords that are both current, so reading it as "both" is fair. The
#: fix is to say which one.
#:
#: Scoped to *natal placements* on purpose. Naming the periods themselves is a
#: different act, and "What changes when my current dasha ends?" needs two of
#: them -- the one ending and the one beginning. Observed answers to that
#: question cite periods and dates and no natal placement at all, so this rule
#: does not reach it and no second exception is needed.
VOICE_ONE_DASHA_LORD: Final[str] = (
    "Never give the natal placements of both the mahadasha lord and the"
    " antardasha lord in one reply - that is two facts where one will do. Pick"
    " one, normally the antardasha lord as the nearer-term influence. This holds"
    " for any question about the period however it is phrased, including \"what"
    " is the overall shape of this period\". Naming which periods run, or when"
    " one ends and the next begins, is a separate thing and is always allowed."
)
VOICE_END_ON_OBSERVATION: Final[str] = (
    "End on an observation, not an affirmation."
)
VOICE_PLAIN_AND_CONTINUOUS: Final[str] = (
    "Short, plain sentences. Reference earlier conversation naturally instead of"
    " re-explaining the chart from scratch each turn."
)
#: The model emits its own citation syntax unprompted. Nothing in this prompt
#: contains a bracket of any kind -- the rendered prompt is pure ASCII -- but
#: at reasoning_effort="low" it wraps the literal token "FACTS", read off our
#: own section header, in the fullwidth brackets U+3010/U+3011 it was trained
#: to cite with. Its own reasoning trace gives the intent away: "Cite facts."
#: Measured rate before this rule: 5/9 at "low", 2/9 at "medium", 0/9 at
#: "high". Effort is not the lever to pull -- see llm.py on why "low" is
#: pinned -- so the instruction is given explicitly instead.
VOICE_NO_CITATION_MARKERS: Final[str] = (
    "Write plain prose. Never add citation markers, source tags, footnotes or"
    " bracketed references of any kind, and never name the FACTS block in your"
    " reply - it is where your information comes from, not something to cite."
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
    VOICE_ONE_DASHA_LORD,
    VOICE_END_ON_OBSERVATION,
    VOICE_PLAIN_AND_CONTINUOUS,
    VOICE_MATCH_TIMESCALE,
    VOICE_NO_CITATION_MARKERS,
)

#: Every rule that must survive into the rendered prompt intact. The line-wrap
#: guard iterates this; adding a rule without adding it here means it is not
#: covered, so keep them together.
PROMPT_RULES: Final[tuple[str, ...]] = (
    ROLE,
    RULE_NO_INVENTION,
    RULE_NO_RELATIONSHIPS,
    RULE_NO_UNSTATED_DASHA_STRUCTURE,
    RULE_NO_DERIVED_CHART_FACTS,
) + VOICE_RULES

#: Structure only. All prose lives in the constants above -- see the note there,
#: and ``test_template_carries_structure_not_prose``.
SYSTEM_PROMPT_TEMPLATE: Final[str] = """\
{role} {rule_no_invention}

{rule_no_relationships}

{rule_no_unstated_dasha_structure}

{rule_no_derived_chart_facts}

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


#: Citation punctuation the model emits unprompted, as raw codepoints.
#:
#: ``openai/gpt-oss-120b`` is trained to cite with fullwidth brackets --
#: U+3010 and U+3011, with U+2020 as the locator separator in the fuller
#: ``[source-dagger-line]`` form. Nothing in this prompt contains a bracket of
#: any kind, so these can only come from the model. Defined here once and
#: reported by :func:`formatting_artifacts_in`, so the characters the tests
#: and the verifier look for cannot drift apart -- the same reasoning as
#: :data:`BANNED_PHRASES`.
#:
#: Deliberately does *not* include U+2011 (non-breaking hyphen), U+202F
#: (narrow no-break space) or U+2019 (curly apostrophe). The model emits all
#: three routinely in dates and contractions; they are typography, not
#: artifacts, and flagging them would bury the signal.
FORMATTING_ARTIFACTS: Final[tuple[str, ...]] = (
    "【",  # LEFT BLACK LENTICULAR BRACKET
    "】",  # RIGHT BLACK LENTICULAR BRACKET
    "†",  # DAGGER, the locator separator in the fuller citation form
)


def banned_phrases_in(text: str) -> list[str]:
    """Which forbidden phrases appear in ``text``, case-insensitively."""
    lowered = text.lower()
    return [phrase for phrase in BANNED_PHRASES if phrase in lowered]


def formatting_artifacts_in(text: str) -> list[str]:
    """Which citation-marker codepoints appear in ``text``.

    A detector, not a filter -- deliberately. This codebase's convention is to
    surface a bad reply rather than quietly launder it: an empty completion is
    raised as an error instead of returned blank, and banned phrases are
    reported by the verifier rather than stripped. Silently deleting the
    marker would leave us unable to notice if the underlying behaviour came
    back, or if it started producing an artifact we have not seen.

    :returns: the offending codepoints, as ``U+XXXX`` strings, in the order
        listed in :data:`FORMATTING_ARTIFACTS`.
    """
    return [f"U+{ord(char):04X}" for char in FORMATTING_ARTIFACTS if char in text]


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
    connection: sqlite3.Connection,
    user_id: str,
    birth: BirthData,
) -> dict[str, Any]:
    """Return the cached natal chart, computing and storing it on first use."""
    stored = db.load_chart(connection, user_id)
    if stored is not None:
        b = stored.get("birth", {})
        if (
            b.get("date") == birth.date.isoformat()
            and b.get("time") == birth.time.isoformat()
            and b.get("lat") == birth.lat
            and b.get("lon") == birth.lon
            and b.get("tz_offset") == birth.tz_offset
        ):
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
        rule_no_unstated_dasha_structure=RULE_NO_UNSTATED_DASHA_STRUCTURE,
        rule_no_derived_chart_facts=RULE_NO_DERIVED_CHART_FACTS,
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
