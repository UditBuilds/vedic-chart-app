"""Groq inference for the interpretation layer.

Model choice
    ``openai/gpt-oss-120b``. The previous pick, ``llama-3.3-70b-versatile``,
    is on Groq's deprecation list with a shutdown date of 2026-08-16; Groq's
    own recommended replacements are this model or ``qwen/qwen3.6-27b``.

    Both were tested live rather than chosen from the docs, and they behave
    very differently on the one axis that matters here -- whether you get a
    usable answer inside a small token cap:

    * ``openai/gpt-oss-120b`` puts its chain of thought in a separate
      ``reasoning`` field and leaves ``content`` clean. At
      ``reasoning_effort="low"`` a full reply costs about 130 completion
      tokens and finishes normally.
    * ``qwen/qwen3.6-27b`` emits a literal ``<think>`` block *into*
      ``content``, and burned the entire 400-token cap on reasoning without
      ever reaching an answer. Setting ``reasoning_format="hidden"`` removed
      the visible ``<think>`` but still consumed the whole cap and returned an
      empty message. Its 16,384 max completion suggests it expects far more
      room than the token budget here allows.

    So the choice is not close, and it is about output discipline rather than
    model quality.

Reasoning effort
    ``low``, deliberately. ``medium`` spent all 400 tokens on reasoning and
    truncated the visible answer mid-sentence. ``none`` is rejected outright by
    the API for this model ("`reasoning_effort` must be one of `low`, `medium`,
    or `high`") despite appearing in the SDK's type hints.

Free-tier limits that shape this module (measured from live response headers
on 2026-08-10, not from the docs):
    ``openai/gpt-oss-120b``: 1,000 requests/day, **8,000 tokens/min**, 200,000
    tokens/day. ``qwen/qwen3.6-27b`` reports the same 8,000/min.
    ``llama-3.3-70b-versatile`` had 12,000/min, so the ceiling drops by a third
    on every available replacement.

    Tokens per minute still binds first. A turn costs roughly 2,400-2,900
    (about 2,500 of prompt plus ~130 of reply), which is close to **three turns
    a minute** rather than the four to six the old model allowed. Comfortable
    for someone typing at a prompt, and it makes the terse facts block and the
    bounded history window matter more, not less. The daily ceiling moved the
    other way: 200,000 against the old 100,000.

Cost control
    :data:`MAX_COMPLETION_TOKENS` is applied inside :func:`complete`, which is
    the only place in this codebase that calls Groq. There is no code path that
    reaches the API without a cap. Note the field is
    ``max_completion_tokens``: the Groq SDK marks the older ``max_tokens`` as
    "Deprecated in favor of max_completion_tokens", so the current field is
    used even though the brief named the old one.

    The cap covers reasoning *plus* visible output on this model, so a cap set
    too low yields an empty message rather than a short one. :func:`complete`
    treats that as an error instead of returning a blank reply.
"""

from __future__ import annotations

import os
from typing import Any, Final

#: Confirmed present and active via the live models endpoint on 2026-08-10.
DEFAULT_MODEL: Final[str] = "openai/gpt-oss-120b"

#: Groq's shutdown date for the model this replaced. Kept as a breadcrumb.
RETIRED_MODEL: Final[str] = "llama-3.3-70b-versatile"
RETIRED_MODEL_SHUTDOWN: Final[str] = "2026-08-16"

#: Hard ceiling on generated tokens for every call. On this model the cap
#: covers reasoning as well as visible output; measured usage at
#: reasoning_effort="low" is ~130, so this leaves roughly 3x headroom.
MAX_COMPLETION_TOKENS: Final[int] = 400

#: See the module docstring: "medium" exhausts the cap on reasoning alone and
#: "none" is rejected by the API for this model.
REASONING_EFFORT: Final[str] = "low"

#: Low but not zero: the voice should be consistent, not robotic.
DEFAULT_TEMPERATURE: Final[float] = 0.6

#: Fail rather than hang if Groq is slow.
REQUEST_TIMEOUT_SECONDS: Final[float] = 30.0

ENV_VAR: Final[str] = "GROQ_API_KEY"


class LLMError(RuntimeError):
    """Base class for inference failures."""


class MissingAPIKeyError(LLMError):
    """``GROQ_API_KEY`` is not set."""


class InferenceError(LLMError):
    """Groq accepted the request but we could not use the result."""


def _client() -> Any:
    """Build a Groq client, or explain exactly what is missing.

    Imported lazily so the rest of the app -- and the whole test suite -- runs
    without the SDK or a key present.
    """
    api_key = os.environ.get(ENV_VAR)
    if not api_key:
        raise MissingAPIKeyError(
            f"{ENV_VAR} is not set. Get a free key at https://console.groq.com/keys "
            f"and export it before starting the chat."
        )
    try:
        from groq import Groq
    except ImportError as exc:  # pragma: no cover - dependency is declared
        raise LLMError(
            "the 'groq' package is not installed; run: pip install -r requirements.txt"
        ) from exc
    return Groq(api_key=api_key, timeout=REQUEST_TIMEOUT_SECONDS)


def complete(
    system_prompt: str,
    user_message: str,
    model: str = DEFAULT_MODEL,
    max_completion_tokens: int = MAX_COMPLETION_TOKENS,
    temperature: float = DEFAULT_TEMPERATURE,
    reasoning_effort: str = REASONING_EFFORT,
) -> str:
    """Send one turn to Groq and return the reply text.

    The conversation history is *not* passed as separate message objects: it is
    already rendered into ``system_prompt`` as a transcript, so the model sees
    the facts and the history as one grounded block. That keeps the "never
    invent a fact" instruction adjacent to the facts themselves.

    :raises MissingAPIKeyError: No API key in the environment.
    :raises InferenceError: The call failed, or returned nothing usable.
    """
    if max_completion_tokens <= 0:
        raise ValueError("max_completion_tokens must be positive")

    client = _client()
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            # Explicit on every call -- an uncapped generation is an uncapped bill.
            max_completion_tokens=max_completion_tokens,
            temperature=temperature,
            reasoning_effort=reasoning_effort,
        )
    except Exception as exc:
        # Deliberately broad: the SDK raises a family of connection, rate-limit
        # and status errors, and every one of them means "no reply this turn".
        # It is re-raised, never swallowed.
        raise InferenceError(f"Groq request failed: {type(exc).__name__}: {exc}") from exc

    if not response.choices:
        raise InferenceError("Groq returned no choices")

    choice = response.choices[0]
    content = choice.message.content
    if not content or not content.strip():
        # On a reasoning model the cap covers thinking as well as output, so
        # the usual cause is a budget too small to reach an answer -- say that
        # rather than reporting a bare "empty response".
        if choice.finish_reason == "length":
            raise InferenceError(
                f"model {model!r} used its entire {max_completion_tokens}-token budget on "
                f"reasoning and produced no visible reply; raise max_completion_tokens "
                f"or lower reasoning_effort (currently {reasoning_effort!r})"
            )
        raise InferenceError(
            f"model {model!r} returned an empty message "
            f"(finish_reason={choice.finish_reason!r})"
        )
    return content.strip()
