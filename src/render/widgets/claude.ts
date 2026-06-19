import type { SKRSContext2D } from "@napi-rs/canvas";

/** One usage limit window. Mirrors main.py's claude five_hour / seven_day. */
export interface ClaudeLimit {
  utilization: number;
  /** ISO-8601 reset timestamp. */
  resetsAt: string;
}

/** Claude usage snapshot. Mirrors main.py's data_store.claude shape. */
export interface ClaudeData {
  error: boolean;
  fiveHour: ClaudeLimit;
  sevenDay: ClaudeLimit;
}

/** Placeholder mock until the claude.py usage fetch is wired up. */
export const MOCK_CLAUDE: ClaudeData = {
  error: false,
  fiveHour: {
    utilization: 7.0,
    resetsAt: new Date(Date.now() + 3 * 3600_000).toISOString(),
  },
  sevenDay: {
    utilization: 54.0,
    resetsAt: new Date(Date.now() + (3 * 24 + 22) * 3600_000).toISOString(),
  },
};

/** Formats time remaining until an ISO timestamp. Ported from main.py time_until. */
export function timeUntil(iso: string): string {
  const diffSec = (new Date(iso).getTime() - Date.now()) / 1000;
  if (diffSec < 0) return "Resetting...";
  const totalHours = Math.floor(diffSec / 3600);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours - days * 24;
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((diffSec - totalHours * 3600) / 60);
  return `${hours}h ${minutes}m`;
}

const BAR_H = 15;

/** Draws one limit row: "label: pct% (Resets in …)" plus a progress bar. */
function drawLimit(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  label: string,
  limit: ClaudeLimit,
): void {
  const pct = limit.utilization;
  ctx.font = "20px Aldrich";
  ctx.fillStyle = "#000000";
  ctx.fillText(
    `${label}: ${pct.toFixed(1)}% (Resets in ${timeUntil(limit.resetsAt)})`,
    x,
    y,
  );

  const barY = y + 25;
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#000000";
  ctx.strokeRect(x, barY, width, BAR_H);
  const fillW = Math.round((width - 4) * Math.min(pct / 100, 1));
  if (fillW > 0) ctx.fillRect(x + 2, barY + 2, fillW, BAR_H - 4);
}

/**
 * Renders the Claude usage widget at column origin (x, y).
 * `width` is the drawable width from x (bars span it).
 * Ported from main.py's ENABLE_CLAUDE block (title / 5h / 7d).
 */
export function renderClaude(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  data: ClaudeData,
): void {
  ctx.textBaseline = "top";
  ctx.fillStyle = "#000000";

  ctx.font = "28px Aldrich";
  ctx.fillText("CLAUDE AI USAGE", x, y);

  if (data.error) {
    ctx.font = "24px Aldrich";
    ctx.fillText("Claude Usage Error", x, y + 50);
    return;
  }

  drawLimit(ctx, x, y + 40, width, "5-Hour Limit", data.fiveHour);
  drawLimit(ctx, x, y + 90, width, "7-Day Limit", data.sevenDay);
}
