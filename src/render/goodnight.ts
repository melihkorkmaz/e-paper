import type { SKRSContext2D } from "@napi-rs/canvas";
import { PANEL_WIDTH, PANEL_HEIGHT } from "../config.js";

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Formats a wake time as "DD.MM.YYYY HH:MM". */
function formatWake(d: Date): string {
  return (
    `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  );
}

/** Renders the full-screen night card: "Sleeping until <wake time>", centred. */
export function renderGoodnight(ctx: SKRSContext2D, wake: Date): void {
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = "44px Aldrich";
  ctx.fillText("Sleeping until", PANEL_WIDTH / 2, PANEL_HEIGHT / 2 - 45);

  ctx.font = "66px Aldrich";
  ctx.fillText(formatWake(wake), PANEL_WIDTH / 2, PANEL_HEIGHT / 2 + 35);

  // Reset shared context state for subsequent (non-night) renders.
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
}
