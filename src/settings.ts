import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  ROOT,
  LOCATION_LAT,
  LOCATION_LON,
  WEATHER_REFRESH_MS,
  PING_REFRESH_MS,
  SPOTIFY_REFRESH_MS,
  CLAUDE_REFRESH_MS,
  PRINTER_REFRESH_MS,
} from "./config.js";

export interface Schedule {
  dayStart: string; // "HH:MM"
  dayEnd: string;
  nightStart: string;
  weekdayPrecise: boolean;
  eveningCadenceMin: number;
}

export interface Settings {
  schedule: Schedule;
  location: { lat: number; lon: number };
  intervals: {
    weatherMs: number;
    pingMs: number;
    spotifyMs: number;
    claudeMs: number;
    printerMs: number;
  };
  /** Runtime override state (set by the Sleep button, not user-typed). */
  override: { sleepUntil: string | null };
}

const CONFIG_FILE = join(ROOT, "config.json");

/** Defaults seeded from the compile-time config.ts constants. */
export const DEFAULTS: Settings = {
  schedule: {
    dayStart: "07:30",
    dayEnd: "17:00",
    nightStart: "22:00",
    weekdayPrecise: true,
    eveningCadenceMin: 5,
  },
  location: { lat: LOCATION_LAT, lon: LOCATION_LON },
  intervals: {
    weatherMs: WEATHER_REFRESH_MS,
    pingMs: PING_REFRESH_MS,
    spotifyMs: SPOTIFY_REFRESH_MS,
    claudeMs: CLAUDE_REFRESH_MS,
    printerMs: PRINTER_REFRESH_MS,
  },
  override: { sleepUntil: null },
};

/** Deep-merges a raw object over the defaults (one level per section). */
function withDefaults(raw: Record<string, unknown>): Settings {
  const r = raw as Partial<Settings>;
  return {
    schedule: { ...DEFAULTS.schedule, ...(r.schedule ?? {}) },
    location: { ...DEFAULTS.location, ...(r.location ?? {}) },
    intervals: { ...DEFAULTS.intervals, ...(r.intervals ?? {}) },
    override: { ...DEFAULTS.override, ...(r.override ?? {}) },
  };
}

function load(): Settings {
  if (existsSync(CONFIG_FILE)) {
    try {
      return withDefaults(JSON.parse(readFileSync(CONFIG_FILE, "utf8")));
    } catch {
      // Corrupt file — fall back to defaults below.
    }
  }
  const defaults = withDefaults({});
  try {
    writeFileSync(CONFIG_FILE, JSON.stringify(defaults, null, 2));
  } catch {
    // Read-only FS is fine; we keep defaults in memory.
  }
  return defaults;
}

let current: Settings = load();

/** Synchronous read of the current settings (used everywhere by the loop). */
export function getSettings(): Settings {
  return current;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function validate(s: Settings): string[] {
  const e: string[] = [];
  const times: [string, string][] = [
    ["dayStart", s.schedule.dayStart],
    ["dayEnd", s.schedule.dayEnd],
    ["nightStart", s.schedule.nightStart],
  ];
  for (const [k, v] of times) if (!HHMM.test(v)) e.push(`${k} must be HH:MM`);
  if (!(s.schedule.eveningCadenceMin >= 1 && s.schedule.eveningCadenceMin <= 120))
    e.push("eveningCadenceMin must be 1-120");
  if (!(s.location.lat >= -90 && s.location.lat <= 90)) e.push("lat must be -90..90");
  if (!(s.location.lon >= -180 && s.location.lon <= 180)) e.push("lon must be -180..180");
  for (const [k, v] of Object.entries(s.intervals))
    if (!(typeof v === "number" && v >= 1000)) e.push(`${k} must be a number >= 1000`);
  return e;
}

/** Validates and persists a partial settings patch. Returns errors without saving on failure. */
export function updateSettings(patch: Record<string, unknown>): ValidationResult {
  const p = patch as Partial<Settings>;
  const next: Settings = {
    schedule: { ...current.schedule, ...(p.schedule ?? {}) },
    location: { ...current.location, ...(p.location ?? {}) },
    intervals: { ...current.intervals, ...(p.intervals ?? {}) },
    override: { ...current.override, ...(p.override ?? {}) },
  };
  const errors = validate(next);
  if (errors.length) return { ok: false, errors };
  current = next;
  try {
    writeFileSync(CONFIG_FILE, JSON.stringify(current, null, 2));
  } catch {
    return { ok: false, errors: ["failed to write config.json"] };
  }
  return { ok: true, errors: [] };
}
