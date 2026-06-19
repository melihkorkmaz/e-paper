import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, "..");

// Load secrets from .env (gitignored) when present; fall back to real env vars.
try {
  process.loadEnvFile(join(ROOT, ".env"));
} catch {
  // No .env file — rely on the process environment (e.g. on the Pi).
}

// Waveshare 10.85" native resolution (from lib/waveshare_epd/epd10in85.py)
export const PANEL_WIDTH = 1360;
export const PANEL_HEIGHT = 480;

export const FRAME_PATH = "./epaper-frame.png";
export const FONT_DIR = join(ROOT, "assets", "fonts");
export const DISPLAY_SCRIPT = join(ROOT, "python", "display.py");
export const RENDER_INTERVAL_MS = 60_000;
export const DISPLAY_TIMEOUT_MS = 25_000;

// Change to your GEO location (defaults from main.py).
export const LOCATION_LAT = 51.68819911038824;
export const LOCATION_LON = 5.196984958269829;

// Weather is refreshed on its own slow cadence (main.py: 600s).
export const WEATHER_REFRESH_MS = 600_000;

// Internet quality is sampled by pinging this host (main.py: every 20s).
export const PING_HOST = "8.8.8.8";
export const PING_REFRESH_MS = 20_000;
export const PING_HISTORY_MAX = 50;

// Spotify now-playing via Last.fm. Set these in .env (see .env.example).
export const LASTFM = {
  apiKey: process.env.LASTFM_API_KEY ?? "",
  username: process.env.LASTFM_USERNAME ?? "",
};
export const SPOTIFY_REFRESH_MS = 20_000;

// Claude usage is fetched by shelling out to claude.py (main.py: every 600s).
export const PYTHON_BIN = process.env.PYTHON_BIN ?? "python3";
export const CLAUDE_SCRIPT = join(ROOT, "claude.py");
export const CLAUDE_USAGE_FILE = join(ROOT, "usage.json");
export const CLAUDE_REFRESH_MS = 600_000;
