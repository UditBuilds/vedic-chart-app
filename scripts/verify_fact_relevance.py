"""Read the fact-citation rule's behaviour off real transcripts.

    python scripts/verify_fact_relevance.py

Needs GROQ_API_KEY. Writes nothing to the main database.

Why this is a separate script from ``verify_chat.py``: that one's turn budget
is already paced to the edge of the free tier, and CONVENTIONS.md warns
against adding turns to it without redoing the arithmetic. This one has its
own budget, below.

What it is for
    The flat "two chart facts maximum" rule was replaced by a relevance
    principle -- cite what the question needs, nothing more. **That change
    cannot be verified by a passing test.** Whether a cited fact is genuinely
    relevant or is padding is a judgement call on the specific answer, so this
    script's job is to lay the evidence out for a human, not to return a
    verdict.

    The three sets below correspond to the three things that could go wrong:

    1. NARROW -- the regression risk. With the ceiling gone, do single-topic
       questions still answer with one or two facts, or do they bloat?
    2. BROAD -- the thing the change is for. Do these now cite what they need?
       Read each cited fact and ask whether the question actually called for
       it.
    3. BROAD-SOUNDING BUT NARROW -- the adversarial case. A question phrased
       expansively whose honest answer is one fact. Breadth of phrasing must
       not license breadth of citation.

The fact-mention tally printed under each reply is a **counting aid, not a
check**. It greps for chart vocabulary and will over- and under-count: it
cannot tell a cited fact from a passing mention, and it has no opinion on
relevance. Read the reply.
"""

from __future__ import annotations

import datetime as _dt
import re
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Print UTF-8 whatever the console is. On Windows stdout defaults to cp1252,
# and a redirect to a file keeps that default -- so the first reply containing
# a character outside it raises UnicodeEncodeError and kills the run. Observed,
# not hypothetical: the model returned a narrow no-break space (U+202F) in a
# date and took down turn 1 of 10, after the tokens for it had been spent.
# errors="replace" rather than strict, because losing a run to an unprintable
# character is a worse outcome than a substituted glyph in a transcript.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):  # pragma: no cover - TextIOWrapper only
        _stream.reconfigure(encoding="utf-8", errors="replace")

from app import db  # noqa: E402
from app.services import chat_service  # noqa: E402
from app.services.astrology import (  # noqa: E402
    NAKSHATRA_NAMES,
    PLANET_NAMES,
    BirthData,
    calculate_transits,
)
from app.services.llm import LLMError, MissingAPIKeyError  # noqa: E402

BIRTH = BirthData(
    date=_dt.date(1998, 5, 24), time=_dt.time(14, 40, 43),
    lat=28.6139, lon=77.2090, tz_offset=5.5,
)

#: Narrow, single-topic questions. The first five are the fact-audit set from
#: the relational round (``verify_chat.py``'s ``RELATIONAL``, questions only --
#: the fabrication requirements are that script's business, not this one's).
#: They are reused here for a different purpose: each has one right answer, so
#: any extra fact in the reply is bloat the removed ceiling used to prevent.
NARROW = [
    "What changes when my current dasha ends?",
    "Which number nakshatra is my transiting Moon in?",
    "Which planet is strongest in my chart right now?",
    "What dasha comes after my current one?",
    "Is my Moon closer to Aries or leaning toward Taurus?",
    "Why does this week feel heavy?",
]

#: Broad questions. The first is the verified failure case from the brief: it
#: needed the Moon, Mars, Sun, Mercury and Jupiter to answer honestly, which
#: the two-fact ceiling made impossible. The other two are constructed to widen
#: the aperture further -- one across a life-scale horizon, one with no stated
#: horizon at all, which is where a data-dump would show up if it is going to.
BROAD = [
    "How is this week looking?",
    "What's the overall shape of this period in my life?",
    "Give me a general read on where I'm at right now.",
]

#: Broad phrasing, one honest fact. "Everything" invites a sweep, but the only
#: nakshatra fact about the natal Moon in FACTS is its name, ordinal and pada.
#: Reaching past that is padding no matter how open the question sounded.
ADVERSARIAL_BREADTH = [
    ("Tell me everything my chart says about my Moon's nakshatra.",
     "sounds open-ended; FACTS support one fact (natal Moon nakshatra + pada)"),
]

SEPARATOR = "=" * 78

#: Seconds between turns. Arithmetic, not a guess -- 8,000 tokens/min on
#: openai/gpt-oss-120b, and a turn here costs ~2,460-2,960 (the fact-relevance
#: rule added roughly 60 tokens of prompt to the ~2,400-2,900 measured for
#: verify_chat.py). At 25s that is 2.4 turns/min, so ~7,100 tokens/min. The 22s
#: verify_chat.py uses would put this script at ~8,000/min -- exactly the
#: ceiling, with no margin for a longer reply.
TURN_DELAY_SECONDS = 25.0

#: One retry, because a 429 mid-run wastes the tokens already spent.
RATE_LIMIT_RETRY_SECONDS = 65.0

#: Total turns, for the budget line printed at startup.
_TOTAL_TURNS = len(NARROW) + len(BROAD) + len(ADVERSARIAL_BREADTH)

_SIGNS = (
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra",
    "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
)


