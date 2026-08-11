"""Chat layer: persistence, prompt assembly, and cost-control guards.

These run without a Groq key -- the one test that exercises ``respond`` stubs
the inference call. Whether the *model* actually behaves (voice, grounding,
memory) cannot be settled here; that needs real transcripts, and is covered by
``scripts/verify_chat.py``.
"""

from __future__ import annotations

import datetime as _dt
import inspect
import re

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


def test_the_retired_model_is_not_in_use() -> None:
    """llama-3.3-70b-versatile shuts down 2026-08-16; nothing may point at it."""
    assert llm.DEFAULT_MODEL != llm.RETIRED_MODEL
    assert llm.DEFAULT_MODEL == "openai/gpt-oss-120b"


def test_reasoning_effort_is_low_and_passed_on_every_call() -> None:
    """On this model the token cap covers reasoning too.

    Measured live: "medium" spends the entire 400-token budget thinking and
    truncates the visible answer; "low" answers in ~130. "none" is rejected by
    the API despite appearing in the SDK's type hints.
    """
    assert llm.REASONING_EFFORT == "low"
    signature = inspect.signature(llm.complete)
    assert signature.parameters["reasoning_effort"].default == llm.REASONING_EFFORT
    source = inspect.getsource(llm)
    call_start = source.index("chat.completions.create")
    assert "reasoning_effort=" in source[call_start:call_start + 600]


def test_empty_reply_from_an_exhausted_budget_is_diagnosed() -> None:
    """A blank message must never be returned as if it were an answer."""
    source = inspect.getsource(llm.complete)
    assert 'finish_reason == "length"' in source
    assert "reasoning" in source


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
    # Carries the ordinal, and the transiting Moon's own house -- see
    # test_transiting_moon_house_travels_with_its_nakshatra.
    assert "Ardra (6th of 27) pada 4" in rendered
    assert "Sun transiting Cancer" in rendered


def test_transiting_moon_house_travels_with_its_nakshatra(transits) -> None:
    """Regression: the model read the nakshatra here and the house from natal.

    Asked how the week looked it reported the transiting Moon in the 8th house
    -- the natal Moon's house -- while correctly naming its transiting
    nakshatra. Both halves now sit on one explicitly labelled line.
    """
    summary = next(
        l for l in facts.format_transits(transits).splitlines()
        if l.startswith("Transiting Moon")
    )
    assert "house 10" in summary, "the transiting Moon's own house must be on this line"
    assert "Ardra" in summary
    assert "NOT the natal Moon" in summary


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


# ------------------------------------------------- relational fabrication
#
# Two fabrications were observed in live output and are pinned here, the same
# treatment the banned-phrase list got. Both were *relational* claims -- the
# prompt forbade inventing a placement but said nothing about inventing a
# relationship between placements.


def test_every_nakshatra_ordinal_round_trips() -> None:
    """The ordinal must be the engine's own 1-based index, for all 27."""
    from app.services.astrology import NAKSHATRA_NAMES
    for position, name in enumerate(NAKSHATRA_NAMES, start=1):
        assert facts.nakshatra_ordinal(name) == position


def test_ardra_is_the_sixth_nakshatra() -> None:
    """The exact fabrication: the model called Ardra "the 8th nakshatra"."""
    assert facts.nakshatra_ordinal("Ardra") == 6
    assert facts.describe_nakshatra("Ardra") == "Ardra (6th of 27)"


@pytest.mark.parametrize(
    "name,expected",
    [("Ashwini", "Ashwini (1st of 27)"), ("Bharani", "Bharani (2nd of 27)"),
     ("Krittika", "Krittika (3rd of 27)"), ("Rohini", "Rohini (4th of 27)"),
     ("Revati", "Revati (27th of 27)")],
)
def test_ordinal_suffixes_read_naturally(name, expected) -> None:
    assert facts.describe_nakshatra(name) == expected


def test_unknown_nakshatra_is_rejected() -> None:
    with pytest.raises(KeyError, match="unknown nakshatra"):
        facts.nakshatra_ordinal("Definitely Not A Nakshatra")


