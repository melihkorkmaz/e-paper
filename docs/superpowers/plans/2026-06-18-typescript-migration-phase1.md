# TypeScript Migration — Phase 1 (Pipeline Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up an end-to-end TypeScript→PNG→Python→e-ink panel pipeline that renders one real frame, proving the hardest integration before any widgets are ported.

**Architecture:** A Node/TypeScript process renders a 1360×480 1-bit frame with `@napi-rs/canvas`, writes it to a PNG, and spawns a thin Python shim (`display.py`) that pushes the PNG to the Waveshare panel via the unchanged vendored `lib/waveshare_epd` driver. Refresh cadence (partial vs. full-every-600) is owned by TypeScript as a pure function.

**Tech Stack:** Node.js LTS (ARM64), TypeScript (compiled with `tsc`), `@napi-rs/canvas`, Vitest, Python 3 (display shim only).

**Spec:** `docs/superpowers/specs/2026-06-18-typescript-migration-design.md`

---

## Prerequisite (blocking, human-run on the Pi)

- [ ] **Step 0: Confirm 64-bit OS on the Pi**

Run on the Pi: `uname -m`
Expected: `aarch64` (proceed). If `armv7l`: STOP — `@napi-rs/canvas` prebuilt binaries need ARM64; revisit the rendering library in the spec before continuing.

---

## File structure (created in this phase)

```
package.json            # deps + scripts
tsconfig.json           # TS compiler config
vitest.config.ts        # test config
src/
  config.ts             # panel dims, paths, FULL_REFRESH_EVERY
  refresh.ts            # pure refresh-cadence logic (TDD)
  render/
    canvas.ts           # create 1360x480 canvas, register fonts, export PNG
    screen.ts           # Phase-1 placeholder frame (clock + title)
  main.ts               # render loop: render -> write PNG -> spawn display.py
  display.ts            # spawn display.py with kill-timeout
tests/
  refresh.test.ts
python/
  display.py            # ~30-line shim: PNG -> getbuffer -> panel
assets/
  fonts/Aldrich-Regular.ttc          # copied from fnt/
  fonts/advanced_led_board-7.ttc     # copied from fnt/
```

`python/lib/` will hold the vendored driver (symlink or copy of `lib/`) — handled in Task 4.

---

## Task 1: Project scaffold and tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore` (append if exists)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "epaper-dashboard",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node --max-old-space-size=256 dist/main.js",
    "dev": "tsx src/main.ts",
    "test": "vitest run",
    "render:once": "tsx src/main.ts --once"
  },
  "dependencies": {
    "@napi-rs/canvas": "^0.1.58"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
})
```

- [ ] **Step 4: Append Node artifacts to `.gitignore`**

```
node_modules/
dist/
/tmp/epaper-frame.png
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`
Expected: `node_modules/` populated, `@napi-rs/canvas` installs a prebuilt binary with no compile step.

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore package-lock.json
git commit -m "chore: scaffold TypeScript project for e-paper dashboard"
```

---

## Task 2: Refresh-cadence logic (TDD)

The render loop must do a partial refresh normally and a full refresh every 600 frames (porting `main.py:1197-1207`). This is the one piece of pure logic in Phase 1.

**Files:**
- Create: `src/refresh.ts`
- Test: `tests/refresh.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/refresh.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { nextRefresh } from '../src/refresh.js'

describe('nextRefresh', () => {
  it('increments the counter and stays partial below the threshold', () => {
    expect(nextRefresh(0)).toEqual({ full: false, counter: 1 })
    expect(nextRefresh(599)).toEqual({ full: false, counter: 600 })
  })

  it('does a full refresh and resets the counter at the threshold', () => {
    expect(nextRefresh(600)).toEqual({ full: true, counter: 0 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../src/refresh.js`.

- [ ] **Step 3: Write minimal implementation**

`src/refresh.ts`:
```ts
export const FULL_REFRESH_EVERY = 600

export interface RefreshDecision {
  full: boolean
  counter: number
}

/** Port of main.py refresh_counter logic: full refresh every 600 frames. */
export function nextRefresh(counter: number): RefreshDecision {
  if (counter >= FULL_REFRESH_EVERY) {
    return { full: true, counter: 0 }
  }
  return { full: false, counter: counter + 1 }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/refresh.ts tests/refresh.test.ts
git commit -m "feat: add refresh-cadence logic (full refresh every 600 frames)"
```

---

## Task 3: Canvas rendering and PNG export

**Files:**
- Create: `src/config.ts`
- Create: `src/render/canvas.ts`
- Create: `src/render/screen.ts`
- Create: `assets/fonts/Aldrich-Regular.ttc`, `assets/fonts/advanced_led_board-7.ttc` (copies)

- [ ] **Step 1: Copy fonts into `assets/`**

Run:
```bash
mkdir -p assets/fonts
cp fnt/Aldrich-Regular.ttc fnt/advanced_led_board-7.ttc assets/fonts/
```
Expected: two `.ttc` files in `assets/fonts/`.

