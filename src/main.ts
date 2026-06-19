import { createFrame, writeFramePng } from "./render/canvas.js";
import { renderScreen } from "./render/screen.js";
// import { pushFrame } from "./display.js";
import { nextRefresh } from "./refresh.js";
import { FRAME_PATH, RENDER_INTERVAL_MS } from "./config.js";
import { loadSpotifyAssets } from "./render/widgets/spotify.js";
import { preloadIcons } from "./render/icons.js";

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
  await loadSpotifyAssets();
  // First frame always forces a full refresh (clears the panel), like main.py startup.
  let counter = await renderAndPush(600);
  if (once) return;

  setInterval(() => {
    void renderAndPush(counter).then((c) => {
      counter = c;
    });
  }, RENDER_INTERVAL_MS);
}

void main();
