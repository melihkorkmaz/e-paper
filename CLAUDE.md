# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file Python dashboard for a large Waveshare e-Paper display (10.85") driven by a
Raspberry Pi Zero 2W. It aggregates weather/AQI, Strava, Bambu Lab printer, Roborock vacuum,
Spotify (via Last.fm), Gmail unread count, and Claude Code / Antigravity usage limits into a
3-column minimalist layout, refreshed once per minute.

The target runtime is the Pi itself — most hardware/network integrations cannot be exercised on
a dev machine. The e-ink library (`epd10in85`) and `bambulabs_api` are **vendored** under `lib/`
and imported behind a `try/except ImportError` so the script can be edited (but not fully run)
off-device.

## Run / develop

```bash
python3 main.py                       # full dashboard (needs the Pi + SPI display)
python3 claude.py                     # refresh Claude usage -> usage.json (standalone)
python3 antigravity.py                # refresh Antigravity usage -> limits.json (standalone)
```

On the Pi this runs inside `tmux` (`tmux new -s dashboard`) so it survives SSH disconnects.
There is **no test suite, linter config, or package manifest** — dependencies are installed
manually with `pip3` (see README). Use `uv`/`pytest`/`ruff` only if you introduce them deliberately.

## Architecture

Three processes/roles, communicating through the filesystem and one in-memory store:

1. **`main.py`** — the long-running renderer and data orchestrator. Structure:
   - `DataStore` (line ~188): a single global, lock-guarded (`threading.Lock`) snapshot of every
     widget's latest values, plus a `last_update` map of per-source timestamps used for throttling.
     **All reads/writes must go through `data_store.lock`.**
   - `update_data_thread()` (line ~534): one daemon thread that polls every source on its own
     interval (weather 600s, gmail 300s, claude/antigravity ~per their cadence, etc.), gated by
     `now - data_store.last_update[...] > interval`. To add/modify a data source, add a throttled
     block here and a field on `DataStore`.
   - `roborock_update_thread()` (line ~477): a separate daemon thread because Roborock is async
     (`asyncio` + MQTT) and can't share the requests-based loop.
   - `render_screen(epd, fonts)` (line ~797): pure renderer. Copies the store under lock, then
     draws a 1-bit `PIL.Image` (`col_w = epd.width // 3`, three columns). Returns the image; never
     does I/O beyond reading the store.
   - `main()` loop (line ~1190): every ~60s, render → `epd.getbuffer` → push. Uses **partial
     refresh** normally and a **full refresh every 600 cycles** to clear e-ink ghosting. Each
     refresh is wrapped in a `signal.alarm(20)` watchdog; a `HardwareTimeoutError` or fd-exhaustion
     (`OSError errno 24`) triggers `os.execv(...)` to self-restart the process.

2. **`claude.py` / `antigravity.py`** — standalone usage-quota fetchers, used two ways:
   - **Imported** by `main.py`'s `auth_claude()` / `auth_antigravity()` for the one-time
     interactive OAuth (PKCE) flow at startup; on failure they flip `ENABLE_* = False`.
   - **Shelled out** as subprocesses by `update_data_thread()` (`subprocess.run([sys.executable, ...])`),
     which then read the JSON they write (`usage.json`, `limits.json`). Keep these scripts runnable
     standalone — that contract is what the subprocess invocation depends on.

3. **`lib/`** — vendored, do-not-rewrite dependencies: `waveshare_epd/epd10in85.py` (patched for a
   partial-refresh bug) and `bambulabs_api/`. `fnt/` holds fonts (`.ttc`), `icons/` holds 1-bit `.bmp`
   icons loaded and cached by `get_cached_icon` / `draw_icon`.

## Key conventions

- **Widget toggles** are module-level booleans at the top of `main.py` (`ENABLE_STRAVA`,
  `ENABLE_BAMBU`, `ENABLE_ROBOROCK`, `ENABLE_ANTIGRAVITY`, `ENABLE_CLAUDE`, `ENABLE_SPOTIFY`).
  Disabled hardware widgets fall back to demo widgets (System Load, Crypto) so the layout stays full.
- **Secrets/config live inline** at the top of `main.py` (`PRINTER_CONF`, `ROBOROCK_CONF`,
  `LASTFM_CONF`, lat/lon) and in generated token files (`claude_creds.json`, `strava_token.json`,
  `token.json`, `roborock_session.pkl`, etc.). These are gitignored/local — never commit real values.
- **Failure is silent by design.** `NetworkManager.get_json/get_image` swallow exceptions, recreate
  the session, and return `None`; callers must null-check. The dashboard must keep rendering even when
  every source is down — preserve this resilience rather than letting exceptions propagate to the loop.
- **Hardware refresh rate is a hard limit:** never refresh faster than once per minute. Waveshare
  warns that aggressive refresh on large panels causes ghosting and can permanently damage the display.
- Time helpers: usage `resets_at` values are ISO-8601 UTC; format relative times with `time_until()`.