- [ ] **Step 2: Create `src/config.ts`**

```ts
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(__dirname, '..')

// Waveshare 10.85" native resolution (from lib/waveshare_epd/epd10in85.py)
export const PANEL_WIDTH = 1360
export const PANEL_HEIGHT = 480

export const FRAME_PATH = '/tmp/epaper-frame.png'
export const FONT_DIR = join(ROOT, 'assets', 'fonts')
export const DISPLAY_SCRIPT = join(ROOT, 'python', 'display.py')
export const RENDER_INTERVAL_MS = 60_000
export const DISPLAY_TIMEOUT_MS = 25_000
```

- [ ] **Step 3: Create `src/render/canvas.ts`**

```ts
import { createCanvas, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PANEL_WIDTH, PANEL_HEIGHT, FONT_DIR } from '../config.js'

let fontsRegistered = false

export function registerFonts(): void {
  if (fontsRegistered) return
  GlobalFonts.registerFromPath(join(FONT_DIR, 'Aldrich-Regular.ttc'), 'Aldrich')
  GlobalFonts.registerFromPath(join(FONT_DIR, 'advanced_led_board-7.ttc'), 'ClockLED')
  fontsRegistered = true
}

/** Returns a white-filled 1360x480 context ready to draw black on. */
export function createFrame(): { canvas: ReturnType<typeof createCanvas>; ctx: SKRSContext2D } {
  registerFonts()
  const canvas = createCanvas(PANEL_WIDTH, PANEL_HEIGHT)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT)
  ctx.fillStyle = '#000000'
  return { canvas, ctx }
}

/** Writes the canvas as a PNG. display.py thresholds it to 1-bit. */
export function writeFramePng(canvas: ReturnType<typeof createCanvas>, path: string): void {
  writeFileSync(path, canvas.toBuffer('image/png'))
}
```

- [ ] **Step 4: Create `src/render/screen.ts` (Phase-1 placeholder frame)**

```ts
import type { SKRSContext2D } from '@napi-rs/canvas'
import { PANEL_WIDTH } from '../config.js'

/** Phase-1 proof frame: a title and a large clock, to verify fonts + layout. */
export function renderScreen(ctx: SKRSContext2D, now: Date): void {
  ctx.fillStyle = '#000000'
  ctx.font = '32px Aldrich'
  ctx.fillText('e-Paper Dashboard (TypeScript)', 20, 50)

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  ctx.font = '180px ClockLED'
  const clock = `${hh}:${mm}`
  const w = ctx.measureText(clock).width
  ctx.fillText(clock, (PANEL_WIDTH - w) / 2, 320)
}
```

- [ ] **Step 5: Add a temporary visual-check script and verify on the dev machine**

Run:
```bash
npx tsx -e "import { createFrame, writeFramePng } from './src/render/canvas.js'; import { renderScreen } from './src/render/screen.js'; const { canvas, ctx } = createFrame(); renderScreen(ctx, new Date()); writeFramePng(canvas, './frame-check.png'); console.log('wrote frame-check.png');"
```
Expected: `frame-check.png` (1360×480) exists. Open it — title text and a centered clock render with the correct fonts. Delete it after: `rm frame-check.png`.

- [ ] **Step 6: Commit**

```bash
git add src/config.ts src/render/canvas.ts src/render/screen.ts assets/fonts
git commit -m "feat: canvas frame rendering with fonts and PNG export"
```

---

## Task 4: Python display shim

**Files:**
- Create: `python/display.py`
- Create: `python/lib/` (vendored driver — copy of existing `lib/`)

- [ ] **Step 1: Make the vendored driver available to `python/`**

Run:
```bash
mkdir -p python
cp -R lib python/lib
```
Expected: `python/lib/waveshare_epd/epd10in85.py` exists. (The original `lib/` stays until end-of-migration cleanup.)

- [ ] **Step 2: Create `python/display.py`**

```python
#!/usr/bin/env python3
# Thin display shim: PNG -> 1-bit -> Waveshare 10.85" panel.
# Usage: python3 display.py <png_path> [--full]
import sys
import os
import time
from PIL import Image

BASE_DIR = os.path.dirname(os.path.realpath(__file__))
sys.path.append(os.path.join(BASE_DIR, 'lib'))
from waveshare_epd import epd10in85


def main():
    if len(sys.argv) < 2:
        print('usage: display.py <png_path> [--full]', file=sys.stderr)
        sys.exit(2)
    png_path = sys.argv[1]
    full = '--full' in sys.argv[2:]

    img = Image.open(png_path).convert('1', dither=Image.Dither.NONE)

    epd = epd10in85.EPD()
    if full:
        epd.init()
        epd.Clear()
        time.sleep(1)
        epd.display(epd.getbuffer(img))
        time.sleep(2)
    else:
        epd.init_Part()
        epd.display_Partial(epd.getbuffer(img), 0, 0, epd.width, epd.height)


if __name__ == '__main__':
    main()
```

