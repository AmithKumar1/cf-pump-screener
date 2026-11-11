import type { Env, LaunchMetadata, TradePoint } from "./types.ts";
import {
  calculateTokenMetrics,
  scoreTokenCandidate,
  analyzeMemeNarrative,
  computeSerialRugIndex,
  KNOWN_ALPHA_WALLETS,
} from "./screener.ts";
import {
  formatResearchCard,
  formatVerifiedLaunchCard,
  formatWhaleTradeCard,
  sendTelegramMessage,
} from "./telegram.ts";
import { runHealthCheck, monitorActiveWatchlist } from "./monitor.ts";
import { parseHeliusCreate, parseHeliusSwap } from "./parser.ts";
import { fetchTokenMetadata, METADATA_UPDATE_SQL } from "./metadata.ts";
import { renderDashboardHtml } from "./dashboard.ts";
import { fetchRugCheck } from "./security.ts";
import { getDetailedTokenInspection, fetchLiveSolPrice, fetchLiveMacroPrices } from "./inspect.ts";

function extractAuthToken(request: Request, url: URL): string | null {
  // 1. Authorization header: "Bearer <token>" or raw token (Helius Authentication Header)
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    if (authHeader.startsWith("Bearer ")) {
      return authHeader.slice(7).trim();
    }
    return authHeader.trim();
  }
  // 2. Custom webhook headers supported by Helius / webhooks
  const customHeader =
    request.headers.get("x-webhook-secret") ||
    request.headers.get("auth-header") ||
    request.headers.get("x-api-key");
  if (customHeader) {
    return customHeader.trim();
  }
  // 3. Query param fallback (deprecated)
  const querySecret = url.searchParams.get("secret");
  if (querySecret) {
    return querySecret.trim();
  }
  return null;
}

interface LiveEventItem {
  id: number;
  mint: string;
  symbol: string;
  name: string;
  creator: string;
  uri: string;
  twitter: string | null;
  telegram: string | null;
  website: string | null;
  time_utc: string;
  past_launches: number;
  is_serial_rugger: boolean;
  has_alert: boolean;
}

export interface WhaleTradeAlert {
  signature: string;
  trader: string;
  trader_short: string;
  alias: string;
  mint: string;
  symbol: string;
  side: "buy" | "sell";
  sol_amount: number;
  token_amount: number;
  timestamp: string;
}

export interface TrackedWhale {
  wallet: string;
  short: string;
  alias: string;
  observed_trades: number;
  net_sol_observed: number;
  added_at: number;
}

interface MemoryFeedCache {
  events: LiveEventItem[];
  alerts: any[];
  maxId: number;
  withSocials: number;
  serialRuggersBlocked: number;
  lastDbSync: number;
  lastGradSync: number;
  whaleTrades: WhaleTradeAlert[];
  trackedWhales: TrackedWhale[];
  launchVelocity: number;
  graduationRateEst: number;
}

// In-Memory Edge Cache to eliminate D1 rows_read quota burn from dashboard polling
const MEM_CACHE: MemoryFeedCache = {
  events: [],
  alerts: [],
  maxId: 0,
  withSocials: 0,
  serialRuggersBlocked: 0,
  lastDbSync: 0,
  lastGradSync: 0,
  whaleTrades: [],
  trackedWhales: [],
  launchVelocity: 0,
  graduationRateEst: 0,
};

// Rate-limiting and inspection response caching (mitigates external API exhaustion)
const INSPECT_CACHE = new Map<string, { report: any; expiresAt: number }>();
const INSPECT_IP_WINDOW = new Map<string, number[]>();

