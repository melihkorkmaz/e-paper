import type { SKRSContext2D } from "@napi-rs/canvas";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad2 = (n: number): string => String(n).padStart(2, "0");

/**
 * Renders the time + date block, horizontally centred within `width` from x.
 * Real data: reads `now` directly. Format matches the reference
 * ("19:22" / "Saturday, 28 February").
 */
export function renderClock(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  now: Date,
): void {
  ctx.fillStyle = "#000000";

  // Position the LED time by its measured ascent so the digits aren't clipped
  // at the top (this font overshoots the "top" baseline).
  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  ctx.font = "150px ClockLED";
  ctx.textBaseline = "alphabetic";
  const tm = ctx.measureText(time);
  ctx.fillText(time, x + (width - tm.width) / 2, y + tm.actualBoundingBoxAscent);

  ctx.textBaseline = "top";
  const date = `${WEEKDAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`;
  ctx.font = "32px Aldrich";
  const dw = ctx.measureText(date).width;
  ctx.fillText(date, x + (width - dw) / 2, y + 165);
}
