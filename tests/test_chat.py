"""Chat layer: persistence, prompt assembly, and cost-control guards.

These run without a Groq key -- the one test that exercises ``respond`` stubs
the inference call. Whether the *model* actually behaves (voice, grounding,
memory) cannot be settled here; that needs real transcripts, and is covered by
``scripts/verify_chat.py``.
"""

from __future__ import annotations

import datetime as _dt
import inspect

import pytest

from app import db
from app.services import chat_service, facts, llm
from app.services.astrology import BirthData, calculate_chart, calculate_transits

TEST_BIRTH = BirthData(
    date=_dt.date(1998, 5, 24), time=_dt.time(14, 40, 43),
    lat=28.6139, lon=77.2090, tz_offset=5.5,
)
TRANSIT_INSTANT = _dt.datetime(2026, 8, 10, 6, 0, 0, tzinfo=_dt.timezone.utc)


@pytest.fixture
def connection(tmp_path):
    conn = db.connect(tmp_path / "test.db")
    yield conn
    conn.close()


@pytest.fixture(scope="module")
def chart() -> dict:
    return calculate_chart(TEST_BIRTH, as_of=_dt.date(2026, 8, 10),
                           transits_at=TRANSIT_INSTANT)


@pytest.fixture(scope="module")
def transits() -> dict:
    return calculate_transits(TEST_BIRTH, "Virgo", at=TRANSIT_INSTANT)


# ------------------------------------------------------------- cost control

def test_max_completion_tokens_is_capped_by_default() -> None:
    assert llm.MAX_COMPLETION_TOKENS > 0
    signature = inspect.signature(llm.complete)
    assert signature.parameters["max_completion_tokens"].default == llm.MAX_COMPLETION_TOKENS


def test_every_groq_call_site_passes_an_explicit_cap() -> None:
    """No code path may reach the API uncapped.

    Checked structurally rather than by trusting the one call site to stay the
    only one: any ``chat.completions.create`` in the package must sit in the
    same call as a ``max_completion_tokens`` argument.
    """
    source = inspect.getsource(llm)
    assert "chat.completions.create" in source
    assert source.count("chat.completions.create") == 1, (
        "a second Groq call site appeared; it needs its own explicit cap"
    )
    call_start = source.index("chat.completions.create")
    call_body = source[call_start:call_start + 600]
    assert "max_completion_tokens=" in call_body


def test_non_positive_cap_is_rejected() -> None:
    with pytest.raises(ValueError, match="must be positive"):
        llm.complete("system", "hello", max_completion_tokens=0)


def test_missing_api_key_is_a_clear_error(monkeypatch) -> None:
    monkeypatch.delenv(llm.ENV_VAR, raising=False)
    with pytest.raises(llm.MissingAPIKeyError, match="GROQ_API_KEY"):
        llm.complete("system", "hello")


# ------------------------------------------------------------- persistence

def test_chart_is_cached_and_reused(connection) -> None:
    first = chat_service.ensure_chart(connection, "u1", TEST_BIRTH)
    second = chat_service.ensure_chart(connection, "u1", TEST_BIRTH)
    assert first == second


def test_cached_chart_never_stores_transits(connection) -> None:
    """Storing a transit snapshot would mean serving a stale sky later."""
    chat_service.ensure_chart(connection, "u1", TEST_BIRTH)
    stored = db.load_chart(connection, "u1")
    assert "transits" not in stored["chart"]
    assert "dasha" in stored["chart"]


def test_messages_round_trip_oldest_first(connection) -> None:
    for i in range(4):
        db.append_message(connection, "u1", "user", f"q{i}")
        db.append_message(connection, "u1", "assistant", f"a{i}")
    history = db.recent_messages(connection, "u1")
    assert [m["content"] for m in history[:2]] == ["q0", "a0"]
    assert history[-1]["content"] == "a3"


def test_history_window_keeps_the_most_recent(connection) -> None:
    for i in range(40):
        db.append_message(connection, "u1", "user", f"m{i}")
    history = db.recent_messages(connection, "u1", limit=db.HISTORY_WINDOW)
    assert len(history) == db.HISTORY_WINDOW
    assert history[-1]["content"] == "m39"
    assert history[0]["content"] == "m20"


def test_invalid_role_is_rejected(connection) -> None:
    with pytest.raises(ValueError, match="role must be"):
        db.append_message(connection, "u1", "system", "nope")


def test_messages_are_scoped_per_user(connection) -> None:
    db.append_message(connection, "u1", "user", "mine")
    db.append_message(connection, "u2", "user", "theirs")
    assert [m["content"] for m in db.recent_messages(connection, "u1")] == ["mine"]


def test_clear_messages_removes_only_that_user(connection) -> None:
    db.append_message(connection, "u1", "user", "a")
    db.append_message(connection, "u2", "user", "b")
    assert db.clear_messages(connection, "u1") == 1
    assert db.recent_messages(connection, "u1") == []
    assert len(db.recent_messages(connection, "u2")) == 1


