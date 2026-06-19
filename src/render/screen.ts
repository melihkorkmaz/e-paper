import type { SKRSContext2D } from "@napi-rs/canvas";
import { PANEL_WIDTH, PANEL_HEIGHT } from "../config.js";
import { renderSpotify, MOCK_SPOTIFY } from "./widgets/spotify.js";
import { renderPrinter, MOCK_PRINTER } from "./widgets/printer.js";

/** Width of a single column. main.py: `col_w = epd.width // 3`. */
const COL_W = Math.floor(PANEL_WIDTH / 3);
/** Left padding inside each column (main.py uses 20, col 3 uses 30). */
const COL_DEFAULT_PAD = 10;
const COL_TOP_PAD = 10;

/** Drawable width inside a column (between left pad and the divider). */
const COL_CONTENT_W = COL_W - COL_DEFAULT_PAD * 2;

/** Column-1 row layout (main.py: rows at y=20/170/340, dividers at 150/320). */
const ROW2_Y = 170;
const ROW_DIVIDER_1 = 150;

/** Draws a straight black line. Canvas equivalent of PIL's `draw.line`. */
function line(
  ctx: SKRSContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#000000";
  ctx.stroke();
}

/** Renders a single column's placeholder content at its left edge `x`. */
function renderColumn(
  ctx: SKRSContext2D,
  x: number,
  title: string,
  body: string,
): void {
  ctx.fillStyle = "#000000";
  const headerFontSize = 28;
  ctx.font = `${headerFontSize}px Aldrich`;

  let currentTop = COL_TOP_PAD + headerFontSize * 0.5;
  ctx.fillText(title, x, COL_TOP_PAD + currentTop);

  const contentFontSize = 20;
  ctx.font = `${contentFontSize}px Aldrich`;

  currentTop += contentFontSize + COL_DEFAULT_PAD;
  ctx.fillText(body, x, currentTop);
}

/** Phase-2 frame: three columns separated by vertical dividers, each with sample text. */
export function renderScreen(ctx: SKRSContext2D, now: Date): void {
  // Vertical dividers between the three columns (main.py: y 10..470).
  line(ctx, COL_W, 0, COL_W, PANEL_HEIGHT);
  line(ctx, COL_W * 2, 0, COL_W * 2, PANEL_HEIGHT);

  // Column 1, row 1: Spotify now-playing (top-left)
  renderSpotify(ctx, COL_DEFAULT_PAD, COL_TOP_PAD, COL_CONTENT_W, MOCK_SPOTIFY);

  // Column 1, row 2: Bambu printer status
  line(ctx, COL_DEFAULT_PAD, ROW_DIVIDER_1, COL_W - COL_DEFAULT_PAD, ROW_DIVIDER_1);
  renderPrinter(ctx, COL_DEFAULT_PAD, ROW2_Y, COL_CONTENT_W, MOCK_PRINTER);

  // Column 2
  renderColumn(
    ctx,
    COL_W + COL_DEFAULT_PAD,
    "COLUMN 2",
    "Middle column content",
  );

  // Column 3 (holds the clock in main.py)
  const col3x = COL_W * 2 + COL_DEFAULT_PAD;
  renderColumn(ctx, col3x, "COLUMN 3", "Right column content");

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  ctx.font = "120px ClockLED";
  ctx.fillText(`${hh}:${mm}`, col3x, 220);
}