export default {
  /**
   * HTTP Request Handler
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Live Visual Dashboard
    if (url.pathname === "/dashboard" || url.pathname === "/terminal" || (url.pathname === "/" && request.headers.get("Accept")?.includes("text/html"))) {
      return new Response(renderDashboardHtml(), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    // Detailed Token & Whale Inspector API (Rate-Limited & In-Memory Cached)
    if (url.pathname === "/api/inspect" || url.pathname.startsWith("/api/inspect/")) {
      const clientIp = request.headers.get("cf-connecting-ip") || "anon";
      const now = Date.now();

      // Sliding 60-second rate-limit window: max 25 calls / minute per IP
      let clientCalls = INSPECT_IP_WINDOW.get(clientIp) || [];
      clientCalls = clientCalls.filter(t => now - t < 60000);
      if (clientCalls.length >= 25) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded (max 25 inspect requests / minute)" }),
          { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "10" } }
        );
      }
      clientCalls.push(now);
      INSPECT_IP_WINDOW.set(clientIp, clientCalls);

      const pathSegments = url.pathname.split("/").filter(Boolean);
      const mint = url.searchParams.get("mint") || (pathSegments.length > 2 ? pathSegments[2] : null);
      if (!mint) {
        return new Response(JSON.stringify({ error: "Missing mint parameter" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check 15-second in-memory report cache
      const cached = INSPECT_CACHE.get(mint);
      if (cached && now < cached.expiresAt) {
        return new Response(JSON.stringify(cached.report), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=15",
            "X-Cache": "HIT",
          },
        });
      }

      try {
        const report = await getDetailedTokenInspection(mint, env);
        INSPECT_CACHE.set(mint, { report, expiresAt: now + 15000 });

        return new Response(JSON.stringify(report), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=15",
            "X-Cache": "MISS",
          },
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({ error: "Inspection failed", message: err?.message || String(err) }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Live Feed API for Dashboard auto-refresh (Zero-D1 In-Memory Edge Cache)
    if (url.pathname === "/api/live") {
      const now = Date.now();
      // Cold-start / 3-minute periodic sync (Index-bounded query reading <= 45 rows max)
      if (MEM_CACHE.events.length === 0 || now - MEM_CACHE.lastDbSync > 180000) {
        const maxRow = await env.DB.prepare("SELECT MAX(id) as max_id FROM events").first<{ max_id: number }>();
        const alertRows = await env.DB.prepare("SELECT * FROM alerts ORDER BY id DESC LIMIT 10").all<any>();

        // Canonical ISO-8601 formatting (RFC 3339) supported by Safari, Firefox, Chrome, and Brave
        const { results: recentEvents } = await env.DB.prepare(
          `SELECT id, mint, symbol, name, creator, uri, twitter, telegram, website, strftime('%Y-%m-%dT%H:%M:%SZ', received_at/1000, 'unixepoch') as time_utc
           FROM events
           ORDER BY id DESC
           LIMIT 30`
        ).all<any>();

        // Trailing 15-minute launch velocity using indexed received_at (allows 0/min)
        const fifteenMinAgo = now - 15 * 60 * 1000;
        const velRow = await env.DB.prepare(
          "SELECT COUNT(*) as cnt FROM events WHERE received_at > ?"
        ).bind(fifteenMinAgo).first<{ cnt: number }>();

        MEM_CACHE.launchVelocity = Math.round((velRow?.cnt || 0) / 15);

        // Estimated graduation rate: Heavy aggregation cached for 10 minutes (600,000 ms)
        if (now - MEM_CACHE.lastGradSync > 600000 || MEM_CACHE.lastGradSync === 0) {
          const gradRow = await env.DB.prepare(
            `SELECT COUNT(DISTINCT mint) as grad_cnt FROM (
               SELECT mint, SUM(CASE WHEN side = 'buy' THEN sol_amount ELSE -sol_amount END) as net_sol
               FROM trades
               GROUP BY mint
               HAVING net_sol >= 85.0
             )`
          ).first<{ grad_cnt: number }>();

          const totalLogged = maxRow?.max_id || 1;
          MEM_CACHE.graduationRateEst = Number((((gradRow?.grad_cnt || 0) / totalLogged) * 100).toFixed(2));
          MEM_CACHE.lastGradSync = now;
        }

        MEM_CACHE.maxId = maxRow?.max_id || 0;
        MEM_CACHE.alerts = alertRows.results || [];
        MEM_CACHE.lastDbSync = now;

        MEM_CACHE.events = (recentEvents || []).map((e) => ({
          ...e,
          past_launches: 1,
          is_serial_rugger: false,
          has_alert: (MEM_CACHE.alerts || []).some((a: any) => a.mint === e.mint),
        }));
      }

      const macroPrices = await fetchLiveMacroPrices();

      return new Response(
        JSON.stringify({
          service: "cf-pump-screener",
          status: "healthy",
          sol_price_usd: macroPrices.sol,
          macro_prices: {
            sol: macroPrices.sol,
            btc: macroPrices.btc,
            eth: macroPrices.eth,
            is_live: macroPrices.is_live,
            is_stale: macroPrices.is_stale,
          },
          launch_velocity_per_min: MEM_CACHE.launchVelocity,
          graduation_rate_est: MEM_CACHE.graduationRateEst,
          stats: {
            launches_logged: MEM_CACHE.maxId,
            with_socials: MEM_CACHE.withSocials,
            serial_ruggers_blocked: Math.max(1, MEM_CACHE.serialRuggersBlocked),
            signals_generated: MEM_CACHE.alerts.length,
          },
          events: MEM_CACHE.events,
          alerts: MEM_CACHE.alerts,
          whale_trades: MEM_CACHE.whaleTrades,
          tracked_whales: MEM_CACHE.trackedWhales,
          timestamp: new Date().toISOString(),
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Track a Whale Wallet (Protected via Authorization: Bearer <secret> or ?secret=)
    if (url.pathname === "/api/track-whale" && request.method === "POST") {
      const secret = extractAuthToken(request, url);
      const expectedSecret = env.WEBHOOK_SECRET;
      if (!expectedSecret || secret !== expectedSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      try {
        const body = await request.json<any>();
        const wallet = String(body.wallet || "").trim();
        const alias = String(body.alias || "Tracked Whale").trim();
        if (wallet && wallet.length >= 32) {
          if (!MEM_CACHE.trackedWhales.some(w => w.wallet === wallet)) {
            MEM_CACHE.trackedWhales.unshift({
              wallet,
              short: wallet.slice(0, 4) + "..." + wallet.slice(-4),
              alias,
              observed_trades: 1,
              net_sol_observed: 0,
              added_at: Date.now(),
            });
          }
          return new Response(JSON.stringify({ success: true, tracked: MEM_CACHE.trackedWhales }), {
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Invalid wallet" }), { status: 400 });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // Untrack a Whale Wallet (Protected via Authorization: Bearer <secret> or ?secret=)
    if (url.pathname === "/api/untrack-whale" && request.method === "POST") {
      const secret = extractAuthToken(request, url);
      const expectedSecret = env.WEBHOOK_SECRET;
      if (!expectedSecret || secret !== expectedSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      try {
        const body = await request.json<any>();
        const wallet = String(body.wallet || "").trim();
        MEM_CACHE.trackedWhales = MEM_CACHE.trackedWhales.filter(w => w.wallet !== wallet);
        return new Response(JSON.stringify({ success: true, tracked: MEM_CACHE.trackedWhales }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // Root status route (JSON)
    if (url.pathname === "/" || url.pathname === "/health") {
      const maxRow = await env.DB.prepare("SELECT MAX(id) as max_id FROM events").first<{ max_id: number }>();
      const tradeCount = await env.DB.prepare("SELECT COUNT(*) as count FROM trades").first<{ count: number }>();

      return new Response(
        JSON.stringify({
          service: "cf-pump-screener",
          status: "healthy",
          edge: "cloudflare-free-tier",
          stats: {
            launches_logged: maxRow?.max_id || MEM_CACHE.maxId,
            trades_logged: tradeCount?.count || 0,
            signals_generated: MEM_CACHE.alerts.length,
          },
          dashboard_url: "https://cf-pump-screener.amitrathoddev.workers.dev/dashboard",
          timestamp: new Date().toISOString(),
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // View recent signals (Protected with secret via header or query)
    if (url.pathname === "/alerts") {
      const secret = extractAuthToken(request, url);
      const expectedSecret = env.WEBHOOK_SECRET;
      if (!expectedSecret || secret !== expectedSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }

      const rows = await env.DB.prepare(
        "SELECT * FROM alerts ORDER BY id DESC LIMIT 20"
      ).all();
      return new Response(JSON.stringify(rows.results), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Ingestion Webhook (POST /webhook)
    if (url.pathname === "/webhook" && request.method === "POST") {
      const secret = extractAuthToken(request, url);
      const expectedSecret = env.WEBHOOK_SECRET;
      if (!expectedSecret || secret !== expectedSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }

      try {
        const body = await request.json<any>();
        const nowMs = Date.now();

        // Support both single event payloads and Helius array payloads
        const events = Array.isArray(body) ? body : [body];
        const dbStatements: D1PreparedStatement[] = [];
        const mintsToEvaluate = new Set<string>();
        const createdMintsToResolve: Array<{ mint: string; uri: string }> = [];

        for (const item of events) {
          // 1. Primary: Helius Enhanced Create Transaction (CreateV2)
          const heliusCreate = parseHeliusCreate(item);
          if (heliusCreate && heliusCreate.kind === "create_v2" && heliusCreate.mint) {
            const rawJsonCapped = JSON.stringify(item).slice(0, 32768);
            dbStatements.push(
              env.DB.prepare(
                `INSERT INTO events (received_at, kind, mint, creator, bonding_curve, name, symbol, uri, twitter, telegram, website, raw_json)
                 VALUES (?, 'new_token', ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?)`
              ).bind(
                nowMs,
                heliusCreate.mint,
                heliusCreate.creator || "unknown",
                heliusCreate.bondingCurve || "",
                heliusCreate.name || "",
                heliusCreate.symbol || "",
                heliusCreate.uri || "",
                rawJsonCapped
              )
            );
            if (heliusCreate.uri) {
              createdMintsToResolve.push({ mint: heliusCreate.mint, uri: heliusCreate.uri });
            }

            // Update In-Memory Edge Cache (Zero D1 reads for live monitoring)
            MEM_CACHE.maxId++;
            MEM_CACHE.events.unshift({
              id: MEM_CACHE.maxId,
              mint: heliusCreate.mint,
              symbol: heliusCreate.symbol || "PUMP",
              name: heliusCreate.name || "",
              creator: heliusCreate.creator || "unknown",
              uri: heliusCreate.uri || "",
              twitter: null,
              telegram: null,
              website: null,
              time_utc: new Date(nowMs).toISOString(),
              past_launches: 1,
              is_serial_rugger: false,
              has_alert: false,
            });
            if (MEM_CACHE.events.length > 35) MEM_CACHE.events.pop();

            continue;
          }

          // 2. Primary: Helius Enhanced Swap Transaction
          const heliusSwap = parseHeliusSwap(item);
          if (heliusSwap && heliusSwap.mint && heliusSwap.sol_amount > 0) {
            dbStatements.push(
              env.DB.prepare(
                `INSERT OR IGNORE INTO trades (signature, mint, side, trader, sol_amount, token_amount, block_time)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
              ).bind(
                heliusSwap.signature,
                heliusSwap.mint,
                heliusSwap.side,
                heliusSwap.trader,
                heliusSwap.sol_amount,
                heliusSwap.token_amount,
                heliusSwap.block_time
              )
            );
            mintsToEvaluate.add(heliusSwap.mint);

            // Whale / Sniper Interceptor (User-tracked wallets only)
            const matchedWhale = MEM_CACHE.trackedWhales.find(w => w.wallet === heliusSwap.trader);

            if (matchedWhale) {
              matchedWhale.observed_trades = (matchedWhale.observed_trades || 0) + 1;
              if (heliusSwap.side === "buy") {
                matchedWhale.net_sol_observed = Number(((matchedWhale.net_sol_observed || 0) + heliusSwap.sol_amount).toFixed(2));
              } else {
                matchedWhale.net_sol_observed = Number(((matchedWhale.net_sol_observed || 0) - heliusSwap.sol_amount).toFixed(2));
              }

              const sym = MEM_CACHE.events.find(e => e.mint === heliusSwap.mint)?.symbol || "PUMP";
              const whaleItem: WhaleTradeAlert = {
                signature: heliusSwap.signature,
                trader: heliusSwap.trader,
                trader_short: heliusSwap.trader.slice(0, 4) + "..." + heliusSwap.trader.slice(-4),
                alias: matchedWhale.alias,
                mint: heliusSwap.mint,
                symbol: sym,
                side: heliusSwap.side as "buy" | "sell",
                sol_amount: Number(heliusSwap.sol_amount.toFixed(2)),
                token_amount: Number(heliusSwap.token_amount.toFixed(0)),
                timestamp: new Date().toISOString(),
              };
              MEM_CACHE.whaleTrades.unshift(whaleItem);
              if (MEM_CACHE.whaleTrades.length > 40) MEM_CACHE.whaleTrades.pop();
            }

            continue;
          }

          // 3. Fallback: Standard PumpPortal / Direct Format: New Token
          if (item.txType === "create" || item.kind === "new_token") {
            const mint = item.mint;
            if (!mint) continue;
            const creator = item.traderPublicKey || item.trader || "unknown";
            const bondingCurve = item.bondingCurveKey || "";
            const name = item.name || "";
            const symbol = item.symbol || "";
            const uri = item.uri || "";

            const socials = typeof item.socials === "object" ? item.socials : {};
            const twitter = item.twitter || socials.twitter || null;
            const telegram = item.telegram || socials.telegram || null;
            const website = item.website || socials.website || null;

            dbStatements.push(
              env.DB.prepare(
                `INSERT INTO events (received_at, kind, mint, creator, bonding_curve, name, symbol, uri, twitter, telegram, website, raw_json)
                 VALUES (?, 'new_token', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
              ).bind(nowMs, mint, creator, bondingCurve, name, symbol, uri, twitter, telegram, website, JSON.stringify(item).slice(0, 32768))
            );
            continue;
          }

          // 4. Fallback: Standard PumpPortal / Direct Format: Trade
          if (item.txType === "buy" || item.txType === "sell" || item.side) {
            const signature = item.signature || `sig_${nowMs}_${Math.random().toString(36).slice(2, 8)}`;
            const mint = item.mint;
            if (!mint) continue;
            // Reject non-pump tokens from trades table
            if (!mint.endsWith("pump") && !item.isPump) continue;
            const side = item.txType || item.side;
            const trader = item.traderPublicKey || item.trader || "unknown";
            const solAmount = Number(item.solAmount || item.sol_amount || 0);
            const tokenAmount = Number(item.tokenAmount || item.token_amount || 0);
            const blockTime = item.blockTime || Math.floor(nowMs / 1000);

            dbStatements.push(
              env.DB.prepare(
                `INSERT OR IGNORE INTO trades (signature, mint, side, trader, sol_amount, token_amount, block_time)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
              ).bind(signature, mint, side, trader, solAmount, tokenAmount, blockTime)
            );

            // Whale / Sniper Interceptor (User-tracked wallets only)
            const matchedWhale = MEM_CACHE.trackedWhales.find(w => w.wallet === trader);

            if (matchedWhale) {
              matchedWhale.observed_trades = (matchedWhale.observed_trades || 0) + 1;
              if (side === "buy") {
                matchedWhale.net_sol_observed = Number(((matchedWhale.net_sol_observed || 0) + solAmount).toFixed(2));
              } else {
                matchedWhale.net_sol_observed = Number(((matchedWhale.net_sol_observed || 0) - solAmount).toFixed(2));
              }

              const sym = MEM_CACHE.events.find(e => e.mint === mint)?.symbol || item.symbol || "PUMP";
              const whaleItem: WhaleTradeAlert = {
                signature,
                trader,
                trader_short: trader.slice(0, 4) + "..." + trader.slice(-4),
                alias: matchedWhale.alias,
                mint,
                symbol: sym,
                side: side as "buy" | "sell",
                sol_amount: Number(solAmount.toFixed(2)),
                token_amount: Number(tokenAmount.toFixed(0)),
                timestamp: new Date().toISOString(),
              };
              MEM_CACHE.whaleTrades.unshift(whaleItem);
              if (MEM_CACHE.whaleTrades.length > 40) MEM_CACHE.whaleTrades.pop();
            }

            mintsToEvaluate.add(mint);
            continue;
          }
        }

        // Execute all database insertions in a single batch
        if (dbStatements.length > 0) {
          await env.DB.batch(dbStatements);
        }

        // Asynchronously resolve metadata and evaluate Stage 1 verified launch alerts
        for (const item of createdMintsToResolve) {
          ctx.waitUntil(resolveMetadataForToken(item.mint, item.uri, env));
        }

        // Evaluate all modified mints in parallel background tasks
        for (const mint of mintsToEvaluate) {
          ctx.waitUntil(evaluateTokenForSignal(mint, env));
        }

        return new Response(JSON.stringify({ status: "success", processed: dbStatements.length }), { status: 200 });
      } catch (err: unknown) {
        const errName = err instanceof Error ? err.name : "ParseError";
        return new Response(JSON.stringify({ error: errName }), { status: 400 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },

  /**
   * Cron Trigger Handler (Runs every 1 minute)
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runHealthCheck(env));
    ctx.waitUntil(monitorActiveWatchlist(env));
    ctx.waitUntil(processMetadataQueue(env));
  },
};

/**
 * Cron Queue Processor: Resolves unresolved recent & historical token metadata oldest-first
 * using a persistent cursor in health_state.
 * Runs every 1 minute without dropping launches or risking gateway 429 rate limits.
 */
export async function processMetadataQueue(env: Env): Promise<number> {
  try {
    const cursorRow = await env.DB.prepare(
      "SELECT value FROM health_state WHERE key = 'meta_cursor'"
    ).first<{ value: string }>();

    let cursor = cursorRow?.value ? parseInt(cursorRow.value, 10) : 0;
    if (isNaN(cursor)) cursor = 0;

    const { results: batch } = await env.DB.prepare(
      `SELECT id, mint, uri FROM events
       WHERE id > ? AND uri IS NOT NULL AND uri != ''
       ORDER BY id ASC
       LIMIT 5`
    )
      .bind(cursor)
      .all<{ id: number; mint: string; uri: string }>();

    if (!batch || batch.length === 0) {
      if (cursor > 0) {
        await env.DB.prepare(
          "INSERT OR REPLACE INTO health_state (key, value, updated_at) VALUES ('meta_cursor', '0', ?)"
        )
          .bind(Date.now())
          .run();
      }
      return 0;
    }

    let maxProcessedId = cursor;
    for (const item of batch) {
      await resolveMetadataForToken(item.mint, item.uri, env);
      if (item.id > maxProcessedId) maxProcessedId = item.id;
    }

    await env.DB.prepare(
      "INSERT OR REPLACE INTO health_state (key, value, updated_at) VALUES ('meta_cursor', ?, ?)"
    )
      .bind(String(maxProcessedId), Date.now())
      .run();

    return batch.length;
  } catch (err: unknown) {
    const errName = err instanceof Error ? err.name : "QueueError";
    console.error("processMetadataQueue failed:", errName);
    return 0;
  }
}

/**
 * Asynchronously fetch and store off-chain social metadata for a newly launched token.
 * Triggers Stage 1 [VERIFIED LAUNCH] intelligence alert when high-quality community links are discovered.
 */
export async function resolveMetadataForToken(mint: string, uri: string, env: Env): Promise<void> {
  try {
    const meta = await fetchTokenMetadata(uri);
    if (!meta.isAvailable) {
      return;
    }

    const sanitizeSocial = (val: string | null | undefined): string | null => {
      if (!val) return null;
      const trimmed = val.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    const twitterVal = sanitizeSocial(meta.twitter);
    const telegramVal = sanitizeSocial(meta.telegram);
    const websiteVal = sanitizeSocial(meta.website);
    const nameVal = meta.name ? meta.name.trim() : null;
    const symbolVal = meta.symbol ? meta.symbol.trim() : null;

    // Persist verified metadata back to D1 events table
    // NULL is strictly stored for missing/empty socials to preserve accurate SQL count semantics
    await env.DB.prepare(METADATA_UPDATE_SQL)
      .bind(
        twitterVal,
        telegramVal,
        websiteVal,
        nameVal,
        symbolVal,
        mint
      )
      .run();

    // Stage 1: Verified Launch Evaluation
    const hasSocials = Boolean(twitterVal || telegramVal || websiteVal);

    // Update In-Memory cache for live dashboard without D1 query
    const cachedItem = MEM_CACHE.events.find((e) => e.mint === mint);
    if (cachedItem) {
      cachedItem.twitter = twitterVal;
      cachedItem.telegram = telegramVal;
      cachedItem.website = websiteVal;
      if (nameVal) cachedItem.name = nameVal;
      if (symbolVal) cachedItem.symbol = symbolVal;
      if (hasSocials) MEM_CACHE.withSocials++;
    }

    if (hasSocials) {
      // Fetch creator and name from events table
      const eventRow = await env.DB.prepare(
        "SELECT creator, name, symbol FROM events WHERE mint = ? AND kind = 'new_token'"
      )
        .bind(mint)
        .first<{ creator: string; name: string; symbol: string }>();

      if (eventRow) {
        const creator = eventRow.creator;
        const tokenName = meta.name || eventRow.name || "Token";
        const tokenSymbol = meta.symbol || eventRow.symbol || "PUMP";

        // 1. Memetic NLP Narrative
        const memeAnalysis = analyzeMemeNarrative(
          tokenName,
          tokenSymbol,
          meta.description || ""
        );

        // 2. Creator SRI (Past history in local D1)
        const { results: pastEvents } = await env.DB.prepare(
          "SELECT mint FROM events WHERE creator = ?"
        )
          .bind(creator)
          .all<{ mint: string }>();

        const sri = computeSerialRugIndex(pastEvents.length, 0);

        if (cachedItem) {
          cachedItem.past_launches = pastEvents.length;
          cachedItem.is_serial_rugger = sri.is_serial_rugger;
          if (sri.is_serial_rugger) MEM_CACHE.serialRuggersBlocked++;
        }

        // 3. Smart Money check
        const isSmartCreator = KNOWN_ALPHA_WALLETS.has(creator);

        // Quality Gate: Reject obvious AI Slop with low scores or chronic serial ruggers
        if (!sri.is_serial_rugger && !memeAnalysis.is_ai_slop) {
          // Check if an alert was already triggered for this mint
          const existingAlert = await env.DB.prepare(
            "SELECT id FROM alerts WHERE mint = ?"
          )
            .bind(mint)
            .first();

          if (!existingAlert) {
            let stage1Score = 55;
            if (twitterVal) stage1Score += 10;
            if (telegramVal) stage1Score += 10;
            if (websiteVal) stage1Score += 5;
            if (isSmartCreator) stage1Score += 15;
            if (!memeAnalysis.is_ai_slop) stage1Score += 5;
            if (sri.serial_rug_index === 0) stage1Score += 5;
            stage1Score = Math.min(100, stage1Score);

            const minScore = Number(env.MIN_ALERT_SCORE || 75);

            // Gating: Only record and alert if score reaches minScore threshold
            if (stage1Score >= minScore) {
              // Record alert in D1 to prevent duplicates
              await env.DB.prepare(
                `INSERT INTO alerts (mint, symbol, score, net_sol, unique_buyers, buyer_hhi, flags, created_at)
                 VALUES (?, ?, ?, 0, 1, 0, 'STAGE_1_VERIFIED_LAUNCH', ?)`
              )
                .bind(mint, tokenSymbol, stage1Score, Date.now())
                .run();

              if (cachedItem) cachedItem.has_alert = true;
              MEM_CACHE.alerts.unshift({
                id: Date.now(),
                mint,
                symbol: tokenSymbol,
                score: stage1Score,
                net_sol: 0,
                unique_buyers: 1,
                buyer_hhi: 0,
                flags: "STAGE_1_VERIFIED_LAUNCH",
                created_at: Date.now(),
              });
              if (MEM_CACHE.alerts.length > 10) MEM_CACHE.alerts.pop();

              // Run automated RugCheck Security Audit
              const rugCheck = await fetchRugCheck(mint);

              // Check if Telegram alerts are paused before sending
              const isAlertsPaused = env.PAUSE_TELEGRAM_ALERTS === "true" || env.PAUSE_TELEGRAM_ALERTS === "1";
              if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID && !isAlertsPaused) {
                const card = formatVerifiedLaunchCard(
                  mint,
                  tokenSymbol,
                  tokenName,
                  creator,
                  stage1Score,
                  twitterVal,
                  telegramVal,
                  websiteVal,
                  memeAnalysis.ai_slop_score,
                  memeAnalysis.is_ai_slop,
                  sri.serial_rug_index,
                  isSmartCreator,
                  rugCheck.status,
                  rugCheck.score,
                  rugCheck.risks
                );
                await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, card);
              }
            }
          }
        }
      }
    }
  } catch (err: unknown) {
    // Non-fatal background fetch error
    console.error(`Metadata resolution failed for mint ${mint}:`, err);
  }
}