# ---------------------------------------------------------- prompt content

def test_natal_summary_names_every_graha(chart) -> None:
    rendered = facts.format_natal(chart)
    for planet in chart["planets"]:
        assert planet["name"] in rendered
    assert "Virgo rising" in rendered


def test_dasha_summary_carries_both_running_periods(chart) -> None:
    rendered = facts.format_dasha(chart)
    assert "Mahadasha: Mars" in rendered
    assert "Antardasha: Rahu" in rendered
    assert "Next mahadasha:" in rendered


def test_transit_summary_leads_with_the_moon(transits) -> None:
    rendered = facts.format_transits(transits)
    assert "Transiting Moon nakshatra: Ardra pada 4" in rendered
    assert "Sun transiting Cancer" in rendered


def test_history_is_trimmed_from_the_front() -> None:
    """Over budget, the oldest turns go -- the newest must survive."""
    messages = [{"role": "user", "content": "x" * 500} for _ in range(20)]
    messages.append({"role": "user", "content": "MOST RECENT"})
    rendered = facts.format_history(messages)
    assert "MOST RECENT" in rendered
    assert len(rendered) <= facts.MAX_HISTORY_CHARS + 200


def test_empty_history_is_stated_not_blank() -> None:
    assert facts.format_history([]) == "(no earlier conversation)"


def test_system_prompt_contains_facts_and_rules(chart, transits) -> None:
    prompt = chat_service.build_system_prompt(chart, transits, [])
    assert "never invent" in prompt
    # Every banned phrase must reach the model intact -- the list is generated
    # from the constant precisely so line wrapping cannot split one.
    for phrase in chat_service.BANNED_PHRASES:
        assert phrase in prompt.lower(), f"{phrase!r} did not survive into the prompt"
    assert "Mahadasha: Mars" in prompt
    assert "Ardra" in prompt
    assert "Virgo rising" in prompt


def test_system_prompt_has_no_unfilled_placeholders(chart, transits) -> None:
    prompt = chat_service.build_system_prompt(chart, transits, [])
    for token in ("{natal_summary}", "{dasha_summary}",
                  "{transit_summary}", "{recent_messages}"):
        assert token not in prompt


def test_prompt_stays_within_the_free_tier_token_budget(chart, transits) -> None:
    """12,000 tokens/min is the binding Groq limit; keep a turn well inside it.

    Rough proxy of 4 characters per token -- exact enough to catch the prompt
    doubling in size, which is what this guards against.
    """
    history = [{"role": "user", "content": "a typical question about my chart"}
               for _ in range(db.HISTORY_WINDOW)]
    prompt = chat_service.build_system_prompt(chart, transits, history)
    approx_tokens = len(prompt) / 4
    assert approx_tokens < 3000, f"prompt is ~{approx_tokens:.0f} tokens"


# -------------------------------------------------------- banned phrases

@pytest.mark.parametrize("phrase", chat_service.BANNED_PHRASES)
def test_banned_phrase_detector_catches_each_phrase(phrase) -> None:
    assert chat_service.banned_phrases_in(f"Well, {phrase.upper()} really.") == [phrase]


def test_clean_text_trips_nothing() -> None:
    assert chat_service.banned_phrases_in(
        "Mars runs your ninth house. That tends to show up as restlessness."
    ) == []


# ------------------------------------------------------------- turn flow

def test_respond_persists_both_halves_and_recomputes_transits(connection, monkeypatch) -> None:
    """End-to-end turn with inference stubbed, so no key is needed."""
    captured = {}

    def fake_complete(system_prompt, user_message, **kwargs):
        captured["prompt"] = system_prompt
        captured["user"] = user_message
        return "Mars sits in your ninth. That reads as restlessness, not drift."

    monkeypatch.setattr(chat_service.llm, "complete", fake_complete)

    result = chat_service.respond(
        connection, "u1", TEST_BIRTH, "what's going on with me?", now=TRANSIT_INSTANT
    )

    assert result["reply"].startswith("Mars sits")
    assert "Mahadasha: Mars" in captured["prompt"]
    assert "Ardra" in captured["prompt"], "transits must be in the prompt"
    history = db.recent_messages(connection, "u1")
    assert [m["role"] for m in history] == ["user", "assistant"]
    assert history[0]["content"] == "what's going on with me?"


def test_second_turn_sees_the_first(connection, monkeypatch) -> None:
    monkeypatch.setattr(chat_service.llm, "complete",
                        lambda s, u, **k: "noted.")
    chat_service.respond(connection, "u1", TEST_BIRTH, "I am changing jobs",
                         now=TRANSIT_INSTANT)

    seen = {}
    monkeypatch.setattr(
        chat_service.llm, "complete",
        lambda s, u, **k: seen.setdefault("prompt", s) and "" or "ok",
    )
    chat_service.respond(connection, "u1", TEST_BIRTH, "and now?", now=TRANSIT_INSTANT)
    assert "changing jobs" in seen["prompt"]
