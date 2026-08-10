"""Groq inference for the interpretation layer.

Model choice
    ``llama-3.3-70b-versatile``. The brief flagged this as an assumption to
    re-check rather than inherit; as of 2026-08-10 it is still listed as a
    GroqCloud *production* model (not preview, not deprecated), 131k context,
    32,768 max completion. ``openai/gpt-oss-120b`` is faster and cheaper but
    the 70B has the stronger reputation for following negative instructions,
    which is most of what the voice rules in the system prompt are.

Free-tier limits that shape this module (llama-3.3-70b-versatile):
    30 requests/min, 1,000 requests/day, **12,000 tokens/min**, 100,000
    tokens/day. Tokens per minute is the binding constraint: a turn costs
    roughly 1,500-2,500 input plus the output cap, so about four to six turns a
    minute. That is fine for a human typing at a prompt, and it is why the
    facts block is formatted tersely and the history window is bounded.

Cost control
    :data:`MAX_COMPLETION_TOKENS` is applied inside :func:`complete`, which is
    the only place in this codebase that calls Groq. There is no code path that
    reaches the API without a cap. Note the field is
    ``max_completion_tokens``: the Groq SDK marks the older ``max_tokens`` as
    "Deprecated in favor of max_completion_tokens", so the current field is
    used even though the brief named the old one.
"""

from __future__ import annotations

import os
from typing import Any, Final

#: Verified against GroqCloud's production model list on 2026-08-10.
DEFAULT_MODEL: Final[str] = "llama-3.3-70b-versatile"

#: Hard ceiling on generated tokens for every call. Replies are meant to be a
#: few short sentences with at most two chart facts, so this is generous.
MAX_COMPLETION_TOKENS: Final[int] = 400

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
        )
    except Exception as exc:
        # Deliberately broad: the SDK raises a family of connection, rate-limit
        # and status errors, and every one of them means "no reply this turn".
        # It is re-raised, never swallowed.
        raise InferenceError(f"Groq request failed: {type(exc).__name__}: {exc}") from exc

    if not response.choices:
        raise InferenceError("Groq returned no choices")
    content = response.choices[0].message.content
    if not content or not content.strip():
        raise InferenceError("Groq returned an empty message")
    return content.strip()
