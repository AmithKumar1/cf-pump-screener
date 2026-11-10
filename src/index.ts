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
  sendTelegramMessage,
} from "./telegram.ts";
import { runHealthCheck, monitorActiveWatchlist } from "./monitor.ts";
import { parseHeliusCreate, parseHeliusSwap } from "./parser.ts";
import { fetchTokenMetadata } from "./metadata.ts";

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
                isSmartCreator
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
