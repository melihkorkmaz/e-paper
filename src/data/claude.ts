import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import {
  PYTHON_BIN,
  CLAUDE_SCRIPT,
  CLAUDE_USAGE_FILE,
  ROOT,
} from "../config.js";
import type { ClaudeData } from "../render/widgets/claude.js";

const execFileAsync = promisify(execFile);

/** Shown until the first successful fetch, or whenever claude.py fails. */
const ERROR_STATE: ClaudeData = {
  error: true,
  fiveHour: { utilization: 0, resetsAt: "" },
  sevenDay: { utilization: 0, resetsAt: "" },
};

let latest: ClaudeData = ERROR_STATE;

/** Returns the most recent Claude usage snapshot. */
export function getClaude(): ClaudeData {
  return latest;
}

/**
 * Runs claude.py (refreshes the OAuth token + rewrites usage.json), then reads
 * usage.json. Auth/network failures surface as the widget's error state.
 */
export async function refreshClaude(): Promise<void> {
  try {
    await execFileAsync(PYTHON_BIN, [CLAUDE_SCRIPT], {
      cwd: ROOT,
      timeout: 30_000,
    });
  } catch {
    // claude.py exits non-zero on failure; still read whatever it wrote.
  }

  try {
    const raw = JSON.parse(await readFile(CLAUDE_USAGE_FILE, "utf8"));
    if (raw.error || !raw.five_hour) {
      latest = ERROR_STATE;
      return;
    }
    latest = {
      error: false,
      fiveHour: {
        utilization: raw.five_hour.utilization ?? 0,
        resetsAt: raw.five_hour.resets_at ?? "",
      },
      sevenDay: {
        utilization: raw.seven_day?.utilization ?? 0,
        resetsAt: raw.seven_day?.resets_at ?? "",
      },
    };
  } catch {
    latest = ERROR_STATE;
  }
}
