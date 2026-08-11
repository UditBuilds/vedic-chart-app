# vedic-chart-app

A deterministic Vedic (sidereal) astrology **calculation** service. Birth data
in, structured chart JSON out. No interpretation, no generated text, no LLM in
the path — this service exists so that a later interpretation layer can be
handed facts it is never allowed to invent.

Scope is deliberately thin for v1: **D1 (Rashi) chart + Vimshottari
Mahadasha/Antardasha**. No divisional charts, no other dasha systems, no
shadbala, no doshas.

> **Start with [`CONVENTIONS.md`](CONVENTIONS.md)** before changing anything
> under `app/services/`. Several things in this codebase look like bugs and are
> deliberate — a non-default ayanamsa, the mean lunar node, and a disabled
> Delta-T correction among them — and two have tests whose only job is to fail
> if you "fix" them. It also records the traps that produced those decisions.

---

## Licence — please read before deploying

This project is **AGPL-3.0** (see [`LICENSE`](LICENSE)), and that is not
optional. It depends on [PyJHora](https://pypi.org/project/PyJHora/) (AGPL-3.0),
which in turn depends on [pyswisseph](https://pypi.org/project/pyswisseph/)
(dual-licensed AGPL / commercial). We take the AGPL path.

The practical consequence: **if you run this as a network service, you must
offer its complete corresponding source to its users.** That is why this
repository is public. Making it private while operating a public service on top
of it would not be compliant.

---

## Quick start

```bash
python -m venv .venv && .venv/Scripts/activate   # Windows
pip install -r requirements.txt
python run.py
```

```bash
curl -X POST http://127.0.0.1:5000/api/v1/chart -H "Content-Type: application/json" -d "{\"date\":\"1998-05-24\",\"time\":\"14:40:43\",\"lat\":28.6139,\"lon\":77.2090,\"tz_offset\":5.5}"
```

There is nothing else to install. No ephemeris data files, no API keys, no
network access at runtime — see [Offline guarantee](#offline-guarantee).

### Chat

```bash
export GROQ_API_KEY=...      # free key from https://console.groq.com/keys
python -m app.chat
```

An interactive terminal loop, deliberately — the only way to judge whether the
voice works is to talk to it. `/facts` prints the exact prompt the model
receives, `/reset` clears history, `/quit` exits. The chart calculation itself
stays fully offline; only the interpretation layer touches the network.

### API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness; reports the active ayanamsa. |
| `POST` | `/api/v1/chart` | Compute a chart. |

All five input fields are **required**. Birth time has no fallback: an
unknown-birth-time strategy (noon chart vs. rectification) is a separate design
decision and is not improvised here. Geocoding is out of scope — supply
latitude, longitude and UTC offset directly.

| Status | Meaning |
|---|---|
| `400` | Malformed or missing input. |
| `422` | Well-formed but outside the ephemeris range. |
| `500` | The engine returned something the service refuses to vouch for. |

---

## Engine findings

These were established by inspecting and running **PyJHora 4.8.7 /
pyswisseph 2.10.3.2**, not from documentation. Several contradict reasonable
expectations, so they are recorded here rather than buried in code.

### 1. Public API actually used

| Need | Call |
|---|---|
| Ascendant | `jhora.panchanga.drik.ascendant(jd, place)` → `[sign, deg_in_sign, nakshatra, pada]` |
| Planets | `jhora.horoscope.chart.charts.rasi_chart(jd, place)` → `[['L',(sign,deg)], [0,(sign,deg)], … [8,…]]` |
| Nakshatra/pada | `jhora.panchanga.drik.nakshatra_pada(longitude)` → `[nakshatra, pada, remainder]` |
| Retrograde | `jhora.panchanga.drik.planets_in_retrograde(jd, place)` → list of chart indices |
| Dasha | `jhora.horoscope.dhasa.graha.vimsottari.get_vimsottari_dhasa_bhukthi(jd, place)` → `(balance, 81 rows)` |

**Houses are not returned by the engine.** `rasi_chart` gives each body as
`(sign, degrees into sign)` and carries no cusps, so whole-sign houses are
derived here as `(planet_sign − ascendant_sign) mod 12 + 1`.

> **Index trap.** Chart rows are keyed `0..8` in traditional Vedic order —
> Sun, Moon, **Mars, Mercury, Jupiter, Venus**, Saturn, Rahu, Ketu. This is
> *not* the swisseph body order, and it does not match `jhora.const`: `_MARS`
> is `4` (the swisseph id) while index `4` in a chart row is **Jupiter**.
> Confirmed by matching every chart longitude back to a raw `swe.calc_ut`
> result, and independently by `vimsottari_dict`, whose year allocations
> (`2 → 7`, `3 → 17`, `4 → 16`, `5 → 20`) only make sense in the Vedic order.

The JD you pass encodes the **local wall clock**; the `Place` you pass carries
the offset, and the library converts to UT internally. Verified by holding the
JD fixed and varying only `Place.timezone` — the ascendant moves.

### 2. Is PyQt6 separable? — Yes, cleanly

Every calculation module imports with **PyQt6 absent**. PyQt6 is needed only by
`jhora.ui.*`, which this service never imports.

The real problem is different: **PyJHora declares no dependencies at all**
(`Requires-Dist` is empty in its wheel metadata), yet its calculation modules
import seven packages at module scope. Installing PyJHora alone produces an
`ImportError` chain. The minimum set, found by resolving each failure in turn:

```
pyswisseph  numpy  python-dateutil  pytz  timezonefinder  geocoder  geopy
```

The sdist ships its own `requirements.txt` listing PyQt6, pyqtgraph, img2pdf,
Requests, setuptools and reverse_geocode — but **omits `python-dateutil`, which
the code actually imports.** Neither list is correct; `requirements.txt` here is
the empirically verified one.

Two further notes: `jhora.utils` imports `geocoder` and `geopy` (HTTP clients)
at module scope for optional place-lookup helpers we never call; and importing
`jhora` mutates `sys.path`, appending parent directories of the working
directory.

### 3. Default ayanamsa — **not Lahiri**, and worse than that

`const._DEFAULT_AYANAMSA_MODE` is **`TRUE_PUSHYA`**, not Lahiri. But the
declared default is not even what you get:

> **Until `set_ayanamsa_mode()` is called at least once, pyswisseph stays on
> *its* own default — Fagan/Bradley, a Western sidereal ayanamsa.** Measured at
> the sample epoch: 24.7179° actual vs 22.6972° for the advertised TRUE_PUSHYA
> and 23.8346° for Lahiri.

This is not cosmetic. Switching the sample chart between TRUE_PUSHYA and Lahiri
moves the **entire Vimshottari timeline by ~484 days (~16 months)**, because the
Moon's nakshatra position changes.

Separately, `TRUE_PUSHYA` and `TRUE_CITRA` **crash `rasi_chart`** outright
(`jd -0.001010 outside Moshier planet range`) — PyJHora's own declared default
ayanamsa cannot compute PyJHora's own primary chart. `LAHIRI`, `KP` and `RAMAN`
work.

**This service therefore sets Lahiri explicitly, inside a lock, before every
calculation**, as the output contract promises.

### 4. House system — Whole Sign, and configurable

`rasi_chart` is inherently whole-sign. Other systems exist via
`drik.bhaava_madhya(jd, place, bhava_method=...)`: seven Indian systems
(`const.indian_house_systems` — KN Rao, Parashari whole-sign, KP, BV Raman,
nakshatra-pada equal, two Sripathi variants) and the Western set (Placidus,
Koch, Campanus…). `const.bhaava_madhya_method` defaults to `1` (KN Rao), but
that affects only the bhava functions, **not** `rasi_chart`.

### 5. Moshier vs. ephemeris files — zero setup is real, but by accident

PyJHora requests `swe.FLG_SWIEPH` (the *file-based* Swiss Ephemeris) and calls
`swe.set_ephe_path()` at import — pointing at `jhora/data/ephe/`, which contains
**no `.se1` planetary files** (only star names, leap seconds, orbital elements).

pyswisseph then **silently falls back to Moshier**. Proven from the return flag:

```
requested FLG_SWIEPH = 2   returned retflag = 65860
retflag & FLG_MOSEPH = 4   (Moshier was used)
retflag & FLG_SWIEPH = 0   (no .se1 file was read)
```

So "no data files to download" is true — but it is a silent fallback, not a
design choice, and it fixes the valid range at **JD 625000.5 – 2818000.5**
(≈3001 BCE – 3003 CE). Outside it, swisseph raises a *file-not-found* error
naming a missing `.se1`. This service rejects such dates up front with a message
that names the supported range, rather than surfacing a confusing I/O error.

PyJHora also sets `FLG_TRUEPOS`, i.e. **geometric** positions with no
light-time or aberration correction — worth up to ~43″ against apparent
positions. Relevant only within an arcminute of a sign/nakshatra boundary.

### Engine bug worked around

`vimsottari.get_running_dhasa_for_given_date` assigns the module global
`year_duration` (365.256364 → 365.25898927636445) and **never restores it**,
while `get_vimsottari_dhasa_bhukthi`'s `finally` restores only two of the three
globals it touches. The effect: **calling it once changes every later dasha
calculation in the same process**, so request *N* would disagree with request 1.

This service never calls it. Both the timeline and the running periods are
derived from a **single** `get_vimsottari_dhasa_bhukthi` call, so they cannot
disagree, and `year_duration` is re-pinned before each run.
`test_timeline_is_independent_of_the_as_of_date` is the regression guard.

---

## Verification status

Exactly what was checked, and how. Nothing below is labelled "verified" on the
strength of a type check.

### Independently verified against a third party

Planetary longitudes were cross-checked against **NASA/JPL Horizons**
(`ssd.jpl.nasa.gov`, geocentric apparent ecliptic longitude, QUANTITIES=31),
which runs the **DE441** ephemeris — genuinely independent of the Moshier model
used here. Values were fetched on 2026-08-09 and are quoted verbatim in
`tests/test_independent_verification.py`, so the tests need no network.

Chart 1 — 1998-05-24 14:40:43 IST, New Delhi (09:10:43 UT), JPL interpolated to
the exact second:

| Body | JPL DE441 | This service (via swisseph) | Δ |
|---|---|---|---|
| Sun | 63.0091617° | 63.0091763° | **0.05″** |
| Moon | 43.0996985° | 43.0997709° | **0.26″** |
| Mercury | 44.8177585° | 44.8177671° | **0.03″** |
| Venus | 23.5057087° | 23.5057261° | **0.06″** |
| Mars | 60.1624600° | 60.1624664° | **0.02″** |
| Jupiter | 353.5970132° | 353.5970183° | **0.02″** |
| Saturn | 28.3255655° | 28.3255990° | **0.12″** |

Chart 2 — 1869-10-02 07:11:54 LMT, Porbandar (02:33:28 UT), a 19th-century date
at a different longitude: Sun and Moon agree with JPL within the same
tolerance once the known `FLG_TRUEPOS` and nutation offsets are accounted for.

**Ayanamsa:** Lahiri is defined by India's Calendar Reform Committee as
23°15′00″ at 1956-03-21 00:00 UT. This engine yields **23°15′00.80″** — an
0.8″ agreement, confirming we are on the ayanamsa we claim.

### Verified structurally / by unit test only

| Value | How it was checked |
|---|---|
| **Ascendant** | Cross-checked against AstroSage: Virgo 12°01′58″ here vs its `12-02-03`, **4.8″** apart. Also checked for physical consistency — for an early-afternoon birth the Sun must sit just past culmination, and it lands in house 9. |
| **Houses** | Derived here, not by the engine. Tested against the whole-sign rule, co-tenancy, and Rahu/Ketu being six houses apart. |
| **Nakshatra & pada** | Derived from JPL-verified longitudes against the canonical 13°20′ / 3°20′ divisions, with a guard that skips bodies within 2′ of a boundary. All nine agree with AstroSage's. **Names are this project's table**, not the engine's — PyJHora's default language ships Tamil transliterations (*Karthigai*, *Thiruvaathirai*) and embeds glyphs in its sign/planet names. |
| **Retrograde** | Recomputed independently from swisseph longitude *speed* and compared, for the reference date and for 2020-06-20 (Mercury, Venus, Jupiter, Saturn retrograde; Mars direct). Rahu/Ketu are always retrograde and the engine reflects this **without hand-correction**. |
| **Dasha timeline** | Lords and boundary dates now cross-checked against AstroSage (within 1–2 days). Also tested against the canonical Vimshottari definition: cyclic lord order, per-lord year allocations, 120-year total, exact JD contiguity, all 81 antardashas proportional to `maha × antara ÷ 120`, and boundary resolution at every changeover. |

### Cross-checked against AstroSage

The Vedic convention layer **was** subsequently checked against
[AstroSage's free kundli](https://www.astrosage.com/kundli/) on 2026-08-09,
with inputs matched exactly rather than left to its geocoder (its Settings
panel accepts manual coordinates and an ayanamsa selector). AstroSage confirmed
it used `GMT at Birth 09:10:43`, `Time Zone 5.5`, `28:37:N`, `77:13:E`,
`Ayanamsa 023-50-03 / Lahiri Ayan` — 1.70″ from ours.

Everything user-visible agrees: ascendant sign, all 9 planet signs, all 9
whole-sign houses, moon nakshatra and pada (`BHARANI-2`), and the current
mahadasha and antardasha lords (Mars / Rahu).

That comparison surfaced two **convention** mismatches, since fixed — see
[Deliberate convention choices](#deliberate-convention-choices). After the fix,
Rahu agrees to **14″** (was 989″) and the Moon to **0.8″** (was 38.5″), and the
dasha boundaries land within **1–2 days** of AstroSage's (was ~7 days).

One residual disagreement is worth knowing about. Mars (+48.6″), Saturn
(+51.3″) and Jupiter (−79.6″) differ from AstroSage by more than an
arcminute in Jupiter's case. Delta T does not explain it — it shifts slow
bodies by under 2″. Here the independent evidence favours this service: our
positions match JPL DE441 to ≤0.12″ for exactly those three bodies, so it is
AstroSage departing from the JPL reference. The cause is not visible from
outside; likely a lower-precision series for the outer planets. None of it
changes a sign, nakshatra or pada.

## Deliberate convention choices

Two things here are **intentionally not** the astronomically correct option.
Both are pinned by `tests/test_conventions.py`, which will fail loudly if
someone "corrects" them. The reasoning, in short: this product's credibility
rests on agreeing with the tools its audience already trusts, not on being more
rigorous than them. A user who sees a different nakshatra or a dasha date a
week off their existing kundli concludes we are broken — they do not conclude
that Swiss Ephemeris applies Delta T and AstroSage does not.

**1. Rahu/Ketu use the mean node, not the true node.** They sit ~16.5′ apart
(12°34′15″ vs 12°17′46″ of Leo on the reference chart) — easily enough to move
a graha across a pada boundary. Mainstream Vedic practice uses the mean node;
PyJHora defaults to the true node.

PyJHora *appears* to expose a switch, `const.set_node_mode(use_true)`, which
flips `const._RAHU` between `swe.TRUE_NODE` and `swe.MEAN_NODE`. **It does not
work once the library is loaded**: `drik._sidereal_planet_list` is built at
import time and captures the old `const._RAHU` as a dictionary *key*, so
flipping the constant afterwards changes nothing — verified, Rahu moved 0.0″.
Its own docstring ("call this ONCE at process start") concedes the limitation,
and depending on import order for a correct chart is the same fragility that
already bit us with PyJHora's leaked `year_duration`. So the node is computed
directly via `swe.MEAN_NODE`, reusing `drik.PLANET_FLAGS` so it is derived
under byte-identical conditions to the other seven bodies, and Ketu is taken as
exactly opposite.

**2. The UT→TT (Delta T) correction is disabled.** Ephemerides are computed in
Terrestrial Time; converting a civil birth moment to TT means adding Delta T,
~63 seconds in 1998. `swe.calc_ut` does this and is correct. Traditional
panchanga software, AstroSage included, does not. The gap is negligible for
slow bodies but moves the Moon ~39″ — and because the Vimshottari balance is a
fraction of the Moon's position within its nakshatra, that cascades into a
~7-day shift in *every* dasha boundary.

`swe.set_delta_t_userdef(0.0)` pins Delta T to zero, making `calc_ut` behave as
`calc`. This is the documented pyswisseph override and it reaches PyJHora's
internal `calc_ut` calls without patching or forking. It reproduces AstroSage's
Moon to 0.8″.

Note this shifts *every* body, not only the Moon — Sun −2.5″, Mercury −4.7″,
Venus −3.1″, Mars −1.9″, Jupiter −0.4″, Saturn −0.3″. On the reference chart no
sign, house, nakshatra, pada or retrograde flag changed as a result. The
ascendant is unaffected, since it derives from sidereal time, a UT quantity.

### Offline guarantee

No paid dependency, no API key, and no third-party call. `tests/test_offline.py`
replaces `socket.socket`, `socket.create_connection` and `socket.getaddrinfo`
with functions that raise, then computes both reference charts — so any attempt
to reach the network fails the build. It also asserts the service source
contains no `os.environ`, `getenv`, `api_key` or `requests.` usage.

---

## Tests

```bash
python -m pytest -q
```

195 tests, none of which need a Groq key. `tests/test_dasha.py` is the one to
read first — the dasha boundary maths is where an off-by-one is most likely and
least visible. `tests/test_conventions.py` pins the two deliberate departures
above; `tests/test_transits.py` holds the AstroSage transit fixtures.

The chat tests cover persistence, prompt assembly and the token cap. Whether
the *model* behaves — voice, grounding, memory — cannot be settled by unit
tests; that needs `scripts/verify_chat.py` and a human reading the transcripts.

---

## Transits

`calculate_transits()` reports where the nine grahas are now, in houses counted
from the **natal** ascendant — standard gochar, not a fresh chart cast for the
current moment. Position and house only: no benefic/malefic scoring and no
transit-to-natal aspects.

`calculate_chart()` cannot be reused for this. Its `as_of` parameter only
selects which dasha period is current; the positions it returns are always
natal (verified — the planet list is identical for `as_of` 2001 and 2026). So
transits are a separate path, but they share every primitive that matters: the
same engine lock, ayanamsa, mean-node override and Delta-T convention.

Verified against AstroSage on 2026-08-10 by casting a chart at the transit
instant itself (11:30 IST). **All nine signs match**, and the Moon reads Ardra
pada 4 in both. The stronger check is the handover: AstroSage's panchang puts
Ardra → Punarvasu at 12:27:45 IST and this service puts it at **12:28:12** —
28 seconds apart, which pins the Moon's rate as well as its position.

## Interpretation layer

A chat companion that reads chart facts and answers in a fixed voice. It is
given facts as short labelled English lines rather than raw JSON — the model
reasons better over prose, and a dump invites it to echo schema noise
("your house_from_ascendant is 11") back at the user.

What it may know is exactly what is in that block. Anything absent — D9,
Shadbala, Yogini dasha — it is instructed to decline rather than approximate.

- **Model**: `openai/gpt-oss-120b`. The previous pick,
  `llama-3.3-70b-versatile`, is on Groq's deprecation list with a **2026-08-16
  shutdown**. Groq names two replacements; both were tested live rather than
  chosen from docs, and they differ sharply on the only axis that matters here
  — getting a usable answer inside a small token cap:
  - `openai/gpt-oss-120b` puts its chain of thought in a separate `reasoning`
    field and leaves `content` clean. At `reasoning_effort="low"` a reply costs
    ~130 completion tokens and finishes normally.
  - `qwen/qwen3.6-27b` emits a literal `<think>` block **into** `content`, and
    burned the whole 400-token cap on reasoning without reaching an answer.
    `reasoning_format="hidden"` removed the visible `<think>` but still spent
    the entire cap and returned an **empty** message.
- **Reasoning effort** is `low` deliberately: `medium` spent all 400 tokens
  thinking and truncated the answer mid-sentence, and `none` is rejected by the
  API for this model despite appearing in the SDK's type hints.
- **Free-tier limits**, read from live response headers rather than docs:
  1,000 req/day, **8,000 tokens/min**, 200,000 tokens/day. The per-minute
  ceiling **drops by a third** from the retired model's 12,000 — every
  available replacement reports 8,000. A turn costs ~2,400–2,900 tokens, so
  roughly **three turns a minute**, not the four to six before. The daily
  ceiling moved the other way, 100,000 → 200,000. This makes the terse facts
  block and bounded history window matter more, not less; a test asserts a
  full-history prompt stays under ~3,000 tokens, and the verification script
  paces itself at 22s between turns.
- **Cost control**: `max_completion_tokens` is set on every call, in the single
  function that talks to Groq, and a test fails if a second uncapped call site
  appears. Note the field name — the SDK marks `max_tokens` as "Deprecated in
  favor of `max_completion_tokens`", so the current field is used.
- **State**: natal + dasha cached in `charts` (they never change); transits
  recomputed every turn and deliberately **never** cached; conversation is a
  sliding window of the last 20 messages in `messages`. No summarisation, no
  embeddings, no extracted-facts table.

The banned-phrase list is generated into the prompt from `BANNED_PHRASES`
rather than written inline, so the list the model is given and the list the
verifier greps for cannot drift. Writing them inline let the template's line
wrapping split `"this is your sign to"` across two lines, which silently
weakened both.

How many facts a reply cites is scaled to the question rather than capped at a
number. A flat "two chart facts maximum" was tried and removed: it held for
narrow questions and broke on broad ones — answering "How is this week looking?"
honestly needed five facts, and the ceiling could only be met by dropping a
relevant one. `VOICE_FACT_RELEVANCE` asks for what the question needs and
nothing more; one or two is still the expectation for a narrow question.

Whether that lands is **not** something the test suite can settle — "relevant"
versus "padding" is a judgement about a specific answer. The tests pin the rule
text and guard against a fixed ceiling returning; the transcripts are what
decide it.

```bash
python scripts/verify_chat.py             # adversarial, voice, memory
python scripts/verify_fact_relevance.py   # narrow / broad / broad-sounding citation
```

Both print transcripts in full and need `GROQ_API_KEY`. Read them; neither
returns a verdict on grounding or relevance.

## Design notes

* All calculation logic sits behind `app/services/astrology.py`. The rest of the
  app imports `calculate_chart`, `BirthData` and the exception types — never
  `jhora` directly — so the engine can be swapped without touching the routes.
* swisseph's sidereal mode is **process-global**, and PyJHora mutates
  `const._DEFAULT_AYANAMSA_MODE` as a side effect. Flask is multi-threaded, so
  every calculation runs under a lock with the ayanamsa re-asserted inside it.
* Dasha periods are **half-open** (`start ≤ t < end`), which is what makes a
  boundary unambiguous. Note that a dasha turns over at an *instant*, rarely
  midnight; a bare date is resolved at local noon.
* Errors are never swallowed. If the engine returns a body count, nakshatra
  number or period ordering we do not expect, the request fails with a message
  saying what was wrong rather than returning a plausible chart.
