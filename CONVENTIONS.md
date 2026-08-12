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

### Fact citation: a scaled ceiling, arrived at the hard way

`VOICE_FACT_RELEVANCE`, `chat_service.py:145`. One or two chart facts for a
narrow question, at most four for a broad one, stated as a hard ceiling and
counted in planets named — **with bodies sharing a house or sign counting as
one fact, not one apiece.**

**This rule has been wrong twice. Both failures are the argument for its
current shape, so do not "simplify" it back into either of them.**

1. **A flat cap** — "two chart facts maximum per message". Held for narrow
   questions, broke on broad ones: answering "How is this week looking?"
   honestly needed five facts, and the ceiling could only be met by dropping a
   relevant one. Recorded here for two releases as an unresolved tension.
2. **A pure relevance principle, no number** — "cite what the question needs".
   This measured **worse than the flat cap it replaced.** "How is this week
   looking?" went from five facts to **all nine** transiting bodies, walked in
   FACTS order, Ketu included. The model read "relevant" as "shares the
   timeframe I was asked about", and every transit shares today's timeframe, so
   the whole block qualified.

The lesson is that a number is load-bearing — a principle with no ceiling gave
the model nothing to stop against — but a number alone is not enough either.
With a ceiling and no tie-break it filled the quota positionally. What fixed it
was adding a significance ordering: the dasha lord for period questions, the
transiting Moon for today/this week (the fastest-moving body, so the one that
actually distinguishes this week from last), otherwise whatever matches the
question's own theme. Plus a behavioural trigger, "if you are listing
placements one after another, you have already broken this rule."

Measured facts per reply across the three broad questions — flat cap, no cap,
ceiling without tie-break, current rule:

| Question | flat | none | +ceiling | current |
|---|---|---|---|---|
| How is this week looking? | 5 | 9 | 4 | 2 |
| Overall shape of this period? | — | ~4 | 2 | 2 |
| General read on where I'm at? | — | ~10 | 8 | 5 |

### The overshoot that survived the ceiling: shared-house enumeration

Measured over 28 runs of the three broad questions, **every reply citing six
or more facts failed the same way** — it walked the occupants of one crowded
house one at a time, giving each its own clause and its own meaning:

> "…the transiting Moon sits in Cancer in the 11th house… **The Sun, Mercury
> and Jupiter also occupy that same 11th house**, adding clarity, communication
> and optimism…"

That is a single observation eating four of the four available citations. The
clause added to `VOICE_FACT_RELEVANCE` makes bodies sharing a house or sign
count once, named together in one phrase. Distribution on the worst question
before and after, ten runs each:

| | distribution | max |
|---|---|---|
| before | 4,9,4,4,4,4,8,4,4,4,4,4,4,4,6,8,5,7 (18 runs) | **9** |
| after | 4,4,5,6,4,5,4,4,5,4 | **6** |

Two honest caveats, because the numbers flatter the change slightly:

- **It partly redefines the metric.** Under the old per-body count some replies
  scored 5 where they now score 2. The behavioural change is real regardless —
  the model now writes one grouped phrase instead of a clause per body — but
  this is not a pure reduction and should not be quoted as one.
- **It does not address the other overshoot shape.** The residual 5s and the
  one 6 are not enumeration; they cite the dasha lords' natal placements
  alongside the dasha and the transiting Moon — "Mars, the Mahadasha lord, is
  natal in Taurus in the 9th house. Rahu, the antardasha lord, is natal in Leo
  in the 12th house." Two distinct facts, not a groupable cluster, so an honest
  fix means citing *less*, not relabelling the count. **Still open**, and
  deliberately so: it was scoped for a follow-up that ran out of daily token
  budget before it started. Note when picking it up that "cite only one lord"
  must not break "What changes when my current dasha ends?", which legitimately
  needs both.

Two things to know before touching it:

- **Guards exist and were proven by injection.** `test_the_ceiling_is_scaled_not_flat`,
  `test_the_ceiling_is_stated_as_hard_and_countable`,
  `test_rule_pushes_significance_over_category_completeness` and
  `test_shared_house_bodies_count_as_one_fact` all fail if the
  flat two-fact cap is reinstated or the clustering clause removed.
- **This one does not reduce to a passing test.** Whether a cited fact is
  relevant or is padding is a judgement call on the specific answer. The tests
  pin the rule's *text*; `scripts/verify_fact_relevance.py` lays out the
  transcripts a human has to read. Its fact-mention tally is a counting aid and
  says so. Do not report this rule as verified on a green test run.

