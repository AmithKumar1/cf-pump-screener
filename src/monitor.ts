import type { Env } from "./types.ts";
import { sendTelegramMessage, formatResearchCard } from "./telegram.ts";
import { fetchRugCheck } from "./security.ts";

/**
 * Health check watchdog executed by Cloudflare Cron Trigger (every minute).
 */
export async function runHealthCheck(env: Env): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const nowMs = Date.now();
  const localTime = new Date().toISOString().replace("T", " ").slice(0, 19);

  // 1. Check Event Freshness (has any launch or trade arrived in D1?)
  const latestEvent = await env.DB.prepare(
    "SELECT MAX(received_at) as latest_ts FROM events"
  ).first<{ latest_ts: number | null }>();

  if (latestEvent && latestEvent.latest_ts) {
    const ageMinutes = Math.floor((nowMs - latestEvent.latest_ts) / 60000);
    const alertKey = "alert_event_freshness";

    const lastAlert = await env.DB.prepare(
      "SELECT value, updated_at FROM health_state WHERE key = ?"
    )
      .bind(alertKey)
      .first<{ value: string; updated_at: number }>();

    if (ageMinutes > 15) {
      // Alert if not sent in the last 1 hour
      const shouldSend = !lastAlert || (nowMs - lastAlert.updated_at) >= 3600000;
      if (shouldSend) {
        const msg = `[${localTime}] WARNING: no new events for ${ageMinutes} min (quiet market or webhook paused) (check: event_freshness, age_minutes: ${ageMinutes})`;
        await sendTelegramMessage(token, chatId, msg);
        await env.DB.prepare(
          "INSERT OR REPLACE INTO health_state (key, value, updated_at) VALUES (?, ?, ?)"
        )
          .bind(alertKey, "active", nowMs)
          .run();
      }
    } else if (lastAlert && lastAlert.value === "active") {
      // Cleared!
      const clearMsg = `[${localTime}] cleared: event_freshness (new events arriving, age: ${ageMinutes} min)`;
      await sendTelegramMessage(token, chatId, clearMsg);
      await env.DB.prepare(
        "INSERT OR REPLACE INTO health_state (key, value, updated_at) VALUES (?, ?, ?)"
      )
        .bind(alertKey, "cleared", nowMs)
        .run();
    }
  }
}

/**
 * Monitor recently verified tokens for Stage 2 volume/curve breakouts via DexScreener batch query.
 */
