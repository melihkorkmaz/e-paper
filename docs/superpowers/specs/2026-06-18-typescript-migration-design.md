# TypeScript Migration — Design

**Date:** 2026-06-18
**Status:** Approved (pending Pi prerequisite check)
**Author:** Melih + Claude

## Goal

Move the e-Paper dashboard to TypeScript so it can be developed in a language the
maintainer is fluent in. The driving motivation is editability — **not** a desire to
eliminate Python for its own sake. Therefore the migration deliberately keeps the
parts that are hard to port (and that the maintainer never edits) in Python.

## Non-goals

- Reimplementing the Waveshare e-ink SPI/GPIO driver in Node. The vendored
  `lib/waveshare_epd` (compiled `.so` helpers, patched partial-refresh logic) stays
  in Python. Rewriting it carries hardware-damage risk for no benefit to the goal.
- Reimplementing the Bambu Lab MQTT client in Node. The vendored `lib/bambulabs_api`
  stays in Python.
- Feature parity with removed widgets (see Scope).

## Scope

**Keep (4 widgets):**
- Weather + Air Quality (Open-Meteo, HTTP)
- Claude Code usage (OAuth PKCE + REST)
- Bambu Lab printer (MQTT — stays Python via a data agent)
- Spotify "now playing" (via Last.fm, HTTP)

**Remove entirely:** Gmail, Strava, Roborock, Antigravity, Crypto/finance, System Load.
Their code, icons, and config are deleted during cleanup.

## Chosen approach: Hybrid (TypeScript core + thin Python edges)

Rejected alternatives:
- **Full port** (reimplement SPI driver + Bambu in Node): high effort, high risk
  (hardware damage, immature Node libs), not justified by the goal.
- **Modularize Python only**: cheapest, but leaves the maintainer working in Python.

The hybrid is an evolution of the subprocess + JSON-file pattern the repo already uses
for `claude.py` / `antigravity.py`.

## Architecture

Three independently-supervised OS processes:

```
bambu_agent.py (long-lived, only if Bambu enabled)
    --MQTT--> writes data/printer.json

dashboard (Node/TypeScript, long-lived)
    - fetches Weather/AQI (HTTP), Claude usage (OAuth), Spotify (Last.fm HTTP)
    - reads data/printer.json
    - holds DataStore (plain typed object — single-threaded, no locks)
    - every 60s: renders a 1-bit PNG, writes /tmp/epaper-frame.png,
      spawns display.py and waits (with kill-timeout)

display.py (ephemeral, ~30 lines, spawned once/min)
    - PNG -> epd.getbuffer -> panel
    - partial refresh normally; full refresh every 600 frames
    - the ONLY code that touches the panel; uses lib/waveshare_epd
```

**Key simplification:** Node is single-threaded async, so the Python version's
`threading.Lock` and multi-thread `DataStore` discipline disappear. One async event
loop polls each source on its own timer and mutates a plain object. No locks, no races.

**Resilience preserved:** every fetch is wrapped to log-and-return-`null` on failure; the
render loop never throws. The old `SIGALRM` + `os.execv` self-restart is replaced by the
process boundary — a hung/crashed `display.py` is killed on timeout and retried next
minute without affecting the long-lived Node process.

## Repository structure

```
src/
  config.ts            # typed config (gitignored): lat/lon, lastfm, printer, intervals, enable flags
  store.ts             # DataStore type + single in-memory instance
  scheduler.ts         # async polling loop (per-source intervals)
  main.ts              # entry: start scheduler + 60s render loop
  sources/
    weather.ts         # Open-Meteo weather + AQI
    claude.ts          # OAuth PKCE + usage (port of claude.py)
    spotify.ts         # Last.fm now-playing
    bambu.ts           # reads data/printer.json
  render/
    screen.ts          # 3-column layout (port of render_screen)
    canvas.ts          # canvas setup, font/icon loading, 1-bit PNG export
    widgets/           # one file per widget: clock, weather, claude, spotify, printer
python/
  display.py           # ~30-line display shim
  bambu_agent.py       # long-lived Bambu -> JSON agent (extracted from main.py)
  lib/                 # UNCHANGED vendored waveshare_epd + bambulabs_api
assets/
  fonts/               # existing .ttc fonts
  icons/               # icons converted .bmp -> .png (canvas can't load BMP)
data/                  # runtime JSON (printer.json, claude_creds.json, usage.json) — gitignored
```

