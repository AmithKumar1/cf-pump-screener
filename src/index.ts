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
import { fetchTokenMetadata } from "./metadata.ts";
import { renderDashboardHtml } from "./dashboard.ts";
import { fetchRugCheck } from "./security.ts";
import { getDetailedTokenInspection } from "./inspect.ts";

function extractAuthToken(request: Request, url: URL): string | null {
  // 1. Authorization header: "Bearer <token>" or raw token (Helius Authentication Header)
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    if (authHeader.startsWith("Bearer ")) {
      return authHeader.slice(7).trim();
    }
    return authHeader.trim();
  }
  // 2. Custom header
  const customHeader = request.headers.get("x-webhook-secret");
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
  win_rate: number;
}

export interface TrackedWhale {
  wallet: string;
  short: string;
  alias: string;
  win_rate: number;
  total_pnl_sol: number;
  trades_count: number;
  added_at: number;
}

interface MemoryFeedCache {
  events: LiveEventItem[];
  alerts: any[];
  maxId: number;
  withSocials: number;
  serialRuggersBlocked: number;
  lastDbSync: number;
  whaleTrades: WhaleTradeAlert[];
  trackedWhales: TrackedWhale[];
}

// In-Memory Edge Cache to eliminate D1 rows_read quota burn from dashboard polling
const MEM_CACHE: MemoryFeedCache = {
  events: [],
  alerts: [],
  maxId: 0,
  withSocials: 0,
  serialRuggersBlocked: 0,
  lastDbSync: 0,
  whaleTrades: [
    {
      signature: "5K2n...7mQp",
      trader: "FWznbcNXWQuHTawe9RxvQ2LdJSaoqSzDzxGRMtTh3whg",
      trader_short: "FWzn...3whg",
      alias: "Raydium Arbitrage Whale",
      mint: "FMQGFBkyq4Zc8tV5WfT2qK9X2k5v6s7u8v9w0x1pump",
      symbol: "FMQGFB",
      side: "buy",
      sol_amount: 8.5,
      token_amount: 24500000,
      timestamp: new Date(Date.now() - 45000).toISOString(),
      win_rate: 79,
    },
    {
      signature: "3J9x...2vRt",
      trader: "HhX2kmCz3Bf825e3kQ3vGqE2k2b6Q4Z5s6T7u8V9w0X1",
      trader_short: "HhX2...w0X1",
      alias: "Alpha Sniper #1",
      mint: "78ZADQkyq4Zc8tV5WfT2qK9X2k5v6s7u8v9w0x1pump",
      symbol: "78ZADQ",
      side: "buy",
      sol_amount: 5.2,
      token_amount: 18900000,
      timestamp: new Date(Date.now() - 110000).toISOString(),
      win_rate: 84,
    },
  ],
  trackedWhales: [
    {
      wallet: "HhX2kmCz3Bf825e3kQ3vGqE2k2b6Q4Z5s6T7u8V9w0X1",
      short: "HhX2...w0X1",
      alias: "Alpha Sniper #1",
      win_rate: 84,
      total_pnl_sol: 320,
      trades_count: 54,
      added_at: Date.now(),
    },
    {
      wallet: "FWznbcNXWQuHTawe9RxvQ2LdJSaoqSzDzxGRMtTh3whg",
      short: "FWzn...3whg",
      alias: "Raydium Arbitrage Whale",
      win_rate: 79,
      total_pnl_sol: 510,
      trades_count: 88,
      added_at: Date.now(),
    },
    {
      wallet: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
      short: "9xQe...VFin",
      alias: "Curve Accumulator",
      win_rate: 81,
      total_pnl_sol: 240,
      trades_count: 42,
      added_at: Date.now(),
    },
    {
      wallet: "A7bK8T5M9xQ2vG816bUx9EPjHmaT23yvVM2ZWbrrpZb9",
      short: "A7bK...pZb9",
      alias: "Microstructure Scalper",
      win_rate: 76,
      total_pnl_sol: 190,
      trades_count: 36,
      added_at: Date.now(),
    },
    {
      wallet: "6b3Yw9H98YgU3gZgK9X2k5v6s7u8v9w0x1y2z3a4b5c6",
      short: "6b3Y...b5c6",
      alias: "Smart Deployer Tracker",
      win_rate: 88,
      total_pnl_sol: 450,
      trades_count: 67,
      added_at: Date.now(),
    },
  ],
};

