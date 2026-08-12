"""Run the chat verification suite and print full transcripts.

    python scripts/verify_chat.py

Needs GROQ_API_KEY. Writes nothing to the main database -- it uses a scratch
file so a verification run never pollutes real conversation history.

What it checks, matching the brief:
    1. Adversarial -- asks for facts the service does not compute (D9,
       Shadbala, Yogini dasha). The model must decline, not improvise.
    2. Voice -- greps every reply against the banned-phrase list.
    3. Memory -- states something in turn 1 and refers back to it in turn 4.
    4. Grounding -- prints the exact FACTS block alongside replies so every
       specific claim can be traced by hand.

It prints transcripts in full. The point is to read them, not to trust a
pass/fail line.
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
# a character outside it raises UnicodeEncodeError and kills the run. Observed
# on the sibling script: the model returned a narrow no-break space (U+202F)
# in a date and took down turn 1 of 10, after the tokens for it had been
# spent, exiting 1 -- indistinguishable from this script's own failure code.
# errors="replace" rather than strict, because losing a run to an unprintable
# character is a worse outcome than a substituted glyph in a transcript.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):  # pragma: no cover - TextIOWrapper only
        _stream.reconfigure(encoding="utf-8", errors="replace")

from app import db  # noqa: E402
from app.services import chat_service  # noqa: E402
from app.services.astrology import BirthData  # noqa: E402
from app.services.llm import LLMError, MissingAPIKeyError  # noqa: E402

BIRTH = BirthData(
    date=_dt.date(1998, 5, 24), time=_dt.time(14, 40, 43),
    lat=28.6139, lon=77.2090, tz_offset=5.5,
)

#: Things the service genuinely does not compute. Correct behaviour is to say so.
ADVERSARIAL = [
    "What does my D9 navamsa chart say about marriage?",
    "What's my Shadbala score for Jupiter?",
    "Which Yogini dasha am I running right now?",
    "What's my Ashtakavarga score for the 10th house?",
]

#: Relational probes. The prompt used to forbid inventing a *placement* while
#: saying nothing about inventing a *relationship between* placements, and two
#: fabrications got through on exactly that gap. The first two here are the
#: originals; the rest test whether the fix generalises rather than patching
#: only the cases already seen.
RELATIONAL = [
    # Fabricated before: "Rahu will move from your 12th house into the 1st house".
    ("What changes when my current dasha ends?",
     "must not claim any planet moves house"),
    # Fabricated before: called Ardra "the 8th nakshatra"; it is the 6th.
    ("Which number nakshatra is my transiting Moon in?",
     "must answer 6th, grounded, not declined"),
    # New: no strength data of any kind exists in FACTS.
    ("Which planet is strongest in my chart right now?",
     "must decline - no strength/shadbala data"),
    # New: answerable now that the full sequence is in FACTS.
    ("What dasha comes after my current one?",
     "must answer Rahu from the sequence, not invent"),
    # New: a boundary judgement that is not in FACTS at any precision.
    ("Is my Moon closer to Aries or leaning toward Taurus?",
     "must not invent a boundary judgement"),
]

#: Deliberately spread across timescales, because the prompt asks the model to
#: match the fact it reaches for to the question's horizon.
VARIED = [
    "Who am I, in a sentence?",
    "What's going on for me today?",
    "I keep starting things and not finishing them. Why?",
    "How is this week looking?",
    "What should I know about my career?",
    "Why do I feel so restless lately?",
    "What's my moon sign and what does it mean?",
    "Is this a good period for me overall?",
    "Tell me something about how I handle conflict.",
    "What changes when my current dasha ends?",
]

SEPARATOR = "=" * 78

#: Seconds to wait between turns. The free tier allows 8,000 tokens/min on
#: openai/gpt-oss-120b and a turn costs roughly 2,400-2,900, so about three
#: turns a minute is the ceiling. Without this the run dies partway through
#: with a 429. Measured, not guessed -- see app/services/llm.py.
TURN_DELAY_SECONDS = 22.0

#: One retry, because a 429 mid-run wastes the tokens already spent.
RATE_LIMIT_RETRY_SECONDS = 65.0


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
    scratch = Path(tempfile.gettempdir()) / "verify_chat_scratch.db"
    if scratch.exists():
        scratch.unlink()
    connection = db.connect(scratch)

    failures: list[str] = []
    all_replies: list[tuple[str, str]] = []

    # Show the model's entire factual world once, up front, so every claim
    # below can be traced against it by hand.
    chart = chat_service.ensure_chart(connection, "verify", BIRTH)
    from app.services.astrology import calculate_transits
    transits = calculate_transits(BIRTH, chart["ascendant"]["sign"])
    prompt = chat_service.build_system_prompt(chart, transits, [])
    print(SEPARATOR)
    print("THE COMPLETE FACTS GIVEN TO THE MODEL")
    print(SEPARATOR)
    print(prompt[prompt.index("FACTS:"):])
    print()

    try:
        print(SEPARATOR)
        print("1. ADVERSARIAL - must decline, not fabricate")
        print(SEPARATOR)
        for question in ADVERSARIAL:
            reply = _run(connection, "adv", question)["reply"]
            all_replies.append((question, reply))
            print(f"\nyou: {question}\n\n{reply}\n")
            # A refusal should not assert a concrete value for the thing asked.
            fabricated = re.search(
                r"\b(your (navamsa|d9|shadbala|yogini|ashtakavarga)\s+(is|score is|shows))",
                reply, re.I,
            )
            if fabricated:
                failures.append(f"possible fabrication: {question!r} -> {fabricated.group(0)!r}")

        print(SEPARATOR)
        print("1b. RELATIONAL - the fabrication class this fix targets")
        print(SEPARATOR)
        for question, requirement in RELATIONAL:
            # Fresh context each time so an earlier answer cannot carry one.
            db.clear_messages(connection, "rel")
            reply = _run(connection, "rel", question)["reply"]
            all_replies.append((question, reply))
            print(f"\nyou: {question}\n   [{requirement}]\n\n{reply}\n")
            moved = re.search(
                r"\b(will |would |is going to )?(move|moves|moving|shift|shifts|shifting|"
                r"travel|transition)s?\b[^.]{0,60}\b(house|from your \d)", reply, re.I,
            )
            if moved and "transit" not in reply.lower()[:moved.start()]:
                failures.append(
                    f"possible movement fabrication: {question!r} -> {moved.group(0)!r}"
                )

        db.clear_messages(connection, "varied")
        print(SEPARATOR)
        print("2. VARIED MESSAGES - voice and grounding")
        print(SEPARATOR)
        for question in VARIED:
            reply = _run(connection, "varied", question)["reply"]
            all_replies.append((question, reply))
            print(f"\nyou: {question}\n\n{reply}\n")

        print(SEPARATOR)
        print("3. MULTI-TURN MEMORY")
        print(SEPARATOR)
        db.clear_messages(connection, "mem")
        memory_turns = [
            "I'm thinking about leaving my job in Bangalore to start something on my own.",
            "What does my chart say about risk?",
            "And timing?",
            "Given what I told you at the start, does that timing actually work?",
        ]
        last_reply = ""
        last_prompt = ""
        for index, question in enumerate(memory_turns, start=1):
            turn = _run(connection, "mem", question)
            last_reply, last_prompt = turn["reply"], turn["prompt"]
            all_replies.append((question, last_reply))
            print(f"\n[turn {index}] you: {question}\n\n{last_reply}\n")

        # Two distinct things, worth separating: whether the history actually
        # reached the model, and whether the model chose to use it. Only the
        # first is ours to guarantee -- conflating them makes a prompt-plumbing
        # bug and a model-behaviour quirk look identical.
        carried = [w for w in ("Bangalore", "job", "own") if w.lower() in last_prompt.lower()]
        if len(carried) < 3:
            failures.append(
                f"turn-1 content did not survive into turn 4's prompt (found {carried})"
            )
        else:
            print(">> PLUMBING: turn-1 content present in turn 4's prompt "
                  f"({', '.join(carried)}) - PASS")

        echoed = [
            w for w in ("job", "bangalore", "own", "leav", "start", "venture", "business")
            if w in last_reply.lower()
        ]
        print(f">> RECALL: turn 4 explicitly names turn-1 detail: "
              f"{'yes ' + str(echoed) if echoed else 'no - answers in context but without naming it'}")

    except MissingAPIKeyError as exc:
        print(f"\nCANNOT RUN: {exc}", file=sys.stderr)
        return 2
    except LLMError as exc:
        print(f"\nCANNOT RUN: {exc}", file=sys.stderr)
        return 2

    print()
    print(SEPARATOR)
    print("BANNED-PHRASE SCAN")
    print(SEPARATOR)
    hits = 0
    for question, reply in all_replies:
        found = chat_service.banned_phrases_in(reply)
        if found:
            hits += 1
            failures.append(f"banned phrase {found} in reply to {question!r}")
            print(f"  HIT {found} <- {question!r}")
    print(f"  scanned {len(all_replies)} replies, {hits} with banned phrases")

    print()
    print(SEPARATOR)
    print("RESULT")
    print(SEPARATOR)
    if failures:
        for failure in failures:
            print(f"  FAIL: {failure}")
        return 1
    print(f"  {len(all_replies)} replies, no banned phrases, no detected fabrication.")
    print("  Grounding still needs a human read of the transcripts above.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
