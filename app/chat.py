"""Interactive chat loop: ``python -m app.chat``.

A terminal loop rather than an HTTP route or a UI, because the only way to know
whether the voice works is to talk to it. Everything real lives in
``app.services.chat_service``; this file is input, output and error handling.

Commands: ``/facts`` prints the exact prompt the model is given, ``/reset``
clears history, ``/quit`` exits.
"""

from __future__ import annotations

import datetime as _dt
import sys

from app import db
from app.services import chat_service
from app.services.astrology import AstrologyError, BirthData, calculate_transits
from app.services.llm import LLMError, MissingAPIKeyError

#: v1 has a single hardcoded user, matching the brief. Same reference nativity
#: used throughout the repo: 1998-05-24 14:40:43 IST, New Delhi.
TEST_BIRTH = BirthData(
    date=_dt.date(1998, 5, 24),
    time=_dt.time(14, 40, 43),
    lat=28.6139,
    lon=77.2090,
    tz_offset=5.5,
)

BANNER = """\
Vedic chart companion. Facts come from your chart; nothing else is invented.
  /facts  show the exact prompt the model receives
  /reset  clear conversation history
  /quit   exit
"""


def main() -> int:
    connection = db.connect()
    user_id = db.DEFAULT_USER_ID

    try:
        chart = chat_service.ensure_chart(connection, user_id, TEST_BIRTH)
    except AstrologyError as exc:
        print(f"could not compute the chart: {exc}", file=sys.stderr)
        return 1

    ascendant = chart["ascendant"]["sign"]
    maha = chart["dasha"]["current_mahadasha"]["lord"]
    print(BANNER)
    print(f"[{ascendant} ascendant | {maha} mahadasha]\n")

    while True:
        try:
            # A leading BOM survives str.strip() and would turn "/quit" into an
            # ordinary message, so it is stripped explicitly. Piped stdin on
            # Windows is the usual source.
            message = input("you: ").strip().lstrip("﻿").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return 0

        if not message:
            continue
        if message in ("/quit", "/exit"):
            return 0
        if message == "/reset":
            removed = db.clear_messages(connection, user_id)
            print(f"[cleared {removed} messages]\n")
            continue
        if message == "/facts":
            transits = calculate_transits(TEST_BIRTH, ascendant)
            history = db.recent_messages(connection, user_id)
            print(chat_service.build_system_prompt(chart, transits, history))
            print()
            continue

        try:
            result = chat_service.respond(connection, user_id, TEST_BIRTH, message)
        except MissingAPIKeyError as exc:
            print(f"\n{exc}\n", file=sys.stderr)
            return 1
        except LLMError as exc:
            # A failed turn is not fatal to the session -- report and continue,
            # but never fabricate a reply to paper over it.
            print(f"\n[inference failed: {exc}]\n", file=sys.stderr)
            continue
        except AstrologyError as exc:
            print(f"\n[chart calculation failed: {exc}]\n", file=sys.stderr)
            continue

        print(f"\n{result['reply']}\n")


if __name__ == "__main__":
    raise SystemExit(main())
