import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PYTHON_BIN, PRINTER_SCRIPT, PRINTER, ROOT } from "../config.js";
import type { PrinterData } from "../render/widgets/printer.js";

const execFileAsync = promisify(execFile);

/** Default when offline / unconfigured: the widget hides the bar for OFFLINE. */
const OFFLINE: PrinterData = {
  status: "OFFLINE",
  percentage: 0,
  remaining: 0,
  layers: "0/0",
};

let latest: PrinterData = OFFLINE;

/** Returns the most recent printer snapshot. */
export function getPrinter(): PrinterData {
  return latest;
}

/**
 * Runs python/printer.py to read the printer state once, mapping its JSON to
 * PrinterData. Any failure (unconfigured, unreachable, crash) → OFFLINE.
 */
export async function refreshPrinter(): Promise<void> {
  if (!PRINTER.ip || !PRINTER.serial || !PRINTER.accessCode) {
    latest = OFFLINE;
    return;
  }
  try {
    const { stdout } = await execFileAsync(PYTHON_BIN, [PRINTER_SCRIPT], {
      cwd: ROOT,
      timeout: 20_000,
    });
    const raw = JSON.parse(stdout);
    if (!raw.status || raw.error) {
      latest = OFFLINE;
      return;
    }
    latest = {
      status: raw.status,
      percentage: Number(raw.percentage) || 0,
      remaining: Number(raw.remaining_time) || 0,
      layers: raw.layers ?? "0/0",
    };
  } catch {
    latest = OFFLINE;
  }
}
