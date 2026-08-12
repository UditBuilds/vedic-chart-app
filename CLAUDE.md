# CLAUDE.md

Orientation for a new session. This file is a pointer, not a summary — the
detail lives in two documents and duplicating it here would let the copies
drift.

## Read these first, in full

1. **[`CONVENTIONS.md`](CONVENTIONS.md)** — every standing decision and the trap
   that produced it: ayanamsa, mean node, disabled Delta-T, the dasha engine
   bug, dependency footprint, model deprecation history, prompt-rule structure,
   git identity, and what "verified" is allowed to mean here.
2. **[`README.md`](README.md)** — what the service is, the engine findings, and
   the verification status: exactly what has been checked and how.

**Do not re-derive or re-litigate anything in them.** Several things in this
codebase look like bugs and are deliberate; two have tests whose only job is to
fail if you "fix" them. If a brief you are given contradicts `CONVENTIONS.md`,
stop and report the conflict rather than silently picking one.

## What this is

A deterministic Vedic (sidereal) astrology calculation service — birth data in,
structured chart JSON out — plus a chat layer that interprets those facts and is
never allowed to invent one. Scope is deliberately thin: D1 (Rashi) chart and
Vimshottari Mahadasha/Antardasha. AGPL-3.0, and that is not optional (see the
licence section of the README before deploying).

## Layout

| Path | What lives there |
|---|---|
| `app/services/astrology.py` | All calculation. Nothing else imports `jhora`. |
| `app/services/facts.py` | Chart dict → the labelled English lines the model reads. |
| `app/services/chat_service.py` | Prompt assembly and one turn end to end. |
| `app/services/llm.py` | The only place that calls Groq. |
| `app/routes.py`, `app/chat.py` | HTTP API; interactive terminal chat. |
| `scripts/verify_*.py` | Live-model checks that print transcripts. |

## Commands

```bash
python -m pytest -q
```

219 tests, none of which need a Groq key. On Windows use `.venv/Scripts/python.exe -m pytest -q`.

```bash
python run.py            # HTTP API on 127.0.0.1:5000
python -m app.chat       # interactive chat; needs GROQ_API_KEY
```

## The Groq key

Only the interpretation layer needs it. Chart calculation is fully offline and
`tests/test_offline.py` fails the build if that stops being true.

Read from the `GROQ_API_KEY` environment variable, in exactly one place —
`_client()` at `app/services/llm.py:101`, reading it at `llm.py:107`. The name
is pinned as `ENV_VAR` at `llm.py:86`. There is no config file, no `.env`
loader and no CLI flag; do not add one without saying why. Free key from
<https://console.groq.com/keys>.

```powershell
setx GROQ_API_KEY "gsk_..."       # Windows, persists; reopen the terminal
```

```bash
export GROQ_API_KEY=gsk_...       # bash, current shell only
```

Never commit it. Nothing in the repo should ever contain a literal `gsk_`.

## Working rules that have cost time here

- **Prompt rules are single-line constants, never prose in the template.** Add a
  constant, register it in `PROMPT_RULES`, interpolate it. Typing a rule into
  the triple-quoted template caused the same silent bug twice — the source was
  wrapped to 79 columns, a rule lost a space to a newline, and the check that
  searched for it passed anyway. `CONVENTIONS.md` has the full account.
- **Stubbed-LLM tests prove plumbing, not behaviour.** That prompt assembly and
  the token cap work says nothing about whether the model grounds or paces its
  answers. Report those as separate claims.
- **Say what you ran versus what you reasoned about.** If a check could not be
  run — no API key, no network — say so plainly and claim nothing. Never report
  a pass you did not watch happen; a guard is verified when you have seen it
  fail on a reintroduced bug and pass again once reverted.
- **Some things are judgement calls, not pass/fail.** Voice, grounding and
  whether a cited fact earned its place cannot be settled by a green test run.
  Say that rather than forcing a fake mechanical check.
- **Free-tier pacing is real.** 8,000 tokens/min and a turn costs ~2,500–3,000,
  so roughly three turns a minute. If you add turns to a verification script,
  redo the arithmetic instead of assuming headroom.
- **Commits must use the `@users.noreply.github.com` address.** GitHub rejects
  the whole push otherwise. The account is `UditBuilds`; `gh auth status` may
  still show the old name, which is cosmetic — don't chase it.
- **Check the model is still current** before building on it. This project has
  already needed two swaps. Query Groq's live models endpoint, not the docs.
</content>
