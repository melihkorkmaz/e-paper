import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ROOT, WEB_PORT } from "./config.js";
import { getSettings, updateSettings } from "./settings.js";
import { getMode, nextOccurrence } from "./schedule.js";

const PAGE = join(ROOT, "web", "index.html");

function sendJson(res: ServerResponse, code: number, body: unknown): void {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e as Error);
      }
    });
    req.on("error", reject);
  });
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { method, url } = req;

  if (method === "GET" && url === "/") {
    const html = await readFile(PAGE, "utf8");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  if (method === "GET" && url === "/api/config") {
    const settings = getSettings();
    sendJson(res, 200, { settings, mode: getMode(new Date(), settings) });
    return;
  }

  if (method === "POST" && url === "/api/config") {
    const result = updateSettings(await readBody(req));
    sendJson(res, result.ok ? 200 : 400, result);
    return;
  }

  if (method === "POST" && url === "/api/sleep") {
    // Force night until the next morning, then resume the normal schedule.
    const sleepUntil = nextOccurrence(getSettings().schedule.dayStart, new Date()).toISOString();
    const result = updateSettings({ override: { sleepUntil } });
    sendJson(res, result.ok ? 200 : 400, { ...result, sleepUntil });
    return;
  }

  if (method === "POST" && url === "/api/wake") {
    const result = updateSettings({ override: { sleepUntil: null } });
    sendJson(res, result.ok ? 200 : 400, result);
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
}

/** Starts the local config web app (trusted LAN, no auth). */
export function startServer(): void {
  const server = createServer((req, res) => {
    handle(req, res).catch((e) => sendJson(res, 500, { error: String(e) }));
  });
  // Never let a listen failure (e.g. port already in use) crash the dashboard.
  server.on("error", (err) => {
    console.error(`[web] server error, config UI unavailable: ${err.message}`);
  });
  server.listen(WEB_PORT, "0.0.0.0", () => {
    console.log(`[web] config UI on http://0.0.0.0:${WEB_PORT}`);
  });
}
