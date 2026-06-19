import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PING_HOST, PING_HISTORY_MAX } from "../config.js";
import {
  MOCK_INTERNET,
  type InternetData,
} from "../render/widgets/internet.js";

const execFileAsync = promisify(execFile);

/** Live snapshot. Starts empty; the mock is only used by --once previews. */
let latest: InternetData = { current: 0, history: [] };

/** Returns the most recent internet-quality snapshot. */
export function getInternet(): InternetData {
  return latest.history.length > 0 ? latest : MOCK_INTERNET;
}

/** `-W` is milliseconds on macOS but seconds on Linux (the Pi target). */
const pingArgs =
  process.platform === "darwin"
    ? ["-c", "1", "-W", "1000", PING_HOST]
    : ["-c", "1", "-W", "1", PING_HOST];

/** Pings PING_HOST once and returns latency in ms, or 0 on failure (main.py parity). */
async function pingOnce(): Promise<number> {
  try {
    const { stdout } = await execFileAsync("ping", pingArgs, { timeout: 5000 });
    const match = stdout.match(/time=([0-9.]+)/);
    return match ? Math.round(parseFloat(match[1])) : 0;
  } catch {
    return 0;
  }
}

/** Samples latency and appends it to the bounded history. */
export async function refreshInternet(): Promise<void> {
  const ms = await pingOnce();
  const history = [...latest.history, ms].slice(-PING_HISTORY_MAX);
  latest = { current: ms, history };
}