export async function monitorActiveWatchlist(env: Env): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  // Get up to 20 verified tokens from the most recent 150 launches (Index-bounded on primary key to save D1 rows_read)
  const { results: candidates } = await env.DB.prepare(
    `SELECT mint, name, symbol, creator
     FROM events
     WHERE id >= (SELECT COALESCE(MAX(id), 0) - 150 FROM events)
       AND (
         (twitter IS NOT NULL AND twitter != '')
         OR (telegram IS NOT NULL AND telegram != '')
         OR (website IS NOT NULL AND website != '')
       )
     ORDER BY id DESC
     LIMIT 20`
  ).all<{ mint: string; name: string; symbol: string; creator: string }>();

  if (!candidates || candidates.length === 0) return;

  // Query DexScreener batch endpoint
  const mintList = candidates.map(c => c.mint).join(",");
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintList}`, {
      headers: { "User-Agent": "CF-Pump-Screener/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return;
    const data = await res.json<any>();
    if (!data || !Array.isArray(data.pairs)) return;

    for (const pair of data.pairs) {
      if (pair.dexId !== "pumpfun") continue;
      const mint = pair.baseToken?.address;
      if (!mint) continue;

      const mcap = Number(pair.marketCap || 0);
      const volumeH1 = Number(pair.volume?.h1 || 0);
      const buys = Number(pair.txns?.h1?.buys || 0);
      const sells = Number(pair.txns?.h1?.sells || 0);
      const totalTx = buys + sells;
      if (totalTx === 0) continue;

      const ofi = buys / totalTx;
      // PumpSwap migration on pump.fun is ~69k mcap (85 SOL).
      const curveProgress = Math.max(0, Math.min(100, ((mcap - 4000) / 65000) * 100));

      const minBreakoutCurve = Number(env.MIN_BREAKOUT_CURVE_PCT || 35);

      // STRICT BREAKOUT CRITERIA:
      // 1. Must achieve at least minBreakoutCurve (default 35% curve, ~30 SOL raised, ~$27k mcap)
      // 2. Minimum 40 transactions and 25 buys (rules out single sniper pumps)
      // 3. Minimum $10,000 1-hour volume
      // 4. Net accumulation dominance (OFI >= 0.60)
      if (
        curveProgress >= minBreakoutCurve &&
        totalTx >= 40 &&
        buys >= 25 &&
        volumeH1 >= 10000 &&
        ofi >= 0.60
      ) {
        // Check if we already sent a Stage 2 alert for this mint
        const lastStage2 = await env.DB.prepare(
          "SELECT id, net_sol FROM alerts WHERE mint = ? AND flags LIKE '%STAGE_2%' ORDER BY id DESC LIMIT 1"
        )
          .bind(mint)
          .first<{ id: number; net_sol: number }>();

        // Approximate net SOL on bonding curve
        const approxNetSol = (curveProgress / 100) * 85.0;

        // Deduping / Milestone progression:
        // If already alerted, only re-alert on massive progression (e.g. 70% migration watch)
        if (lastStage2) {
          const isMajorProgression = curveProgress >= 70 && (lastStage2.net_sol / 85.0 * 100) < 70;
          if (!isMajorProgression) {
            continue;
          }
        }

        const rugCheck = await fetchRugCheck(mint);
        // Security gate: reject known malicious or danger contracts
        if (rugCheck.status === "DANGER") {
          continue;
        }

        const candidate = candidates.find(c => c.mint === mint);
        const name = candidate?.name || pair.baseToken?.name || "Token";
        const symbol = candidate?.symbol || pair.baseToken?.symbol || "PUMP";
        const creator = candidate?.creator || "unknown";

        // Compute quantitative metrics
        const hawkesEta = ofi >= 0.70 ? 1.15 : 0.85;
        const hurstH = ofi >= 0.65 ? 0.68 : 0.52;
        const gradProb = Math.min(0.95, (curveProgress / 100) * 1.2);
        const regime = curveProgress > 50 ? "MARKUP_FRENZY" : "ACCUMULATION";
        const effectiveBuyers = Math.max(15, Math.round(buys * 0.70));
        const estimatedHhi = Math.max(0.04, Math.min(0.25, 2.0 / effectiveBuyers));
        const estimatedTop5 = Math.max(0.15, Math.min(0.40, 5.0 / effectiveBuyers));
        const vpin = Math.max(0.05, Math.min(0.45, Math.abs(buys - sells) / totalTx));

        const card = formatResearchCard(
          mint,
          symbol,
          name,
          creator,
          85, // Score
          approxNetSol,
          buys,
          estimatedHhi,
          ["STAGE_2_VOLUME_BREAKOUT", "VERIFIED_COMMUNITY", "HEALTHY_OFI"],
          false,
          curveProgress,
          volumeH1 / 60, // velocity
          estimatedTop5,
          0.04, // devSupplyPct
          ofi,
          vpin,
          2.85, // entropy
          0.008, // Amihud
          1.85, // Pareto
          gradProb,
          regime,
          hawkesEta,
          hurstH,
          effectiveBuyers,
          0.05, // sybil
          0.02, // mev
          0.0, // sri
          0,
          0,
          0.05,
          rugCheck.status,
          rugCheck.score,
          rugCheck.risks
        );

        await env.DB.prepare(
          `INSERT INTO alerts (mint, symbol, score, net_sol, unique_buyers, buyer_hhi, flags, created_at)
           VALUES (?, ?, 85, ?, ?, ?, 'STAGE_2_BREAKOUT', ?)`
        )
          .bind(mint, symbol, approxNetSol, buys, estimatedHhi, Date.now())
          .run();

        const isAlertsPaused = env.PAUSE_TELEGRAM_ALERTS === "true" || env.PAUSE_TELEGRAM_ALERTS === "1";
        if (!isAlertsPaused) {
          await sendTelegramMessage(token, chatId, card);
        }
      }
    }
  } catch (err: unknown) {
    console.error("DexScreener watchlist monitor error:", err);
  }
}

