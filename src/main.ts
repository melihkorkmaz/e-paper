import { createFrame, writeFramePng } from "./render/canvas.js";
import { renderScreen } from "./render/screen.js";
// import { pushFrame } from "./display.js";
import { nextRefresh } from "./refresh.js";
import {
  FRAME_PATH,
  RENDER_INTERVAL_MS,
  WEATHER_REFRESH_MS,
  PING_REFRESH_MS,
  SPOTIFY_REFRESH_MS,
} from "./config.js";
import { preloadIcons } from "./render/icons.js";
import { refreshWeather } from "./data/weather.js";
import { refreshInternet } from "./data/internet.js";
import { refreshSpotify } from "./data/spotify.js";

async function renderAndPush(counter: number): Promise<number> {
  const decision = nextRefresh(counter);
  try {
    const { canvas, ctx } = createFrame();
    renderScreen(ctx, new Date());
    writeFramePng(canvas, FRAME_PATH);
    // skip this while testing, since it requires a running display server and the display service to be running
    // await pushFrame(FRAME_PATH, decision.full)
    console.log(`[render] pushed frame (full=${decision.full})`);
  } catch (err) {
    console.error(`[render] frame failed: ${(err as Error).message}`);
  }
  return decision.counter;
}

async function main(): Promise<void> {
  const once = process.argv.includes("--once");
  // Preload assets once; the render loop stays synchronous.
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
  await Promise.all([
    refreshWeather(new Date()),
    refreshInternet(),
    refreshSpotify(),
  ]);

  // First frame always forces a full refresh (clears the panel), like main.py startup.
  let counter = await renderAndPush(600);
  if (once) return;

  setInterval(() => {
    void renderAndPush(counter).then((c) => {
      counter = c;
    });
  }, RENDER_INTERVAL_MS);

  // Refresh weather on its own slow cadence; failures keep the last good value.
  setInterval(() => {
    void refreshWeather(new Date());
  }, WEATHER_REFRESH_MS);

  // Sample internet latency on its faster cadence.
  setInterval(() => {
    void refreshInternet();
  }, PING_REFRESH_MS);

  // Poll Last.fm for the current track.
  setInterval(() => {
    void refreshSpotify();
  }, SPOTIFY_REFRESH_MS);
}

void main();
