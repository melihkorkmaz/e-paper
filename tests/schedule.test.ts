import { describe, it, expect } from "vitest";
import { DEFAULTS, type Settings } from "../src/settings.js";
import { getMode, nextDelayMs, nextOccurrence } from "../src/schedule.js";

// 2026-06-19 is a Friday; 2026-06-20 Saturday; 2026-06-21 Sunday.
function at(iso: string): Date {
  return new Date(iso);
}

function settings(overrides: Partial<Settings> = {}): Settings {
  return { ...DEFAULTS, ...overrides, override: { ...DEFAULTS.override, ...overrides.override } };
}

describe("getMode — weekday", () => {
  const s = settings();
  it("is night before dayStart", () => {
    expect(getMode(at("2026-06-19T07:00:00"), s)).toBe("night");
  });
  it("is day at dayStart (inclusive)", () => {
    expect(getMode(at("2026-06-19T07:30:00"), s)).toBe("day");
  });
  it("is day mid-morning", () => {
    expect(getMode(at("2026-06-19T08:00:00"), s)).toBe("day");
  });
  it("is evening at dayEnd (exclusive)", () => {
    expect(getMode(at("2026-06-19T17:00:00"), s)).toBe("evening");
  });
  it("is evening before nightStart", () => {
    expect(getMode(at("2026-06-19T21:59:00"), s)).toBe("evening");
  });
  it("is night at nightStart", () => {
    expect(getMode(at("2026-06-19T22:00:00"), s)).toBe("night");
  });
});

describe("getMode — weekend (relaxed all day)", () => {
  const s = settings();
  it("is evening, not day, during Saturday work hours", () => {
    expect(getMode(at("2026-06-20T08:00:00"), s)).toBe("evening");
    expect(getMode(at("2026-06-20T14:00:00"), s)).toBe("evening");
  });
  it("is night before morning and after nightStart on Sunday", () => {
    expect(getMode(at("2026-06-21T07:00:00"), s)).toBe("night");
    expect(getMode(at("2026-06-21T22:30:00"), s)).toBe("night");
  });
});

describe("getMode — manual override", () => {
  it("forces night when sleepUntil is in the future", () => {
    const s = settings({ override: { sleepUntil: "2026-06-19T23:00:00" } });
    expect(getMode(at("2026-06-19T08:00:00"), s)).toBe("night");
  });
  it("ignores an expired sleepUntil", () => {
    const s = settings({ override: { sleepUntil: "2026-06-19T07:00:00" } });
    expect(getMode(at("2026-06-19T08:00:00"), s)).toBe("day");
  });
});

describe("nextOccurrence", () => {
  it("returns today's time when still ahead", () => {
    const d = nextOccurrence("17:00", at("2026-06-19T08:00:00"));
    expect(d.toISOString()).toBe(at("2026-06-19T17:00:00").toISOString());
  });
  it("rolls to tomorrow when the time has passed", () => {
    const d = nextOccurrence("07:30", at("2026-06-19T08:00:00"));
    expect(d.toISOString()).toBe(at("2026-06-20T07:30:00").toISOString());
  });
});

describe("nextDelayMs", () => {
  const s = settings();
  it("day mode aligns to the next minute boundary", () => {
    expect(nextDelayMs(at("2026-06-19T08:00:30.000"), s, "day")).toBe(30_000);
  });
  it("evening mode uses the cadence when no boundary is sooner", () => {
    expect(nextDelayMs(at("2026-06-20T14:00:00"), s, "evening")).toBe(5 * 60_000);
  });
  it("night mode re-checks at most every 5 minutes", () => {
    expect(nextDelayMs(at("2026-06-19T23:00:00"), s, "night")).toBe(5 * 60_000);
  });
});
