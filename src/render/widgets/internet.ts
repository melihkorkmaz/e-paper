import type { SKRSContext2D } from "@napi-rs/canvas";
import { getIcon } from "../icons.js";
import { drawSparkline } from "../draw.js";

/** Internet quality snapshot. Mirrors main.py's data_store.ping shape. */
export interface InternetData {
  /** Current latency in ms. */
  current: number;
  /** Recent latency samples (oldest first). */
  history: number[];
}

/** Placeholder mock until ping sampling is wired up. */
export const MOCK_INTERNET: InternetData = {
  current: 14,
  history: [
    42, 18, 11, 9, 10, 12, 9, 8, 11, 30, 14, 10, 9, 8, 10, 9, 11, 8, 9, 10,
    9, 8, 22, 11, 9, 10, 8, 9, 11, 9, 8, 10, 9, 8, 9, 16, 10, 9, 8, 9,
    10, 9, 8, 11, 9, 8, 10, 9, 12, 14,
  ],
};

const ICON_SIZE = 50;
const TEXT_X = 60;

/**
 * Renders the internet-quality widget at column origin (x, y).
 * `width` is the drawable width from x (sparkline spans it).
 * Ported from main.py's ping fallback block (icon / label / sparkline).
 */
export function renderInternet(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  data: InternetData,
): void {
  ctx.textBaseline = "top";
  ctx.fillStyle = "#000000";

  const icon = getIcon("icon_wifi");
  if (icon) {
    ctx.drawImage(icon, x, y, ICON_SIZE, ICON_SIZE);
  }

  ctx.font = "28px Aldrich";
  ctx.fillText(`Internet Quality: ${data.current} ms`, x + TEXT_X, y + 12);

  drawSparkline(ctx, x, y + 60, data.history, {
    maxItems: 50,
    width,
    height: 40,
  });
}
