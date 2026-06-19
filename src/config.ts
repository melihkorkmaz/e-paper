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