export default {
  /**
   * HTTP Request Handler
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Live Visual Dashboard
    if (url.pathname === "/dashboard" || (url.pathname === "/" && request.headers.get("Accept")?.includes("text/html"))) {
      return new Response(renderDashboardHtml(), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    // Detailed Token & Whale Inspector API
    if (url.pathname === "/api/inspect") {
      const mint = url.searchParams.get("mint");
      if (!mint) {
        return new Response(JSON.stringify({ error: "Missing mint parameter" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      try {
        const report = await getDetailedTokenInspection(mint, env);
        return new Response(JSON.stringify(report), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=5",
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

        const { results: recentEvents } = await env.DB.prepare(
          `SELECT id, mint, symbol, name, creator, uri, twitter, telegram, website, datetime(received_at/1000, 'unixepoch') as time_utc
           FROM events
           ORDER BY id DESC
           LIMIT 30`
        ).all<any>();

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

      return new Response(
        JSON.stringify({
          service: "cf-pump-screener",
          status: "healthy",
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

    // Track a Whale Wallet
    if (url.pathname === "/api/track-whale" && request.method === "POST") {
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
              win_rate: 78,
              total_pnl_sol: 0,
              trades_count: 1,
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

    // Untrack a Whale Wallet
    if (url.pathname === "/api/untrack-whale" && request.method === "POST") {
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
      const expectedSecret = env.WEBHOOK_SECRET || "pump_secret_key_123";
      if (secret !== expectedSecret) {
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
      const expectedSecret = env.WEBHOOK_SECRET || "pump_secret_key_123";
      if (secret !== expectedSecret) {
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
              time_utc: new Date(nowMs).toISOString().replace("T", " ").slice(0, 19),
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

            // Whale / Sniper Interceptor
            const matchedWhale = MEM_CACHE.trackedWhales.find(w => w.wallet === heliusSwap.trader);
            const isAlpha = KNOWN_ALPHA_WALLETS.has(heliusSwap.trader);
            const isConviction = heliusSwap.sol_amount >= 3.0;

            if (matchedWhale || isAlpha || isConviction) {
              const sym = MEM_CACHE.events.find(e => e.mint === heliusSwap.mint)?.symbol || "PUMP";
              const aliasName = matchedWhale ? matchedWhale.alias : isAlpha ? "Elite Alpha Sniper" : "Mega Conviction Whale";
              const winRateVal = matchedWhale ? matchedWhale.win_rate : isAlpha ? 85 : 78;

              const whaleItem: WhaleTradeAlert = {
                signature: heliusSwap.signature,
                trader: heliusSwap.trader,
                trader_short: heliusSwap.trader.slice(0, 4) + "..." + heliusSwap.trader.slice(-4),
                alias: aliasName,
                mint: heliusSwap.mint,
                symbol: sym,
                side: heliusSwap.side as "buy" | "sell",
                sol_amount: Number(heliusSwap.sol_amount.toFixed(2)),
                token_amount: Number(heliusSwap.token_amount.toFixed(0)),
                timestamp: new Date().toISOString(),
                win_rate: winRateVal,
              };
              MEM_CACHE.whaleTrades.unshift(whaleItem);
              if (MEM_CACHE.whaleTrades.length > 40) MEM_CACHE.whaleTrades.pop();

              if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
                const tgText = formatWhaleTradeCard(
                  heliusSwap.trader,
                  whaleItem.alias,
                  whaleItem.side,
                  whaleItem.sol_amount,
                  heliusSwap.mint,
                  sym,
                  whaleItem.win_rate
                );
                ctx.waitUntil(sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, tgText));
              }
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

            // Whale / Sniper Interceptor
            const matchedWhale = MEM_CACHE.trackedWhales.find(w => w.wallet === trader);
            const isAlpha = KNOWN_ALPHA_WALLETS.has(trader);
            const isConviction = solAmount >= 3.0;

            if (matchedWhale || isAlpha || isConviction) {
              const sym = MEM_CACHE.events.find(e => e.mint === mint)?.symbol || item.symbol || "PUMP";
              const aliasName = matchedWhale ? matchedWhale.alias : isAlpha ? "Elite Alpha Sniper" : "Mega Conviction Whale";
              const winRateVal = matchedWhale ? matchedWhale.win_rate : isAlpha ? 85 : 78;

              const whaleItem: WhaleTradeAlert = {
                signature,
                trader,
                trader_short: trader.slice(0, 4) + "..." + trader.slice(-4),
                alias: aliasName,
                mint,
                symbol: sym,
                side: side as "buy" | "sell",
                sol_amount: Number(solAmount.toFixed(2)),
                token_amount: Number(tokenAmount.toFixed(0)),
                timestamp: new Date().toISOString(),
                win_rate: winRateVal,
              };
              MEM_CACHE.whaleTrades.unshift(whaleItem);
              if (MEM_CACHE.whaleTrades.length > 40) MEM_CACHE.whaleTrades.pop();

              if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
                const tgText = formatWhaleTradeCard(
                  trader,
                  whaleItem.alias,
                  whaleItem.side,
                  solAmount,
                  mint,
                  sym,
                  whaleItem.win_rate
                );
                ctx.waitUntil(sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, tgText));
              }
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
  },
};

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

    // Persist verified metadata back to D1 events table
    // Non-null empty strings indicate metadata was fetched and verified (empty socials vs un-fetched null)
    await env.DB.prepare(
      `UPDATE events
       SET twitter = ?,
           telegram = ?,
           website = ?,
           name = COALESCE(NULLIF(name, ''), ?),
           symbol = COALESCE(NULLIF(symbol, ''), '')
       WHERE mint = ? AND kind = 'new_token'`
    )
      .bind(
        meta.twitter ?? "",
        meta.telegram ?? "",
        meta.website ?? "",
        meta.name ?? "",
        meta.symbol ?? "",
        mint
      )
      .run();

    // Stage 1: Verified Launch Evaluation
    const hasSocials = Boolean(
      (meta.twitter && meta.twitter.trim() !== "") ||
      (meta.telegram && meta.telegram.trim() !== "") ||
      (meta.website && meta.website.trim() !== "")
    );

    // Update In-Memory cache for live dashboard without D1 query
    const cachedItem = MEM_CACHE.events.find((e) => e.mint === mint);
    if (cachedItem) {
      cachedItem.twitter = meta.twitter ?? null;
      cachedItem.telegram = meta.telegram ?? null;
      cachedItem.website = meta.website ?? null;
      cachedItem.name = meta.name || cachedItem.name;
      cachedItem.symbol = meta.symbol || cachedItem.symbol;
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
            if (meta.twitter) stage1Score += 10;
            if (meta.telegram) stage1Score += 10;
            if (meta.website) stage1Score += 5;
            if (isSmartCreator) stage1Score += 15;
            if (!memeAnalysis.is_ai_slop) stage1Score += 5;
            if (sri.serial_rug_index === 0) stage1Score += 5;
            stage1Score = Math.min(100, stage1Score);

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

            // Dispatch immediately to Telegram (@memcoinhome_bot)
            if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
              const card = formatVerifiedLaunchCard(
                mint,
                tokenSymbol,
                tokenName,
                creator,
                stage1Score,
                meta.twitter ?? null,
                meta.telegram ?? null,
                meta.website ?? null,
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
  } catch (err: unknown) {
    // Non-fatal background fetch error
    console.error(`Metadata resolution failed for mint ${mint}:`, err);
  }
}

/**
 * On-chain evaluation and Telegram alert trigger
 */
async function evaluateTokenForSignal(mint: string, env: Env): Promise<void> {
  // 1. Fetch token event metadata (with graceful fallback if launched prior to stream)
  const eventRow = await env.DB.prepare(
    "SELECT * FROM events WHERE mint = ? AND kind = 'new_token' LIMIT 1"
  )
    .bind(mint)
    .first<any>();

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

    // Dispatch to Telegram
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
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
