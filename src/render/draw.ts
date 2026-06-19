import type { SKRSContext2D } from "@napi-rs/canvas";

/** Draws a straight black line. Canvas equivalent of PIL's `draw.line`. */
export function line(
  ctx: SKRSContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width = 2,
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = width;
  ctx.strokeStyle = "#000000";
  ctx.stroke();
}

interface SparklineOpts {
  maxItems?: number;
  width: number;
  height: number;
}

/**
 * Draws a bar sparkline, ported from main.py's draw_sparkline (style="bar").
 * Values are scaled to the series max; bars are laid out left-to-right.
 */
export function drawSparkline(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  data: number[],
  { maxItems = 50, width, height }: SparklineOpts,
): void {
  if (data.length === 0) return;
  let maxVal = Math.max(...data);
  if (maxVal <= 0) maxVal = 1;

  const step = width / Math.max(maxItems - 1, 1);
  const barW = Math.max(Math.floor(step) - 1, 1);

  ctx.fillStyle = "#000000";
  for (let i = 0; i < data.length; i++) {
    const bh = Math.round((data[i] / maxVal) * height);
    const bx = x + i * step;
    ctx.fillRect(bx, y + height - bh, barW, bh);
  }
}
