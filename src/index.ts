import type { Env, LaunchMetadata, TradePoint } from "./types.ts";
import { calculateTokenMetrics, scoreTokenCandidate } from "./screener.ts";
import { formatResearchCard, sendTelegramMessage } from "./telegram.ts";
import { runHealthCheck } from "./monitor.ts";

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

export default {
  /**
   * HTTP Request Handler
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Root status route
    if (url.pathname === "/" || url.pathname === "/health") {
      const eventCount = await env.DB.prepare("SELECT COUNT(*) as count FROM events").first<{ count: number }>();
      const tradeCount = await env.DB.prepare("SELECT COUNT(*) as count FROM trades").first<{ count: number }>();
      const alertCount = await env.DB.prepare("SELECT COUNT(*) as count FROM alerts").first<{ count: number }>();

      return new Response(
        JSON.stringify({
          service: "cf-pump-screener",
          status: "healthy",
          edge: "cloudflare-free-tier",
          stats: {
            launches_logged: eventCount?.count || 0,
            trades_logged: tradeCount?.count || 0,
            signals_generated: alertCount?.count || 0,
          },
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

        for (const item of events) {
          // A. Standard PumpPortal / Direct Format: New Token
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
              ).bind(nowMs, mint, creator, bondingCurve, name, symbol, uri, twitter, telegram, website, JSON.stringify(item))
            );
            continue;
          }

          // B. Standard PumpPortal / Direct Format: Trade
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

            mintsToEvaluate.add(mint);
            continue;
          }

          // C. Helius Enhanced Transaction Format
          if (item.events && item.events.swap) {
            const swap = item.events.swap;
            const signature = item.signature;
            const blockTime = item.timestamp || Math.floor(nowMs / 1000);
            const trader = item.feePayer || "unknown";

            let side: "buy" | "sell" = "buy";
            let mint = "";
            let solAmount = 0;
            let tokenAmount = 0;

            if (swap.nativeInput) {
              side = "buy";
              solAmount = Number(swap.nativeInput.amount || 0) / 1e9;
              if (swap.tokenOutputs && swap.tokenOutputs[0]) {
                mint = swap.tokenOutputs[0].mint;
                tokenAmount = Number(swap.tokenOutputs[0].rawTokenAmount?.tokenAmount || 0) / 1e6;
              }
            } else if (swap.nativeOutput) {
              side = "sell";
              solAmount = Number(swap.nativeOutput.amount || 0) / 1e9;
              if (swap.tokenInputs && swap.tokenInputs[0]) {
                mint = swap.tokenInputs[0].mint;
                tokenAmount = Number(swap.tokenInputs[0].rawTokenAmount?.tokenAmount || 0) / 1e6;
              }
            }

            if (mint && solAmount > 0) {
              dbStatements.push(
                env.DB.prepare(
                  `INSERT OR IGNORE INTO trades (signature, mint, side, trader, sol_amount, token_amount, block_time)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`
                ).bind(signature, mint, side, trader, solAmount, tokenAmount, blockTime)
              );
              mintsToEvaluate.add(mint);
            }
          }
        }

        // Execute all database insertions in a single batch
        if (dbStatements.length > 0) {
          await env.DB.batch(dbStatements);
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
  },
};

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
  if (trades.length < 5) return; // Wait for at least 5 trades to establish organic distribution

  const creator = eventRow ? eventRow.creator : "unknown";
  const metadata: LaunchMetadata = eventRow
    ? {
        name: eventRow.name,
        symbol: eventRow.symbol,
        twitter: eventRow.twitter,
        telegram: eventRow.telegram,
        website: eventRow.website,
      }
    : {
        name: "Pump Token",
        symbol: mint.slice(0, 6).toUpperCase(),
      };

  // 3. Calculate metrics & score
  const metrics = calculateTokenMetrics(trades, creator);
  const minScore = Number(env.MIN_ALERT_SCORE || 65);
  const score = scoreTokenCandidate(metadata, metrics, minScore);

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
        metrics.curve_progress_pct
      );
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, cardText);
    }
  }
}
