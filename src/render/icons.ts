import { loadImage, type Image } from "@napi-rs/canvas";
import { join } from "node:path";
import { ROOT } from "../config.js";

/** Shared icon cache, ported from main.py's get_cached_icon / icon_cache. */
const cache = new Map<string, Image>();
const ICON_DIR = join(ROOT, "assets", "icons");

/** Loads `.bmp` icons into the cache once. Call at startup before rendering. */
export async function preloadIcons(names: string[]): Promise<void> {
  for (const name of names) {
    if (cache.has(name)) continue;
    try {
      cache.set(name, await loadImage(join(ICON_DIR, `${name}.bmp`)));
    } catch {
      // Missing icon: widgets fall back to a drawn placeholder.
    }
  }
}

/** Returns a preloaded icon, or null if it failed to load. */
export function getIcon(name: string): Image | null {
  return cache.get(name) ?? null;
}
