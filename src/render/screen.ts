import type { SKRSContext2D } from "@napi-rs/canvas";
import { PANEL_WIDTH, PANEL_HEIGHT } from "../config.js";
import { line } from "./draw.js";
import { renderSpotify, MOCK_SPOTIFY } from "./widgets/spotify.js";
import { renderPrinter, MOCK_PRINTER } from "./widgets/printer.js";
import { renderInternet, MOCK_INTERNET } from "./widgets/internet.js";
import { renderWeather, MOCK_WEATHER } from "./widgets/weather.js";
import { renderClock } from "./widgets/clock.js";
import { renderClaude, MOCK_CLAUDE } from "./widgets/claude.js";

/** Width of a single column. main.py: `col_w = epd.width // 3`. */
const COL_W = Math.floor(PANEL_WIDTH / 3);
/** Left padding inside each column (main.py uses 20, col 3 uses 30). */
const COL_DEFAULT_PAD = 10;
const COL_TOP_PAD = 10;

/** Drawable width inside a column (between left pad and the divider). */
const COL_CONTENT_W = COL_W - COL_DEFAULT_PAD * 2;

/** Column-1 row layout (main.py: rows at y=20/170/340, dividers at 150/320). */
const ROW2_Y = 170;
const ROW3_Y = 340;
const ROW_DIVIDER_1 = 150;
const ROW_DIVIDER_2 = 320;

/** Column 3 is split into two equal rows: date-time (top) and Claude (bottom). */
const COL3_MID = PANEL_HEIGHT / 2;
/** Each widget's content height, used to centre it within its half. */
const CLOCK_BLOCK_H = 197;
const CLAUDE_BLOCK_H = 130;
const COL3_CLOCK_Y = (COL3_MID - CLOCK_BLOCK_H) / 2;
const COL3_CLAUDE_Y = COL3_MID + (COL3_MID - CLAUDE_BLOCK_H) / 2;

/** Renders the full dashboard frame: three columns of widgets. */
export function renderScreen(ctx: SKRSContext2D, now: Date): void {
  // Vertical dividers between the three columns (main.py: y 10..470).
  line(ctx, COL_W, 0, COL_W, PANEL_HEIGHT);
  line(ctx, COL_W * 2, 0, COL_W * 2, PANEL_HEIGHT);

  // Column 1, row 1: Spotify now-playing (top-left)
  renderSpotify(ctx, COL_DEFAULT_PAD, COL_TOP_PAD, COL_CONTENT_W, MOCK_SPOTIFY);

  // Column 1, row 2: Bambu printer status
  line(ctx, COL_DEFAULT_PAD, ROW_DIVIDER_1, COL_W - COL_DEFAULT_PAD, ROW_DIVIDER_1);
  renderPrinter(ctx, COL_DEFAULT_PAD, ROW2_Y, COL_CONTENT_W, MOCK_PRINTER);

  // Column 1, row 3: Internet quality
  line(ctx, COL_DEFAULT_PAD, ROW_DIVIDER_2, COL_W - COL_DEFAULT_PAD, ROW_DIVIDER_2);
  renderInternet(ctx, COL_DEFAULT_PAD, ROW3_Y, COL_CONTENT_W, MOCK_INTERNET);

  // Column 2: Weather (full column)
  renderWeather(ctx, COL_W + COL_DEFAULT_PAD, COL_CONTENT_W, MOCK_WEATHER);

  // Column 3, row 1 (top half): time + date
  const col3x = COL_W * 2 + COL_DEFAULT_PAD;
  renderClock(ctx, col3x, COL3_CLOCK_Y, COL_CONTENT_W, now);
  line(ctx, col3x, COL3_MID, PANEL_WIDTH - COL_DEFAULT_PAD, COL3_MID);

  // Column 3, row 2 (bottom half): Claude usage
  renderClaude(ctx, col3x, COL3_CLAUDE_Y, COL_CONTENT_W, MOCK_CLAUDE);
}
