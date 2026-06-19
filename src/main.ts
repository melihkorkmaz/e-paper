import { createFrame, writeFramePng } from "./render/canvas.js";
import { renderScreen } from "./render/screen.js";
import { renderGoodnight } from "./render/goodnight.js";
import { pushFrame } from "./display.js";
import { nextRefresh } from "./refresh.js";
import { FRAME_PATH } from "./config.js";
import { preloadIcons } from "./render/icons.js";
import { getSettings, updateSettings } from "./settings.js";
import { getMode, nextDelayMs, nextOccurrence, type Mode } from "./schedule.js";
import { startServer } from "./server.js";
import { refreshWeather } from "./data/weather.js";
import { refreshInternet } from "./data/internet.js";
import { refreshSpotify } from "./data/spotify.js";
import { refreshClaude } from "./data/claude.js";
import { refreshPrinter } from "./data/printer.js";

let counter = 600; // 600 forces a full refresh on the first frame
let lastMode: Mode | null = null;

/** Renders the normal dashboard. `forceFull` clears the panel (startup / waking). */
async function renderDashboard(forceFull: boolean): Promise<void> {
  const decision = nextRefresh(counter);
  const full = forceFull || decision.full;
  counter = full ? 0 : decision.counter;
  try {
    const { canvas, ctx } = createFrame();
    renderScreen(ctx, new Date());
    writeFramePng(canvas, FRAME_PATH);
    await pushFrame(FRAME_PATH, full);
    console.log(`[render] dashboard (full=${full})`);
  } catch (err) {
    console.error(`[render] dashboard failed: ${(err as Error).message}`);
  }
}

/** Renders the full-screen "Sleeping until …" night card once (full refresh). */
async function renderNight(): Promise<void> {
  try {
    const now = new Date();
    const s = getSettings();
    const wake = s.override.sleepUntil
      ? new Date(s.override.sleepUntil)
      : nextOccurrence(s.schedule.dayStart, now);
    const { canvas, ctx } = createFrame();
    renderGoodnight(ctx, wake);
    writeFramePng(canvas, FRAME_PATH);
    await pushFrame(FRAME_PATH, true);
    counter = 0;
    console.log("[render] goodnight");
  } catch (err) {
    console.error(`[render] goodnight failed: ${(err as Error).message}`);
  }
}

/** Self-scheduling render loop driven by the time-of-day schedule. */
async function tick(): Promise<void> {
  const now = new Date();
  let s = getSettings();

  // Clear an expired manual override so it doesn't linger past morning.
  if (s.override.sleepUntil && now.getTime() >= new Date(s.override.sleepUntil).getTime()) {
    updateSettings({ override: { sleepUntil: null } });
    s = getSettings();
  }

  const mode = getMode(now, s);
  if (mode === "night") {
    if (lastMode !== "night") await renderNight(); // render once on entering night
    // else: panel stays frozen
  } else {
    await renderDashboard(lastMode === "night"); // full refresh when waking
  }
  lastMode = mode;

  setTimeout(() => void tick(), nextDelayMs(new Date(), getSettings(), mode));
}

/** Self-rescheduling poller that reads its interval from settings each tick and pauses at night. */
function poll(fn: () => Promise<unknown>, intervalMs: () => number): void {
  const run = async (): Promise<void> => {
    if (getMode(new Date(), getSettings()) !== "night") {
      try {
        await fn();
      } catch {
        // data layers degrade gracefully on their own
      }
    }
    setTimeout(() => void run(), intervalMs());
  };
  setTimeout(() => void run(), intervalMs());
}

async function main(): Promise<void> {
  const once = process.argv.includes("--once");

  await preloadIcons([
    "icon_spotify",
    "icon_3d",
    "icon_wifi",
    "icon_sun",
    "icon_moon",
    "icon_partly-cloudy-day",
    "icon_clouds",
    "icon_wind",
    "icon_rain",
    "icon_snow",
    "icon_storm",
  ]);

  // Fetch live data before the first frame so it shows immediately.
  await Promise.all([refreshWeather(new Date()), refreshInternet(), refreshSpotify()]);
  void refreshClaude();
  void refreshPrinter();

  if (once) {
    const mode = getMode(new Date(), getSettings());
    if (mode === "night") await renderNight();
    else await renderDashboard(true);
    return;
  }

  startServer();
  void tick();

  // Self-rescheduling data pollers; intervals are read live from settings.
  poll(() => refreshWeather(new Date()), () => getSettings().intervals.weatherMs);
  poll(() => refreshInternet(), () => getSettings().intervals.pingMs);
  poll(() => refreshSpotify(), () => getSettings().intervals.spotifyMs);
  poll(() => refreshClaude(), () => getSettings().intervals.claudeMs);
  poll(() => refreshPrinter(), () => getSettings().intervals.printerMs);
}

// Kiosk resilience: log unexpected errors instead of exiting (which, under a
// restart supervisor, would crash-loop and full-refresh the panel each time).
process.on("unhandledRejection", (e) => {
  console.error(`[fatal] unhandled rejection: ${String(e)}`);
});
process.on("uncaughtException", (e) => {
  console.error(`[fatal] uncaught exception: ${e instanceof Error ? e.stack : String(e)}`);
});

void main();
