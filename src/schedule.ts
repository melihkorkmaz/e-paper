import type { Settings } from "./settings.js";

export type Mode = "day" | "evening" | "night";

const MINUTE = 60_000;
const NIGHT_RECHECK_MS = 5 * MINUTE;

/** Minutes since midnight for a "HH:MM" string. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** The next Date matching wall-clock `hhmm` at or after `now` (today, else tomorrow). */
export function nextOccurrence(hhmm: string, now: Date): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

/** Resolves the current display mode from the schedule + manual override. */
export function getMode(now: Date, s: Settings): Mode {
  const sleepUntil = s.override.sleepUntil;
  if (sleepUntil && now.getTime() < new Date(sleepUntil).getTime()) return "night";

  const mins = now.getHours() * 60 + now.getMinutes();
  const dayStart = toMinutes(s.schedule.dayStart);
  const dayEnd = toMinutes(s.schedule.dayEnd);
  const nightStart = toMinutes(s.schedule.nightStart);

  if (mins < dayStart || mins >= nightStart) return "night";

  const weekday = now.getDay() >= 1 && now.getDay() <= 5;
  if (weekday && s.schedule.weekdayPrecise && mins >= dayStart && mins < dayEnd) {
    return "day";
  }
  return "evening";
}

/** Smallest ms until any schedule boundary (dayStart/dayEnd/nightStart) after now. */
function msUntilNextBoundary(now: Date, s: Settings): number {
  return Math.min(
    ...[s.schedule.dayStart, s.schedule.dayEnd, s.schedule.nightStart].map(
      (t) => nextOccurrence(t, now).getTime() - now.getTime(),
    ),
  );
}

/** Delay until the next render tick for the given mode. */
export function nextDelayMs(now: Date, s: Settings, mode: Mode): number {
  if (mode === "day") {
    // Align to the next minute boundary so the clock is always accurate.
    return MINUTE - (now.getSeconds() * 1000 + now.getMilliseconds());
  }
  if (mode === "evening") {
    const cadence = s.schedule.eveningCadenceMin * MINUTE;
    return Math.min(cadence, msUntilNextBoundary(now, s));
  }
  // Night: only wake to re-check mode; never past the morning boundary.
  const msUntilMorning = nextOccurrence(s.schedule.dayStart, now).getTime() - now.getTime();
  return Math.min(NIGHT_RECHECK_MS, msUntilMorning);
}