def test_natal_moon_nakshatra_carries_its_ordinal(chart) -> None:
    rendered = facts.format_natal(chart)
    moon_line = next(l for l in rendered.splitlines() if l.startswith("Moon:"))
    assert "Bharani (2nd of 27)" in moon_line


def test_transit_moon_nakshatra_carries_its_ordinal(transits) -> None:
    assert "Ardra (6th of 27)" in facts.format_transits(transits)


def test_full_mahadasha_sequence_reaches_the_facts(chart) -> None:
    """Without this, "what comes after next" had no grounded answer.

    Only the immediately-following period used to be rendered, so anything
    further ahead was a gap the model filled by inventing.
    """
    rendered = facts.format_dasha(chart)
    for lord in ("Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter",
                 "Saturn", "Mercury", "Ketu"):
        assert f"  {lord}: " in rendered, f"{lord} missing from the sequence"
    assert "Full mahadasha sequence" in rendered


# -------------------------------------------------------- citation markers
#
# Observed live, three times in one verification run: replies carried a
# literal fullwidth-bracket citation marker around the token "FACTS", read off
# our own section header. Nothing in the prompt contains a bracket -- the
# rendered prompt is pure ASCII -- so the model generates it. Measured rate
# before the rule, same questions and effort: 5/9 at "low", 2/9 at "medium",
# 0/9 at "high"; 0/15 after.


def test_the_rendered_prompt_is_pure_ascii(chart, transits) -> None:
    """The premise of the diagnosis, pinned.

    The citation marker cannot be something the model echoed back if we never
    sent a non-ASCII character. If this ever fails, that reasoning is void and
    the leak has to be re-investigated rather than assumed understood.
    """
    prompt = chat_service.build_system_prompt(chart, transits, [])
    offenders = sorted({c for c in prompt if ord(c) > 127})
    assert not offenders, (
        f"prompt is no longer pure ASCII: {[hex(ord(c)) for c in offenders]}"
    )


def test_prompt_forbids_citation_markers(chart, transits) -> None:
    prompt = _collapse(chat_service.build_system_prompt(chart, transits, [])).lower()
    assert "never add citation markers" in prompt
    assert "never name the facts block in your reply" in prompt


@pytest.mark.parametrize("artifact", chat_service.FORMATTING_ARTIFACTS)
def test_artifact_detector_catches_each_codepoint(artifact) -> None:
    found = chat_service.formatting_artifacts_in(f"Rahu begins 2032{artifact} then.")
    assert found == [f"U+{ord(artifact):04X}"]


def test_artifact_detector_catches_the_exact_observed_leak() -> None:
    """Verbatim from the transcript that started this."""
    leaked = (
        "You are in the Mars Mahadasha (2025-07-05 to 2032-07-05) with Rahu "
        "antardasha active (2025-12-01 to 2026-12-20)【FACTS】."
    )
    assert chat_service.formatting_artifacts_in(leaked) == ["U+3010", "U+3011"]


def test_ordinary_typography_is_not_flagged() -> None:
    """The model emits these constantly; flagging them would bury the signal.

    A non-breaking hyphen in a date, a narrow no-break space and a curly
    apostrophe are not artifacts -- the narrow no-break space is the character
    that crashed a verification run, and it is still legitimate output.
    """
    typographic = (
        "Rahu’s period runs 2032‑07‑05 to 2050‑07‑06."
    )
    assert chat_service.formatting_artifacts_in(typographic) == []


# ------------------------------------------------------ fact-citation rule
#
# The flat "two chart facts maximum" was replaced by a relevance principle.
# These pin the replacement's two halves so neither can be lost: the cap is
# gone, and the scaling language that took its place is present. Neither test
# can settle whether the *model* now cites well -- that is a judgement call on
# real transcripts, which is what scripts/verify_fact_relevance.py exists for.