def _fact_mentions(reply: str) -> dict[str, list[str]]:
    """Chart vocabulary appearing in a reply, grouped -- a counting aid only.

    Deliberately dumb. It cannot distinguish a cited fact from an incidental
    mention, it double-counts a planet named twice in different roles, and it
    has no view on whether a mention is relevant. Its only job is to stop a
    human skim-reading past a fact that is actually there.
    """
    found: dict[str, list[str]] = {}
    for label, vocabulary in (
        ("planets", PLANET_NAMES),
        ("signs", _SIGNS),
        ("nakshatras", NAKSHATRA_NAMES),
    ):
        hits = sorted({
            term for term in vocabulary
            if re.search(rf"\b{re.escape(term)}\b", reply, re.I)
        })
        if hits:
            found[label] = hits
    houses = sorted(set(re.findall(r"\b(\d{1,2})(?:st|nd|rd|th) house\b", reply, re.I)))
    if houses:
        found["houses"] = [f"house {h}" for h in houses]
    if re.search(r"\b(mahadasha|antardasha|dasha)\b", reply, re.I):
        found["dasha"] = ["dasha period referenced"]
    return found


def _print_reply(question: str, reply: str, note: str = "") -> None:
    print(f"\nyou: {question}")
    if note:
        print(f"   [{note}]")
    print(f"\n{reply}\n")
    artifacts = chat_service.formatting_artifacts_in(reply)
    if artifacts:
        # Unlike relevance, this one *is* pass/fail: a citation marker in
        # user-visible output is simply wrong, at any rate.
        print(f"   ** CITATION-MARKER LEAK: {artifacts} **")
    mentions = _fact_mentions(reply)
    if mentions:
        rendered = "; ".join(f"{k}: {', '.join(v)}" for k, v in mentions.items())
        print(f"   -- counting aid (NOT a verdict): {rendered}")
    else:
        print("   -- counting aid (NOT a verdict): no chart vocabulary matched")
    print(f"   -- judge by reading: is every fact above one the question asked for?")


def _run(connection, user_id: str, message: str) -> dict:
    """One turn, paced for the free tier and retried once on a rate limit."""
    try:
        result = chat_service.respond(connection, user_id, BIRTH, message)
    except LLMError as exc:
        if "429" not in str(exc) and "rate" not in str(exc).lower():
            raise
        print(f"  [rate limited; waiting {RATE_LIMIT_RETRY_SECONDS:.0f}s]", flush=True)
        time.sleep(RATE_LIMIT_RETRY_SECONDS)
        result = chat_service.respond(connection, user_id, BIRTH, message)
    time.sleep(TURN_DELAY_SECONDS)
    return result


def main() -> int:
    scratch = Path(tempfile.gettempdir()) / "verify_fact_relevance_scratch.db"
    if scratch.exists():
        scratch.unlink()
    connection = db.connect(scratch)

    chart = chat_service.ensure_chart(connection, "verify", BIRTH)
    transits = calculate_transits(BIRTH, chart["ascendant"]["sign"])
    prompt = chat_service.build_system_prompt(chart, transits, [])

    print(SEPARATOR)
    print("THE COMPLETE FACTS GIVEN TO THE MODEL")
    print("Every fact cited below must be traceable to this block.")
    print(SEPARATOR)
    print(prompt[prompt.index("FACTS:"):])

    print(SEPARATOR)
    print("THE RULE UNDER TEST")
    print(SEPARATOR)
    print(chat_service.VOICE_FACT_RELEVANCE)
    print(f"\n{_TOTAL_TURNS} turns at {TURN_DELAY_SECONDS:.0f}s apart: about "
          f"{_TOTAL_TURNS * TURN_DELAY_SECONDS / 60:.0f} minutes.\n")

    banned: list[str] = []
    leaks: list[str] = []
    try:
        print(SEPARATOR)
        print("1. NARROW - regression check: still ~1-2 facts without the ceiling?")
        print(SEPARATOR)
        for question in NARROW:
            # Fresh context each time; an earlier answer must not carry one.
            db.clear_messages(connection, "narrow")
            reply = _run(connection, "narrow", question)["reply"]
            _print_reply(question, reply)
            banned += chat_service.banned_phrases_in(reply)
            leaks += chat_service.formatting_artifacts_in(reply)

        print(SEPARATOR)
        print("2. BROAD - the case the change is for: relevant, or padded?")
        print(SEPARATOR)
        for question in BROAD:
            db.clear_messages(connection, "broad")
            reply = _run(connection, "broad", question)["reply"]
            _print_reply(question, reply)
            banned += chat_service.banned_phrases_in(reply)
            leaks += chat_service.formatting_artifacts_in(reply)

        print(SEPARATOR)
        print("3. BROAD-SOUNDING, NARROW ANSWER - must not over-cite")
        print(SEPARATOR)
        for question, note in ADVERSARIAL_BREADTH:
            db.clear_messages(connection, "adv")
            reply = _run(connection, "adv", question)["reply"]
            _print_reply(question, reply, note)
            banned += chat_service.banned_phrases_in(reply)
            leaks += chat_service.formatting_artifacts_in(reply)

    except MissingAPIKeyError as exc:
        print(f"\nCANNOT RUN: {exc}", file=sys.stderr)
        return 2
    except LLMError as exc:
        print(f"\nCANNOT RUN: {exc}", file=sys.stderr)
        return 2

    print()
    print(SEPARATOR)
    print("RESULT")
    print(SEPARATOR)
    failed = False
    if banned:
        print(f"  FAIL: banned phrases appeared: {sorted(set(banned))}")
        failed = True
    if leaks:
        print(f"  FAIL: citation markers appeared: {sorted(set(leaks))}")
        failed = True
    if failed:
        return 1
    print("  No banned phrases, no citation markers.")
    print("  Nothing else here is pass/fail. Whether each cited fact earned its")
    print("  place is a judgement call -- read the transcripts above and say so.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