`main.py`, `claude.py`, `antigravity.py` are deleted once their TS equivalents are proven.

## The display boundary

Each minute TS: (1) renders a 1-bit black/white PNG at the panel's native resolution,
(2) writes `/tmp/epaper-frame.png`, (3) spawns `python3 python/display.py <path> [--full]`
and waits with a kill-timeout. TS owns the refresh cadence (partial vs. full-every-600)
and passes `--full` accordingly. `display.py` does only:

```python
img = Image.open(path).convert('1')
buf = epd.getbuffer(img)
epd.display(buf) if full else epd.display_Partial(buf, 0, 0, epd.width, epd.height)
```

Bit-packing (`getbuffer`) stays in Python so TS never needs the panel byte format.

## Rendering

- **Library:** `@napi-rs/canvas` (prebuilt ARM64 binaries — no Cairo compile on the Pi;
  Canvas2D API maps almost 1:1 onto PIL `ImageDraw`).
- **Fonts:** load existing `.ttc` via `GlobalFonts.registerFromPath` (Aldrich for text,
  `advanced_led_board-7` for the clock). No conversion.
- **Icons:** one-time `.bmp -> .png` conversion (canvas can't load BMP); loaded and cached
  at runtime like the Python `get_cached_icon`.
- **1-bit output:** draw black on white on RGBA canvas, export PNG; `display.py`'s
  `.convert('1')` does the final threshold. AQI high-pollution inversion is render logic in TS.
- Panel resolution mirrors the `epd10in85` driver constants; `display.py` is source of truth.

## Data flow & scheduling

`scheduler.ts` runs one async loop per source on its own interval (Weather 600s, Claude per
cadence, Spotify 30–60s, Bambu read each render). The render loop is a separate 60s timer
reading the current store snapshot.

## Migration sequence (strangler-fig; both languages coexist)

Each phase ends with something running on the Pi.

1. **Pipeline first** — `display.py` + TS `main.ts` rendering a hardcoded frame. Proves
   TS→PNG→panel end-to-end (highest-risk integration first).
2. **Clock + Weather/AQI** — simplest real widgets.
3. **Claude usage** — port PKCE OAuth + usage + `claude_creds.json` to TS.
4. **Spotify** — Last.fm HTTP.
5. **Bambu** — extract `bambu_agent.py` (long-lived MQTT → `printer.json`); TS reads it.
6. **Cleanup** — delete `main.py`, `claude.py`, `antigravity.py`, dropped widgets/icons.

## Testing

- **Unit (Vitest):** Claude PKCE generation, token-expiry/refresh logic, `time_until`
  formatting, weather-code→icon mapping, AQI threshold/inversion, scheduler throttle
  decisions. Pure functions — where bugs hide.
- **Not unit-tested:** canvas rendering + panel push — verified visually on the Pi;
  `frame.png` can be dumped on a dev machine to eyeball layout without hardware.

## Risks & prerequisites

- **PREREQUISITE — 64-bit Pi OS** required for `@napi-rs/canvas` prebuilt binaries.
  Verify with `uname -m` before Phase 1: `aarch64` = good; `armv7l` = 32-bit (would need
  `pureimage`, slower, or an OS reflash). **Open — to be checked by maintainer.**
- **Memory (Pi Zero 2W, 512 MB):** Node baseline is heavier than Python. A render-once-
  per-minute process should fit; validate in Phase 1. Run Node with capped
  `--max-old-space-size`.
- **Process supervision:** recommend a **systemd service** (`Restart=always`,
  `journalctl` logs) for the Node process and the Bambu agent, replacing `tmux`. `tmux`
  remains an option if preferred.
- **e-ink timing unchanged:** 60s cadence and full-refresh-every-600 port verbatim; no new
  hardware-damage risk.

## Runtime/tooling decisions

- **Node.js LTS (ARM64)**, TypeScript compiled ahead-of-time with `tsc`, run as plain JS
  from `dist/` (faster startup, lower memory than `tsx`/`ts-node` on the Pi).
- **HTTP:** native `fetch` (Node 18+), no axios.
- **PKCE:** Node `crypto` (sha256 + base64url).
- Config validation kept minimal (YAGNI); add `zod` only if config parsing needs it.
```