- [ ] **Step 3: Smoke-test argument handling off-hardware**

Run (on dev machine, no panel): `python3 python/display.py`
Expected: prints usage and exits 2 (the driver import may fail on a non-Pi — that is fine; this step only checks the arg guard runs first, so run it as `python3 -c "import ast; ast.parse(open('python/display.py').read()); print('parse ok')"` if the import blocks).

- [ ] **Step 4: Commit**

```bash
git add python/display.py python/lib
git commit -m "feat: add Python display shim (PNG -> panel)"
```

---

## Task 5: Render loop and subprocess wiring

**Files:**
- Create: `src/display.ts`
- Create: `src/main.ts`

- [ ] **Step 1: Create `src/display.ts`**

```ts
import { spawn } from 'node:child_process'
import { DISPLAY_SCRIPT, DISPLAY_TIMEOUT_MS } from './config.js'

/** Spawn display.py to push a PNG, killing it if it hangs past the timeout. */
export function pushFrame(pngPath: string, full: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [DISPLAY_SCRIPT, pngPath, ...(full ? ['--full'] : [])]
    const proc = spawn('python3', args, { stdio: ['ignore', 'inherit', 'inherit'] })

    const timer = setTimeout(() => {
      proc.kill('SIGKILL')
      reject(new Error('display.py timed out'))
    }, DISPLAY_TIMEOUT_MS)

    proc.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    proc.on('exit', (code) => {
      clearTimeout(timer)
      code === 0 ? resolve() : reject(new Error(`display.py exited ${code}`))
    })
  })
}
```

- [ ] **Step 2: Create `src/main.ts`**

```ts
import { createFrame, writeFramePng } from './render/canvas.js'
import { renderScreen } from './render/screen.js'
import { pushFrame } from './display.js'
import { nextRefresh } from './refresh.js'
import { FRAME_PATH, RENDER_INTERVAL_MS } from './config.js'

async function renderAndPush(counter: number): Promise<number> {
  const { canvas, ctx } = createFrame()
  renderScreen(ctx, new Date())
  writeFramePng(canvas, FRAME_PATH)

  const decision = nextRefresh(counter)
  try {
    await pushFrame(FRAME_PATH, decision.full)
    console.log(`[render] pushed frame (full=${decision.full})`)
  } catch (err) {
    console.error(`[render] push failed: ${(err as Error).message}`)
  }
  return decision.counter
}

async function main(): Promise<void> {
  const once = process.argv.includes('--once')
  // First frame always forces a full refresh (clears the panel), like main.py startup.
  let counter = await renderAndPush(600)
  if (once) return

  setInterval(() => {
    void renderAndPush(counter).then((c) => {
      counter = c
    })
  }, RENDER_INTERVAL_MS)
}

void main()
```

- [ ] **Step 3: Build to verify the TypeScript compiles**

Run: `npm run build`
Expected: `dist/main.js` produced, no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/display.ts src/main.ts
git commit -m "feat: render loop with timed display subprocess push"
```

---

## Task 6: Hardware validation gate (human-run on the Pi)

This task decides whether the spawn-per-frame model survives contact with the panel.

- [ ] **Step 1: Deploy and run one frame on the Pi**

On the Pi (SPI enabled, `python3-pil` installed, Node LTS installed):
```bash
npm install && npm run build
npm run render:once
```
Expected: the panel clears and shows the title + clock. Confirm the frame is upright and fills the screen (1360×480 orientation correct).

- [ ] **Step 2: Run the continuous loop for ~10 minutes and observe**

Run: `npm start`
Observe and record:
- Does each minute's partial refresh update **without a full-screen flash**? (Re-running `init_Part()` per spawn is the risk.)
- Peak memory of the Node process (`ps -o rss= -p $(pgrep -f dist/main.js)` — expect well under 256 MB).

- [ ] **Step 3: Decision gate**

- **If partial refresh is flash-free and memory is fine:** spawn-per-frame is validated. Phase 1 is DONE — proceed to write the Phase 2 plan (Clock + Weather/AQI widgets).
- **If `init_Part()` per spawn causes a flash every minute:** pivot `display.py` to a long-lived server (keeps `epd` initialized, reads frame paths from stdin, only re-inits on full refresh). Capture this as a Phase 1.5 plan before Phase 2. Do NOT proceed to widgets until the refresh behavior matches the original's flicker-free partial updates.

- [ ] **Step 4: Record the outcome**

Append the observed behavior (flash? memory?) and the decision to the spec's "Risks & prerequisites" section, then commit:
```bash
git add docs/superpowers/specs/2026-06-18-typescript-migration-design.md
git commit -m "docs: record Phase 1 hardware validation outcome"
```

---

## Phase 1 done when

- `npm test` passes (refresh logic).
- `npm run build` is clean.
- The Pi renders a real frame through the full TS→PNG→`display.py`→panel pipeline.
- The spawn-per-frame vs. long-lived-server decision (Task 6) is made and recorded.
