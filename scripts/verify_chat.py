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
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

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


def _run(connection, user_id: str, message: str) -> dict:
    return chat_service.respond(connection, user_id, BIRTH, message)


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
        for index, question in enumerate(memory_turns, start=1):
            last_reply = _run(connection, "mem", question)["reply"]
            all_replies.append((question, last_reply))
            print(f"\n[turn {index}] you: {question}\n\n{last_reply}\n")
        recalled = any(
            word in last_reply.lower() for word in ("job", "bangalore", "own", "leav", "start")
        )
        if not recalled:
            failures.append("turn 4 did not reference the turn-1 context")
        else:
            print(">> turn 4 references the turn-1 context: PASS")

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
