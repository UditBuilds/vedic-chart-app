# Conventions and gotchas

Standing decisions for this repo, and the traps that produced them. Most were
found the expensive way — by a wrong chart, a silently mangled prompt, or a
rejected push — so they are written down rather than left in someone's head.

**Read this before changing anything under `app/services/`.** Several things
here look like bugs and are deliberate; two of them have a test whose only job
is to fail if you "fix" them.

Every claim below was re-checked against the code as it stands, with file and
line references. Where a reference and this prose disagree, the code is right —
please fix the prose.

---

## Calculation engine

### The ayanamsa must be set explicitly, every time

PyJHora's declared default is `TRUE_PUSHYA`, not Lahiri. Worse, the declared
default is not what you get: **until `set_ayanamsa_mode()` is called, pyswisseph
sits on its own default, Fagan/Bradley** — a Western sidereal ayanamsa, not a
Vedic one at all. Measured at the reference epoch: 24.7179° in force versus
23.8346° for Lahiri.

This is not a rounding concern. Re-measured on the current codebase, computing
the reference nativity without calling the setter moves the first mahadasha
boundary by **483.9 days — about sixteen months.** The Moon's position within
its nakshatra sets the dasha balance, so an ayanamsa error propagates straight
into every dasha date.

`AYANAMSA_NAME` / `_AYANAMSA_MODE` are pinned at `app/services/astrology.py:86-87`
and re-asserted inside the engine lock on every call — `astrology.py:541` and
`astrology.py:623`. Re-asserted rather than set once because this is
process-global state that any other caller can change underneath us.

Related trap: `TRUE_PUSHYA` and `TRUE_CITRA` **crash** `rasi_chart` outright
(`jd -0.001010 outside Moshier planet range`). PyJHora's own declared default
ayanamsa cannot compute PyJHora's own primary chart. Still true today — it
surfaced again while re-verifying this document.

### Rahu and Ketu use the mean node

Mainstream Vedic practice and every mass-market kundli tool use the **mean**
node; PyJHora defaults to the true node. They sit ~16.5′ apart, easily enough to
move a graha across a pada boundary.

PyJHora appears to expose a switch, `const.set_node_mode()`. **It does not
work.** `drik._sidereal_planet_list` is built at import time and captures the
old `const._RAHU` as a dictionary *key*, so flipping the constant afterwards
changes nothing. Re-verified: after calling it, the dict is still keyed by
`TRUE_NODE` (11) and contains no `MEAN_NODE` (10) entry at all.

So the node is computed directly, bypassing PyJHora for Rahu/Ketu specifically —
`_mean_node_longitude()` at `astrology.py:313`, calling `swe.MEAN_NODE` at
`astrology.py:335`. It deliberately reuses `drik.PLANET_FLAGS` so the node is
derived under byte-identical conditions to the other seven bodies. Ketu is taken
as exactly opposite rather than fetched.

Rationale constant: `_MEAN_NODE_RATIONALE`, `astrology.py:99`.

### Delta-T is disabled on purpose

Ephemerides are computed in Terrestrial Time; converting a civil birth moment to
TT means adding Delta-T (~63 s in 1998). `swe.calc_ut` does this and is
astronomically correct. **Traditional panchanga software, AstroSage included,
does not.** The gap is negligible for slow bodies but moves the Moon ~39″, which
cascades into a ~7-day shift in every dasha boundary.

We match the convention, not the astronomy — a user whose existing kundli says
one date will not accept ours a week later. `_DELTA_T_DAYS = 0.0` at
`astrology.py:127`, applied at `astrology.py:542` and `astrology.py:627`.
Rationale constant: `_DELTA_T_RATIONALE`, `astrology.py:120`.

