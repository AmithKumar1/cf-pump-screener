import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import worker from "./index.ts";
import { LocalD1Database } from "./local_db.ts";
import { PumpPortalFeed } from "./ws_feed.ts";
import type { Env } from "./types.ts";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Auto-load .env file if present in project root
const ENV_PATH = path.resolve(PROJECT_ROOT, ".env");
if (fs.existsSync(ENV_PATH)) {
  try {
    const envContent = fs.readFileSync(ENV_PATH, "utf8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        if (!(key in process.env)) {
          process.env[key] = val;
        }
      }
    }
  } catch (err: any) {
    console.warn("[Notice] Could not load .env file:", err.message);
  }
}

// 1. Configuration & Environment Variables
const PORT = parseInt(process.env.PORT || "8787", 10);
const HOST = process.env.HOST || "0.0.0.0";
const DB_PATH = process.env.DB_PATH || path.resolve(PROJECT_ROOT, "data", "pump_launches.db");
const SCHEMA_PATH = path.resolve(PROJECT_ROOT, "schema.sql");
const MIN_ALERT_SCORE = process.env.MIN_ALERT_SCORE || "75";
const PAUSE_TELEGRAM_ALERTS = process.env.PAUSE_TELEGRAM_ALERTS || "true";
const ENABLE_STAGE1_TELEGRAM_ALERTS = process.env.ENABLE_STAGE1_TELEGRAM_ALERTS || "false";
const MIN_BREAKOUT_CURVE_PCT = process.env.MIN_BREAKOUT_CURVE_PCT || "35";
const MIN_BREAKOUT_VOLUME_USD = process.env.MIN_BREAKOUT_VOLUME_USD || "10000";
const MIN_BREAKOUT_BUYS = process.env.MIN_BREAKOUT_BUYS || "25";
const RETENTION_DAYS = parseInt(process.env.RETENTION_DAYS || "7", 10);
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const ENABLE_WS_FEED = process.env.ENABLE_WS_FEED !== "false";

console.log("==================================================");
console.log("  CF-PUMP-SCREENER LOCAL TERMINAL & ENGINE");
console.log("==================================================");
console.log(`Database:              ${DB_PATH}`);
console.log(`Local Port:            ${PORT}`);
console.log(`Telegram Alerts:       ${PAUSE_TELEGRAM_ALERTS === "true" ? "MUTED (Testing Mode)" : "ACTIVE"}`);
console.log(`Telegram Stage 1:      ${ENABLE_STAGE1_TELEGRAM_ALERTS === "true" ? "ENABLED (All creations)" : "MUTED (Alpha/Whale deployers only)"}`);
console.log(`Min Breakout Curve:    ${MIN_BREAKOUT_CURVE_PCT}%`);
console.log(`Min Breakout Volume:   $${MIN_BREAKOUT_VOLUME_USD}`);
console.log(`Min Breakout Buys:     ${MIN_BREAKOUT_BUYS} buys`);
console.log(`DB Auto-Retention:     ${RETENTION_DAYS} days`);
console.log(`Direct WebSocket Feed: ${ENABLE_WS_FEED ? "ENABLED (PumpPortal)" : "DISABLED"}`);
console.log("--------------------------------------------------");

// 2. Initialize Local SQLite D1 Database Adapter
const localDb = new LocalD1Database(DB_PATH);

// Ensure schema is applied
try {
  if (fs.existsSync(SCHEMA_PATH)) {
    const schemaSql = fs.readFileSync(SCHEMA_PATH, "utf8");
    localDb.exec(schemaSql);
  }
} catch (err: any) {
  console.warn("[Schema Notice]", err.message);
}

// 3. Assemble Cloudflare Worker Env Binding
const env: Env = {
  DB: localDb as unknown as D1Database,
  MIN_ALERT_SCORE,
  PAUSE_TELEGRAM_ALERTS,
  ENABLE_STAGE1_TELEGRAM_ALERTS,
  MIN_BREAKOUT_CURVE_PCT,
  MIN_BREAKOUT_VOLUME_USD,
  MIN_BREAKOUT_BUYS,
  WEBHOOK_SECRET,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
};