Kept separate from `verify_chat.py` on purpose: that script's turn budget is
already paced to the edge of the free tier — see the note under
[Rate limits](#rate-limits-and-the-pacing-they-force). This one carries its own
arithmetic (10 turns, 25s apart, ~7,100 tokens/min against the 8,000 ceiling).

### The model emits its own citation markers

`VOICE_NO_CITATION_MARKERS`, `chat_service.py:136`, with the detector
`formatting_artifacts_in()` at `chat_service.py:234`.

Replies were arriving with a literal fullwidth-bracket citation marker wrapped
around the token `FACTS` — U+3010/U+3011, read off our own section header.
Investigated rather than stripped, and the investigation is worth not
repeating:

- **No Groq feature is involved.** The request carries five keys. No tools, no
  `tool_choice`, no `search_settings`, no compound/agentic mode. In the full raw
  response, `annotations`, `executed_tools`, `tool_calls` and `mcp_list_tools`
  are all `null`.
- **We are not being echoed.** The rendered system prompt is **pure ASCII** —
  pinned now by `test_the_rendered_prompt_is_pure_ascii`, which exists so this
  premise cannot rot silently. Fullwidth brackets appear nowhere in this repo.
- **The model generates it.** `openai/gpt-oss-120b` is trained to cite in that
  format and treats our `FACTS:` header as a source name. Its reasoning trace
  says so in as many words: *"Cite facts."*
- **It is inversely correlated with `reasoning_effort`**: 5/9 at `low`
  (production), 2/9 at `medium`, 0/9 at `high`. Effort is not the lever — see
  [reasoning_effort](#reasoning_effortlow-specifically) for why `low` is pinned.

The rule alone took it to 0/15 on the same questions, and 0/13 across a wider
set. Deliberately a **detector, not a stripper**: this codebase surfaces a bad
reply rather than laundering it — an empty completion raises instead of
returning blank, and banned phrases are reported rather than deleted. Silently
deleting the marker would leave us unable to notice the behaviour returning.
The detector ignores ordinary typography the model emits constantly
(non-breaking hyphen, narrow no-break space, curly apostrophe); a test pins
that, because flagging those would bury the signal.

### Never assign a ruler or lord — the correctness trap, again

`RULE_NO_DERIVED_CHART_FACTS`, `chat_service.py:109`.

The fourth fabrication class. The model has real astrological knowledge and
states derived conclusions as though this service had computed them. Three
sightings in unrelated runs before it was probed deliberately, and one of them
was **wrong**: "Mars — the lord of your ninth house." Mars is *placed* in the
9th; the 9th from Virgo is Taurus, ruled by Venus.

Measured before the rule, three runs each: rulership asked directly **3/3**,
nakshatra lord **2/3**. One run invented an aspect outright — "Jupiter is in
Aquarius, the sign before Pisces, so its influence touches the 7th house area."
After the rule: **0/3** and **0/3**.

**The boundary is narrower than it looks, and was found by testing rather than
reasoning.** Two things that resemble this class are legitimate and must stay
answerable:

| Case | Before rule | Why it is fine |
|---|---|---|
| "the 8th and 12th are not opposite" | 3/3 correct | arithmetic on house numbers FACTS already gives |
| "Aries is a fire sign" | 3/3 stated | a property of a sign already named; no chart-specific claim |

A rule broad enough to catch rulership would have blocked both. What is
actually forbidden is the **chained** claim: ascendant → house sign → sign
ruler, which manufactures a lordship nothing here calculated, and which is the
input to precisely the predictive analysis this service does not do.

> **The exception's first wording was itself the bug.** It read "state a plain
> property of a sign or nakshatra" — and a regression run immediately exploited
> it with "Bharani is ruled by Venus", which *is* a plain property of a
> nakshatra. The exception had authorised the exact claim the rule forbids.
> Lordship is now excluded by name, and
> `test_the_derived_facts_rule_states_its_two_exceptions` fails if the
> over-broad wording returns. This is worth remembering when widening any
> exception here: the model will find the widest reading.

Note also that the leak appeared when lordship was **volunteered** mid-answer,
not when it was asked for — the direct probes were already clean at that point.
Probing only the question shapes that name the thing you are testing will miss
this class.

The element exception once had no grounding behind it, and the model duly got
one wrong — "Both planets are in water-sign-related houses" about the Moon in
Cancer and Mars in **Gemini**, which is air. That is now fixed by grounding the
property rather than by adding another rule: see
[Static sign properties](#static-sign-properties-are-grounded-element-and-modality-only).

### Static sign properties are grounded — element and modality only

`SIGN_ELEMENTS`, `SIGN_MODALITIES` and `describe_sign()` in
`app/services/astrology.py`; rendered by `facts.py` wherever a sign appears,
natal and transiting alike, as `Gemini (air, dual)`.

**Why grounded rather than ruled against.** The model asserted an element from
memory and got it wrong (Gemini called water). A rule saying "be careful" has
nothing behind it; a fact in FACTS does. The general principle: when a property
is static, deterministic and cheap, putting it in front of the model converts a
fabrication risk into a grounded answer — the same move already made for the
nakshatra ordinal after "Ardra is the 8th".

**Both tables are inverted out of `jhora.const`, not retyped.** The library
already ships `fire_signs`/`earth_signs`/`air_signs`/`water_signs` and
`movable_signs`/`fixed_signs`/`dual_signs`. A hand-copied table would be a
second source of truth that can silently drift from the engine — the same class
of risk as the assumed ayanamsa and the assumed node mode. `_signs_by_group()`
raises if a sign gets two values or none, so a bad table fails at import rather
than producing a plausible chart.

Cross-checked structurally rather than by restating it: element is a perfect
4-cycle from Aries and modality a perfect 3-cycle, which is what triplicity and
quadruplicity mean. `test_element_is_a_four_cycle_and_modality_a_three_cycle`
pins that, and it is the closest thing to an independent source available
offline.

**The sign's ruling planet is deliberately NOT grounded.** It is equally
static, and PyJHora has it (`const.house_lords_dict`). It is left out because
it is the one static property that completes the chained claim
`RULE_NO_DERIVED_CHART_FACTS` blocks:

> 7th house is Pisces → Pisces is ruled by Jupiter → "Jupiter rules your 7th
> house"

Grounding the benign half would hand the model the missing link to the half
that took real effort to block. `test_the_sign_ruler_is_deliberately_not_grounded`
pins the decision so it is not "completed" without reading this.
**This is an accepted residual risk, not an oversight:** the model can still
volunteer a sign ruler from memory, and nothing in FACTS contradicts it.
Grounding it *and* verifying the chained claim stays blocked is the open
follow-up — it needs a live token budget that was not available when this
landed.

**Cost:** +78 tokens per turn, measured. A turn goes ~1,650 → ~1,728, so the
8,000/min ceiling allows 4.63 turns a minute instead of 4.85. The verification
scripts pace at 2.4/min, so nothing there changes.

### Never describe a dasha sub-period that was not computed

`RULE_NO_UNSTATED_DASHA_STRUCTURE`, `chat_service.py:77`.

The third fabrication class, after the movement one and the ordinal one. FACTS
carries every mahadasha's start and end date but **exactly one antardasha, the
running one**. The model fills the gap from the Vimshottari order it knows
independently and states the result as chart fact. Two shapes, four runs each:

| Fabrication | Rate |
|---|---|
| "The antardasha sequence will restart under Rahu's sub-periods" | 2/4 |
| "Your next antardasha begins 2026-12-20 and it is Jupiter" | 3/4 |

**The second is the dangerous one, because Jupiter is correct** — it is what
the standard sequence gives. That is precisely why it reads as grounded. It is
still not a fact about this chart and nothing here computed it. A fabrication
that happens to be right is not a smaller problem; it is a harder one to catch.

Worth knowing what is *not* in this class: the model already declines future
transits and future sub-periods unprompted, and gets arithmetic on the given
dates right. Five of seven probes were clean before any rule existed. The class
is narrow but intermittent, which is why the rate was measured over repeats
rather than judged from one run.

After the rule, 0/16 across the same probes. `test_prompt_forbids_inventing_unstated_dasha_structure`
guards the rule text; `test_the_facts_block_really_does_carry_only_one_antardasha`
guards its *premise* — if the formatter ever starts emitting a full antardasha
sequence, the rule becomes actively wrong rather than merely unnecessary, and
that test fails first. Both proven by injection.

The timescale-matching rule, `VOICE_MATCH_TIMESCALE`, is unchanged and still
governs *which* facts a question reaches for. This rule governs how many.

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
