import { loadImage, type Image } from "@napi-rs/canvas";
import { LASTFM } from "../config.js";
import type { SpotifyData } from "../render/widgets/spotify.js";

const LASTFM_URL = "http://ws.audioscrobbler.com/2.0/";

/** Idle state: shows the Spotify logo (used when paused or not configured). */
const IDLE: SpotifyData = {
  status: "PAUSED",
  artist: "",
  track: "",
  cover: null,
};

let latest: SpotifyData = IDLE;

/** Returns the most recent now-playing snapshot. */
export function getSpotify(): SpotifyData {
  return latest;
}

/** Downloads and decodes cover art, or null on any failure. */
async function loadCover(url: string): Promise<Image | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await loadImage(Buffer.from(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

/** Fetches the current Last.fm track. Returns null on failure (keep last good). */
async function fetchSpotify(): Promise<SpotifyData | null> {
  if (!LASTFM.apiKey || !LASTFM.username) return IDLE;

  const url =
    `${LASTFM_URL}?method=user.getrecenttracks` +
    `&user=${encodeURIComponent(LASTFM.username)}` +
    `&api_key=${encodeURIComponent(LASTFM.apiKey)}&format=json&limit=1`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    let tracks = data?.recenttracks?.track ?? [];
    if (!Array.isArray(tracks)) tracks = [tracks];
    const track = tracks[0];
    if (!track || track["@attr"]?.nowplaying !== "true") return IDLE;

    const imgUrl =
      (track.image ?? []).find(
        (i: { size: string; "#text": string }) => i.size === "extralarge",
      )?.["#text"] ?? "";

    return {
      status: "PLAYING",
      artist: track.artist?.["#text"] ?? "Unknown",
      track: track.name ?? "Unknown",
      cover: await loadCover(imgUrl),
    };
  } catch {
    return null;
  }
}

/** Refreshes the now-playing snapshot; keeps the last good value on failure. */
export async function refreshSpotify(): Promise<void> {
  const data = await fetchSpotify();
  if (data) latest = data;
}