// 4. Background Scheduled Tasks (Cron Replacement)
const runScheduled = async () => {
  try {
    const ctx: any = {
      waitUntil(promise: Promise<any>) {
        Promise.resolve(promise).catch((err) => console.error("[Cron Task Error]", err));
      },
      passThroughOnException() {},
    };
    if (typeof worker.scheduled === "function") {
      await worker.scheduled({} as any, env, ctx);
    }
  } catch (err: any) {
    console.error("[Scheduled Loop Error]", err?.message || err);
  }
};

// Trigger immediately on startup, then every 60 seconds
runScheduled();
const cronTimer = setInterval(runScheduled, 60_000);

// 4b. Automatic Database Retention & Pruning (Runs daily)
const runPrune = async () => {
  try {
    const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const res = await localDb.prepare(
      `DELETE FROM events
       WHERE received_at < ?
         AND mint NOT IN (SELECT DISTINCT mint FROM alerts)
         AND mint NOT IN (SELECT DISTINCT mint FROM trades)`
    ).bind(cutoffMs).run();

    const deleted = (res as any)?.meta?.changes || 0;
    if (deleted > 0) {
      console.log(`[DB Retention] Pruned ${deleted} un-alerted historical events (> ${RETENTION_DAYS} days old).`);
      try {
        localDb.exec("PRAGMA optimize;");
      } catch {}
    }
  } catch (err: any) {
    console.warn("[DB Retention Notice]", err.message);
  }
};

setTimeout(runPrune, 15_000);
setInterval(runPrune, 24 * 60 * 60 * 1000);

// 5. Start Direct WebSocket Feed (Optional, On by default for zero-config local ingest)
let wsFeed: PumpPortalFeed | null = null;
if (ENABLE_WS_FEED) {
  wsFeed = new PumpPortalFeed(env);
  wsFeed.start();
}

// 6. Local HTTP Server
const server = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
  try {
    const hostHeader = req.headers.host || `localhost:${PORT}`;
    const fullUrl = `http://${hostHeader}${req.url}`;

    // Buffer incoming request body for POST / PUT / PATCH
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const bodyBuffer = Buffer.concat(chunks);
    const body = (req.method === "GET" || req.method === "HEAD") ? undefined : bodyBuffer;

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach((v) => headers.append(key, v));
        } else {
          headers.set(key, value);
        }
      }
    }

    const webReq = new Request(fullUrl, {
      method: req.method,
      headers,
      body,
      // @ts-ignore
      duplex: body ? "half" : undefined,
    });

    const ctx: any = {
      waitUntil(promise: Promise<any>) {
        Promise.resolve(promise).catch((err) => console.error("[Background Request Error]", err));
      },
      passThroughOnException() {},
    };

    const webRes = await worker.fetch(webReq, env, ctx);

    res.statusCode = webRes.status;
    webRes.headers.forEach((val, key) => {
      res.setHeader(key, val);
    });

    const resBuf = Buffer.from(await webRes.arrayBuffer());
    res.end(resBuf);
  } catch (err: any) {
    console.error("[HTTP Error]", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Internal Server Error", message: err?.message || String(err) }));
  }
});

server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.log(`[Notice] Port ${PORT} is already in use. Local screener is already running.`);
    process.exit(0);
  } else {
    console.error("[Server Error]", err);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n🚀 Local Screener running at:`);
  console.log(`   Bloomberg Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`   Live KPI Endpoint:   http://localhost:${PORT}/api/live`);
  console.log(`   Helius Webhook URL:  http://localhost:${PORT}/webhook\n`);
});

// 7. Clean Shutdown
const cleanup = () => {
  console.log("\n[Shutdown] Stopping local server...");
  clearInterval(cronTimer);
  if (wsFeed) wsFeed.stop();
  server.close(() => {
    localDb.close();
    console.log("[Shutdown] Done.");
    process.exit(0);
  });
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
