import { loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { join } from "node:path";
import { ROOT } from "../../config.js";
import { getIcon } from "../icons.js";

/** Now-playing snapshot. Mirrors main.py's data_store.spotify shape. */
export interface SpotifyData {
  status: "PLAYING" | "PAUSED";
  artist: string;
  track: string;
  /** Decoded cover art, or null to fall back to the placeholder box. */
  cover: Image | null;
}

/** Placeholder mock until Last.fm fetching is wired up. */
export const MOCK_SPOTIFY: SpotifyData = {
  status: "PAUSED",
  artist: "Brian Eno",
  track: "By This River",
  cover: null,
};

/** Loads the mock cover art into MOCK_SPOTIFY. Call once at startup. */
export async function loadSpotifyAssets(): Promise<void> {
  try {
    MOCK_SPOTIFY.cover = await loadImage(join(ROOT, "assets", "mock", "cover.png"));
  } catch {
    MOCK_SPOTIFY.cover = null;
  }
}

const COVER_SIZE = 96;
const GAP = 14;
const ICON_R = 14;

/** Truncates `text` with an ellipsis so it fits within `maxWidth` (ctx.font must be set). */
function fitText(ctx: SKRSContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxWidth) {
    s = s.slice(0, -1);
  }
  return s + "…";
}

/** Draws a circled play/pause button centred at (cx, cy) with radius `r`. */
function drawTransport(
  ctx: SKRSContext2D,
  cx: number,
  cy: number,
  r: number,
  playing: boolean,
): void {
  ctx.strokeStyle = "#000000";
  ctx.fillStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  if (playing) {
    const t = r * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - t * 0.6, cy - t);
    ctx.lineTo(cx - t * 0.6, cy + t);
    ctx.lineTo(cx + t, cy);
    ctx.closePath();
    ctx.fill();
  } else {
    const bw = r * 0.28;
    const bh = r * 0.9;
    ctx.fillRect(cx - bw * 1.6, cy - bh / 2, bw, bh);
    ctx.fillRect(cx + bw * 0.6, cy - bh / 2, bw, bh);
  }
}

/**
 * Renders the Spotify "now playing" widget at column origin (x, y).
 * `width` is the drawable width from x (artist/track truncate at x + width).
 * Styling matches the reference: square cover, circled play button, artist + track.
 */
export function renderSpotify(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  data: SpotifyData,
): void {
  ctx.textBaseline = "top";
  ctx.fillStyle = "#000000";

  // Nothing playing: show the Spotify logo + label, centred in the cover height.
  if (data.status !== "PLAYING") {
    const logo = COVER_SIZE * 0.7;
    const logoY = y + (COVER_SIZE - logo) / 2;
    const logoImg = getIcon("icon_spotify");
    if (logoImg) {
      ctx.drawImage(logoImg, x, logoY, logo, logo);
    }
    ctx.font = "32px Aldrich";
    ctx.textBaseline = "middle";
    ctx.fillText("SPOTIFY", x + logo + GAP, y + COVER_SIZE / 2);
    ctx.textBaseline = "top";
    return;
  }

  // Cover art, or a placeholder box when no art is available (main.py parity).
  if (data.cover) {
    ctx.drawImage(data.cover, x, y, COVER_SIZE, COVER_SIZE);
  } else {
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, COVER_SIZE, COVER_SIZE);
  }

  // Text column sits to the right of the cover and is clipped to the divider.
  const textX = x + COVER_SIZE + GAP;
  const textW = width - (textX - x);
  const playing = data.status === "PLAYING";

  // Line 1: circled play/pause button + artist.
  const artistY = y + 6;
  drawTransport(ctx, textX + ICON_R, artistY + 14, ICON_R, playing);
  const artistX = textX + ICON_R * 2 + 10;
  ctx.font = "28px Aldrich";
  ctx.fillText(fitText(ctx, data.artist, textW - (artistX - textX)), artistX, artistY);

  // Line 2: track, full text width.
  ctx.font = "24px Aldrich";
  ctx.fillText(fitText(ctx, data.track, textW), textX, artistY + 42);
}