Consequence worth knowing: on a reasoning model the token cap covers thinking as
well as output, and here the ephemeris cap covers a similar trap — see
[Empty replies](#empty-replies-are-a-budget-symptom).

### Never call `get_running_dhasa_for_given_date`

It assigns the module global `vimsottari.year_duration` (365.256364 →
365.25898927636445) and **never restores it**, so calling it once changes every
later dasha result in the same process. Request *N* would disagree with request 1.

Both the timeline and the running periods are derived from a single
`get_vimsottari_dhasa_bhukthi` call instead — `_dasha_intervals()` at
`astrology.py:384`, the call at `astrology.py:400`. Deriving both from one call
is what makes it impossible for them to disagree. `year_duration` is also
re-pinned before each run.

### PyJHora's declared dependencies are wrong — both lists

Its wheel metadata declares **no dependencies at all** (`Requires-Dist` empty),
while its calculation modules import seven packages at module scope. Its
bundled `requirements.txt` lists PyQt6, pyqtgraph and img2pdf — needed only by
`jhora.ui.*`, which we never import — and **omits `python-dateutil`, which its
code actually imports.**

Neither list is usable. The empirically-derived set, found by resolving each
`ImportError` in turn, is pinned in [`requirements.txt`](requirements.txt) with
a comment saying so. PyQt6 is deliberately absent: the calculation modules
import cleanly without it.

### Chart row order is not PyJHora's own constant order

`rasi_chart` returns rows keyed `0..8` in traditional Vedic order:

```
0=Sun  1=Moon  2=Mars  3=Mercury  4=Jupiter  5=Venus  6=Saturn  7=Rahu  8=Ketu
```

This is **not** the swisseph body order and **not** `jhora.const`'s own ids.
`const._MARS` is `4` (the swisseph id), but chart index `4` is **Jupiter**. Re-
verified today. Getting this wrong silently swaps two planets in every chart.

Canonical order lives in `PLANET_NAMES`, `astrology.py:147`.

### The ephemeris runs in Moshier mode by accident

PyJHora requests `swe.FLG_SWIEPH` (the file-based Swiss Ephemeris) and points
`swe.set_ephe_path()` at a directory that ships **zero `.se1` files** — verified
again just now. pyswisseph silently falls back to its built-in Moshier model:
the returned flag has `FLG_MOSEPH` set and `FLG_SWIEPH` clear.

This is convenient — it is what makes "no data files to download" true — but it
is a **silent fallback, not a design choice**, and it is fragile in a specific
way: if anyone ever drops `.se1` files into that directory, swisseph would start
using them and every position would shift slightly, with no error and no log
line. Positions are currently accurate to ≤0.26″ against JPL DE441, so a change
would be a regression, not an upgrade.

It also fixes the valid range at JD 625000.5–2818000.5 (~3001 BCE–3003 CE),
enforced up front at `astrology.py:265` so callers get a clear error rather than
a confusing file-not-found.

---

## LLM / chat layer

### Model, and the standing instruction to re-check it

Currently `openai/gpt-oss-120b` — `DEFAULT_MODEL`, `app/services/llm.py:65`.

It replaced `llama-3.3-70b-versatile`, which Groq scheduled for shutdown on
**2026-08-16**. Both are recorded as `RETIRED_MODEL` / `RETIRED_MODEL_SHUTDOWN`
at `llm.py:68-69`, and a test fails if anything points back at the retired one.

> **This project has already needed two model swaps.** Do not assume the model
> above is still current. Check <https://console.groq.com/docs/deprecations>
> before building on it, and prefer querying the live models endpoint over
> reading the docs — the API is the only thing that knows what actually exists.

The alternative Groq recommends, `qwen/qwen3.6-27b`, was tested and rejected: it
emits a literal `<think>` block **into** `content`, and burned the whole
400-token cap on reasoning without reaching an answer. `reasoning_format="hidden"`
removed the visible marker but still consumed the cap and returned an empty
message.

### Rate limits and the pacing they force

Read from live response headers, not the docs, for the current model:
**1,000 requests/day, 8,000 tokens/min, 200,000 tokens/day.**

Tokens-per-minute binds first. A turn costs roughly 2,400–2,900, so about
**three turns a minute**. Note this dropped by a third from the retired model's
12,000/min — every available replacement reports 8,000 — while the daily ceiling
doubled.

`scripts/verify_chat.py` paces itself between turns for exactly this reason.
Without it the verification run dies partway through on a 429. If you add turns
to that script, check the arithmetic rather than assuming headroom.

### `reasoning_effort="low"`, specifically

`REASONING_EFFORT`, `llm.py:78`. Not a default worth changing casually:

- `"medium"` spent the entire 400-token budget on reasoning and truncated the
  visible answer mid-sentence.
- `"none"` is **rejected by the API** for this model ("must be one of `low`,
  `medium`, or `high`") despite appearing in the SDK's type hints.

### Empty replies are a budget symptom

On a reasoning model the cap covers thinking *plus* visible output, so a cap set
too low yields an **empty message rather than a short one**. `complete()` treats
that as an error and names the likely cause instead of returning a blank reply.
Never surface an empty completion as if it were an answer.

### Natal vs transiting Moon must stay visually distinct

A real regression, worth not repeating. When the nakshatra ordinal was added,
the natal and transiting Moon lines in FACTS became similar in shape — and the
model began reading the transiting Moon's **nakshatra** from one line and its
**house** from the natal Moon, reporting the transiting Moon in the 8th house
when it was in the 10th.

Fix: the transiting Moon's sign, house, nakshatra and pada now sit on a single
explicitly labelled line — `format_transits()`, `app/services/facts.py:126`,
label at `facts.py:145`. A test pins it. If you touch that formatter, keep the
two Moons unmistakable.

### Nakshatra ordinal source

`nakshatra_ordinal()` at `facts.py:29`, rendered by `describe_nakshatra()` at
`facts.py:50`.

The ordinal is recovered from `astrology.NAKSHATRA_NAMES`, **not** by calling
the engine a second time. That tuple is the same ordered sequence the engine's
1-based nakshatra number indexes into — `_nakshatra_and_pada()` at
`astrology.py:293` takes `drik.nakshatra_pada()`'s number and uses it as the
index — so name → position is an exact round trip of what the ephemeris
returned. The two cannot disagree.

> Note: an earlier description of this said the ordinal comes from
> `drik.nakshatra_pada()` directly. It does not; it is that two-step. The
> engine call is the origin, `NAKSHATRA_NAMES` is the lookup.

`jhora.utils.NAKSHATRA_LIST` was considered and **rejected**: it is
language-dependent, defaulting to Tamil transliterations ("Karthigai",
"Poosam"), and shifts with `utils.set_language`, so ordinals read from it would
not line up with the names we publish.

### Prompt rules live in constants, never inline

Every rule is a single-line constant interpolated into the template — see the
block comment above `ROLE` in `app/services/chat_service.py`, and the registry
`PROMPT_RULES` at `chat_service.py:98`.

This exists because the same bug happened twice. Rule text typed as prose inside
the triple-quoted template picked up a literal newline where a space belonged
(the source was wrapped to 79 columns), so the rendered prompt silently stopped
containing the phrase a check searched for — and the check passed anyway. It hit
the banned-phrase list first, then the relational-claim rule **after** the first
fix, because the first fix was applied to the instance rather than the class.

A string with no newline in it cannot be wrapped by the template. Two tests
guard the two directions: one asserts every rule survives into the rendered
prompt (whitespace-insensitively), the other asserts the template still carries
structure rather than prose. Both were proven to fail by reintroducing the bug
on purpose.

**When adding a rule: define a constant, add it to `PROMPT_RULES`, interpolate
it. Do not type it into the template.**

### Open tension: two chart facts per message

`VOICE_TWO_FACTS`, `chat_service.py:69`, asks for at most two chart facts per
reply. **This is not reliably obeyed** — an observed answer to "How is this week
looking?" cited the Moon, Mars, Sun, Mercury and Jupiter.

Recorded here as a known, unresolved tension rather than a settled rule. It is a
voice problem, not a grounding one: the facts cited were correct. If you tighten
it, do it deliberately and re-run the transcripts.

---

## Process

### Commits must use the noreply address

GitHub rejects pushes that would expose a private email — `GH007: Your push
would publish a private email address` — and the whole push fails, not just the
offending commit.

This repo's `user.email` is set to the account's `@users.noreply.github.com`
address. If you clone fresh and your global git identity is a real email, fix it
**before** the first commit; fixing it afterwards means rewriting history, which
is a rebase plus moving every branch ref that pointed at the old commits.

### The GitHub account is `UditBuilds`

Renamed from `Uditkumar05ai`. `gh auth status` still lists both, and may show
the **old** name as the active account while the repo lives under the new one —
verified again today. This is a known cosmetic mismatch, not a misconfiguration.
Don't go chasing it. The remote is what matters:
`https://github.com/UditBuilds/vedic-chart-app`.

### What "verified" is allowed to mean

The standard this project has run on since the first brief, and the reason
several real bugs were caught rather than shipped:

1. **Stubbed-LLM tests prove plumbing, not behaviour.** That prompt assembly,
   persistence and the token cap work says nothing about whether the model
   grounds its answers. Those are different claims and get reported separately.
2. **State observed versus reasoned-about, every time.** "I ran this and saw X"
   and "the code implies X" are not interchangeable. If a check could not be run
   — no API key, no network — say so plainly and claim nothing.
3. **Never report a pass you did not watch happen.** A guard is not verified
   because it exists; it is verified when you have seen it fail on a bug you
   reintroduced and then pass again once reverted.
4. **Prefer an independent source over a second opinion from the same engine.**
   Planetary positions are checked against JPL Horizons (DE441), a genuinely
   different ephemeris — not against another site that runs the same Swiss
   Ephemeris we do.

See the verification sections of [`README.md`](README.md) for what has actually
been checked this way and what has not.