def test_no_hard_ceiling_on_the_number_of_facts(chart, transits) -> None:
    """A fixed cap forces an incomplete answer to a broad question.

    Observed: "How is this week looking?" needed the Moon, Mars, Sun, Mercury
    and Jupiter to answer honestly, and the two-fact ceiling could only be met
    by dropping something relevant.
    """
    prompt = _collapse(chat_service.build_system_prompt(chart, transits, [])).lower()
    for ceiling in ("two chart facts maximum", "facts maximum per message",
                    "at most two facts", "maximum of two"):
        assert ceiling not in prompt, f"a hard fact ceiling is back: {ceiling!r}"


def test_prompt_scales_citation_to_the_question(chart, transits) -> None:
    """Relevance in both directions: don't pad, don't drop."""
    prompt = _collapse(chat_service.build_system_prompt(chart, transits, [])).lower()
    assert "cite only the facts that directly answer what was asked" in prompt
    assert "usually one or two" in prompt, "narrow questions still expect one or two"
    assert "don't pad with facts the question didn't ask for" in prompt
    assert "don't drop one it needs" in prompt


def test_prompt_forbids_inventing_relationships(chart, transits) -> None:
    prompt = chat_service.build_system_prompt(chart, transits, []).lower()
    assert "never state a relationship, comparison, sequence, or change" in prompt


def test_prompt_states_that_a_dasha_change_moves_no_planet(chart, transits) -> None:
    """The exact fabrication: "Rahu will move from your 12th house into the 1st"."""
    prompt = chat_service.build_system_prompt(chart, transits, []).lower()
    assert "never means a planet moved" in prompt
    assert "natal placements are fixed" in prompt


# --------------------------------------------------------- line-wrap guard
#
# Two bugs, one cause: rule text typed inline in the template picked up a
# literal newline where a space belonged, so the rendered prompt stopped
# containing the phrase a check searched for -- and the check passed anyway.
# The pair below covers both directions: the first catches a rule that got
# mangled, the second catches a new rule being typed inline instead of added
# as a constant.

def _collapse(text: str) -> str:
    """Whitespace-insensitive form, so a line break reads the same as a space."""
    return " ".join(text.split())


@pytest.mark.parametrize("rule", chat_service.PROMPT_RULES, ids=lambda r: r[:40])
def test_every_rule_survives_into_the_prompt_intact(rule, chart, transits) -> None:
    """Each rule must appear in the rendered prompt, whitespace aside.

    Comparing collapsed forms is the point: it passes whether the rule is
    wrapped or not, and fails only if the *words* changed or the rule never
    made it in. A rule silently dropped from the template fails here.
    """
    rendered = _collapse(chat_service.build_system_prompt(chart, transits, []))
    assert _collapse(rule) in rendered, (
        f"rule missing from the rendered prompt: {rule[:60]!r}"
    )


def test_every_rule_constant_is_a_single_line() -> None:
    """A string with no newline cannot be split by the template."""
    for rule in chat_service.PROMPT_RULES:
        assert "\n" not in rule, f"rule contains a newline: {rule[:60]!r}"


def test_banned_phrases_are_single_line_too() -> None:
    for phrase in chat_service.BANNED_PHRASES:
        assert "\n" not in phrase


def test_template_carries_structure_not_prose() -> None:
    """The template holds labels and placeholders; prose lives in constants.

    Measured by stripping the placeholders and checking what literal text is
    left. Today that is section headings ("Voice:", "FACTS:", "Natal:") and one
    bullet lead-in. If someone types a new rule directly into the template --
    the exact move that caused both bugs -- this budget blows and points them
    at the constants instead.
    """
    literal = re.sub(r"\{\w+\}", "", chat_service.SYSTEM_PROMPT_TEMPLATE)
    literal = _collapse(literal)
    assert len(literal) < 200, (
        f"the template now carries {len(literal)} chars of literal text: "
        f"{literal!r}. New instruction text belongs in a constant added to "
        f"PROMPT_RULES, not typed into the template."
    )


def test_prompt_rules_registry_covers_the_voice_rules() -> None:
    """A rule outside PROMPT_RULES is a rule the guard does not check."""
    for rule in chat_service.VOICE_RULES:
        assert rule in chat_service.PROMPT_RULES


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
