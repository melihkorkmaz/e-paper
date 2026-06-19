import type { SKRSContext2D } from "@napi-rs/canvas";
import { getIcon } from "../icons.js";

/** Bambu printer snapshot. Mirrors main.py's data_store.printer shape. */
export interface PrinterData {
  status: string;
  percentage: number;
  /** Remaining minutes. */
  remaining: number;
  /** Layer progress, e.g. "113/201". */
  layers: string;
}

/** Placeholder mock until the printer API is wired up. */
export const MOCK_PRINTER: PrinterData = {
  status: "RUNNING",
  percentage: 71,
  remaining: 13,
  layers: "113/201",
};

const ICON_SIZE = 60;
const TEXT_X = 70;
/** Statuses with no active job: hide the progress bar (main.py parity). */
const IDLE_STATES = new Set(["OFFLINE", "UNKNOWN", "FINISH"]);

/**
 * Renders the Bambu printer widget at column origin (x, y).
 * `width` is the drawable width from x (right edge = x + width).
 * Ported from main.py's ENABLE_BAMBU block (icon / status / bar / detail).
 */
export function renderPrinter(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  data: PrinterData,
): void {
  ctx.textBaseline = "top";
  ctx.fillStyle = "#000000";

  const icon = getIcon("icon_3d");
  if (icon) {
    ctx.drawImage(icon, x, y, ICON_SIZE, ICON_SIZE);
  }

  const status = data.status.toUpperCase();
  ctx.font = "28px Aldrich";
  ctx.fillText(`PRINTER: ${status}`, x + TEXT_X, y + 4);

  if (IDLE_STATES.has(status)) return;

  // Progress bar spanning from the text column to the divider.
  const barX = x + TEXT_X;
  const barY = y + 44;
  const barW = width - TEXT_X;
  const barH = 20;
  const pct = Math.max(0, Math.min(data.percentage, 100)) / 100;
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barW, barH);
  if (pct > 0) {
    ctx.fillRect(barX, barY, Math.round(barW * pct), barH);
  }

  ctx.font = "20px Aldrich";
  ctx.fillText(
    `${data.percentage}% | Rem: ${data.remaining}m | ${data.layers} L`,
    barX,
    barY + barH + 10,
  );
}
