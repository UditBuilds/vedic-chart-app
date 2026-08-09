# vedic-chart-app

A deterministic Vedic (sidereal) astrology **calculation** service. Birth data
in, structured chart JSON out. No interpretation, no generated text, no LLM in
the path — this service exists so that a later interpretation layer can be
handed facts it is never allowed to invent.

Scope is deliberately thin for v1: **D1 (Rashi) chart + Vimshottari
Mahadasha/Antardasha**. No divisional charts, no other dasha systems, no
shadbala, no doshas.

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
| **Ascendant** | Not cross-checked numerically against a third party. Checked for physical consistency: for an early-afternoon birth the Sun must sit just past culmination, and it lands in house 9. A gross error (wrong hour, wrong hemisphere) would fail this; a small one would not. |
| **Houses** | Derived here, not by the engine. Tested against the whole-sign rule, co-tenancy, and Rahu/Ketu being six houses apart. |
| **Nakshatra & pada** | Derived from JPL-verified longitudes against the canonical 13°20′ / 3°20′ divisions, with a guard that skips bodies within 2′ of a boundary. **Names are this project's table**, not the engine's — PyJHora's default language ships Tamil transliterations (*Karthigai*, *Thiruvaathirai*) and embeds glyphs in its sign/planet names. |
| **Retrograde** | Recomputed independently from swisseph longitude *speed* and compared, for the reference date and for 2020-06-20 (Mercury, Venus, Jupiter, Saturn retrograde; Mars direct). Rahu/Ketu are always retrograde and the engine reflects this **without hand-correction**. |
| **Dasha timeline** | Not cross-checked against a third-party Vedic tool. Tested against the canonical Vimshottari definition: cyclic lord order, per-lord year allocations, 120-year total, exact JD contiguity, all 81 antardashas proportional to `maha × antara ÷ 120`, and boundary resolution at every changeover. |

**Known gap, stated plainly:** no third-party *Vedic* tool (AstroSage or
similar) was consulted. Those sites are form-driven and could not be captured
as a reproducible fixture — and most run the same Swiss Ephemeris this service
does, so agreement would have been weaker evidence than JPL. The consequence is
that the **Vedic convention layer** — ascendant, nakshatra naming, and the dasha
timeline — rests on canonical definitions and internal consistency, not on an
independent Vedic implementation. Anyone with access to a trusted kundli tool
should spot-check `tests/test_independent_verification.py`'s two charts.

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

111 tests. `tests/test_dasha.py` is the one to read first — the dasha boundary
maths is where an off-by-one is most likely and least visible.

---

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