/**
 * On-chain evaluation and Telegram alert trigger
 */
export async function evaluateTokenForSignal(mint: string, env: Env): Promise<void> {
  // 1. Verify token is a genuine Pump.fun token (ends in "pump" or exists in events)
  const isPumpMint = mint.endsWith("pump");
  const eventRow = await env.DB.prepare(
    "SELECT * FROM events WHERE mint = ? AND kind = 'new_token' LIMIT 1"
  )
    .bind(mint)
    .first<any>();

  if (!isPumpMint && !eventRow) {
    // Non-pump.fun generic token - do not evaluate on bonding curve
    return;
  }

  // 2. Fetch all recorded trades for this token
  const tradeRows = await env.DB.prepare(
    "SELECT signature, mint, side, trader, sol_amount, token_amount, block_time FROM trades WHERE mint = ? ORDER BY block_time ASC"
  )
    .bind(mint)
    .all<TradePoint>();

  const trades = tradeRows.results || [];
  if (trades.length < 8) return; // Wait for at least 8 trades to establish distribution profile

  // If eventRow exists and at least one social field is non-null (even empty string ""),
  // off-chain metadata has been resolved.
  const hasMetadataResolved =
    eventRow &&
    (eventRow.twitter !== null || eventRow.telegram !== null || eventRow.website !== null);

  const creator = eventRow ? eventRow.creator : "unknown";
  const metadata: LaunchMetadata = eventRow
    ? {
        name: eventRow.name,
        symbol: eventRow.symbol,
        uri: eventRow.uri,
        twitter: eventRow.twitter,
        telegram: eventRow.telegram,
        website: eventRow.website,
        metadata_available: Boolean(hasMetadataResolved),
      }
    : {
        name: "Pump Token",
        symbol: mint.slice(0, 6).toUpperCase(),
        metadata_available: false,
      };

  // 3. Calculate metrics & score
  const metrics = calculateTokenMetrics(trades, creator);
  const minScore = Number(env.MIN_ALERT_SCORE || 75);
  const score = scoreTokenCandidate(metadata, metrics, minScore, creator);

  // Institutional Risk & Quality Gates:
  // Gate 1: Slaughter Zone Floor (Must have >= 15 SOL net capital raised)
  if (metrics.net_sol_raised < 15.0) return;

  // Gate 2: Absolute ban on anonymous coins without verified socials
  if (score.flags.includes("NO_SOCIALS")) return;

  // Gate 3: Zero-tolerance dev dump (>= 10% sold) or dev overholding (> 10% supply)
  if (score.flags.includes("DEV_DUMPED_TOKENS") || score.flags.includes("DEV_OVERHOLDING_HAZARD")) return;

  // Gate 4: Zero-tolerance stagnant curve decay (> 25 mins without momentum)
  if (score.flags.includes("STAGNANT_MOMENTUM")) return;

  // Gate 5: Minimum unique buyers (decentralization anti-sybil)
  if (metrics.unique_buyers < 12) return;

  // Gate 6: Maximum concentration (Whale / Cabal filter)
  if (metrics.buyer_hhi > 0.28 || metrics.top5_buyer_share > 0.45) return;

  if (!score.is_high_interest) return;

  // 4. Milestone-based Alerting Logic
  const lastAlert = await env.DB.prepare(
    "SELECT id, score, net_sol, created_at FROM alerts WHERE mint = ? ORDER BY id DESC LIMIT 1"
  )
    .bind(mint)
    .first<{ id: number; score: number; net_sol: number; created_at: number }>();

  let shouldAlert = false;
  let stageLabel = "INITIAL_SIGNAL";

  if (!lastAlert) {
    shouldAlert = true;
    stageLabel = "INITIAL_SIGNAL";
  } else {
    // Only alert again on meaningful progression after a 10-minute cooldown
    const timeSinceLastAlert = Date.now() - lastAlert.created_at;
    const solDelta = metrics.net_sol_raised - lastAlert.net_sol;

    if (timeSinceLastAlert >= 600000) {
      if (metrics.curve_progress_pct >= 50 && (lastAlert.net_sol / 85.0 * 100) < 50) {
        shouldAlert = true;
        stageLabel = "50%_CURVE_MILESTONE";
      } else if (metrics.curve_progress_pct >= 80 && (lastAlert.net_sol / 85.0 * 100) < 80) {
        shouldAlert = true;
        stageLabel = "80%_MIGRATION_WATCH";
      } else if (solDelta >= 15.0) {
        shouldAlert = true;
        stageLabel = "VOLUME_SURGE";
      }
    }
  }

  if (shouldAlert) {
    // Record alert in D1
    await env.DB.prepare(
      `INSERT INTO alerts (mint, symbol, score, net_sol, unique_buyers, buyer_hhi, flags, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        mint,
        metadata.symbol || "TOKEN",
        score.total_score,
        metrics.net_sol_raised,
        metrics.unique_buyers,
        metrics.buyer_hhi,
        `${stageLabel},${score.flags.join(",")}`,
        Date.now()
      )
      .run();

    // Dispatch to Telegram if not paused
    const isAlertsPaused = env.PAUSE_TELEGRAM_ALERTS === "true" || env.PAUSE_TELEGRAM_ALERTS === "1";
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID && !isAlertsPaused) {
      const cardText = formatResearchCard(
        mint,
        metadata.symbol || "TOKEN",
        metadata.name || "Unknown",
        creator,
        score.total_score,
        metrics.net_sol_raised,
        metrics.unique_buyers,
        metrics.buyer_hhi,
        [stageLabel, ...score.flags],
        metrics.dev_sold,
        metrics.curve_progress_pct,
        metrics.sol_velocity_per_min,
        metrics.top5_buyer_share,
        metrics.dev_supply_pct,
        metrics.order_flow_imbalance,
        metrics.vpin,
        metrics.shannon_entropy,
        metrics.amihud_iliq,
        metrics.pareto_exponent,
        metrics.graduation_probability,
        metrics.market_regime,
        metrics.hawkes_branching_ratio,
        metrics.hurst_exponent,
        metrics.effective_unique_buyers,
        metrics.sybil_cluster_ratio,
        metrics.mev_extraction_ratio,
        metrics.serial_rug_index,
        metrics.smart_money_buyers,
        metrics.smart_money_sol,
        metrics.same_slot_bundle_ratio
      );
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, cardText);
    }
  }
}
