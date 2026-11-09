import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeBuyerHHI,
  computeTopKShare,
  calculateTokenMetrics,
  scoreTokenCandidate,
  PUMP_TOTAL_SUPPLY,
} from "../src/screener.ts";
import { formatResearchCard } from "../src/telegram.ts";
import type { TradePoint, LaunchMetadata } from "../src/types.ts";

describe("Quantitative Screener & Mathematical Models", () => {
  it("Theorem 1: computeBuyerHHI returns correct bounded values", () => {
    // Single monopoly buyer: HHI = 1.0
    assert.equal(computeBuyerHHI({ wallet1: 100 }), 1.0);

    // 10 equal buyers: HHI = 10 * (0.10)^2 = 0.10
    const equalBuyers: Record<string, number> = {};
    for (let i = 0; i < 10; i++) {
      equalBuyers[`wallet_${i}`] = 10;
    }
    const hhi10 = computeBuyerHHI(equalBuyers);
    assert.ok(Math.abs(hhi10 - 0.10) < 0.0001);

    // Empty map defaults safely to 1.0
    assert.equal(computeBuyerHHI({}), 1.0);
  });

  it("Theorem 2: computeTopKShare calculates accurate CR_k concentration", () => {
    const buyers = {
      w1: 50,
      w2: 20,
      w3: 10,
      w4: 10,
      w5: 5,
      w6: 5,
    };
    // Total = 100
    // Top 1 = 50 / 100 = 0.50
    assert.equal(computeTopKShare(buyers, 1), 0.50);
    // Top 5 = (50+20+10+10+5) / 100 = 0.95
    assert.equal(computeTopKShare(buyers, 5), 0.95);
  });

  it("Theorem 3: Dev Dump Zero-Tolerance detects sell >= 10%", () => {
    const dev = "DevWallet1111111111111111111111111111111";
    const trades: TradePoint[] = [
      { signature: "s1", mint: "M1", side: "buy", trader: dev, sol_amount: 1.0, token_amount: 10_000_000, block_time: 100 },
      { signature: "s2", mint: "M1", side: "sell", trader: dev, sol_amount: 0.15, token_amount: 1_200_000, block_time: 110 }, // 12% sold
    ];
    const metrics = calculateTokenMetrics(trades, dev);
    assert.equal(metrics.dev_sold, true);
    assert.ok(metrics.dev_dump_pct >= 0.12);
  });

  it("Theorem 4: Dev Overholding Hazard detects balance > 10% of 1B supply", () => {
    const dev = "DevWallet1111111111111111111111111111111";
    // Dev buys 120M tokens (12% of total supply)
    const trades: TradePoint[] = [
      { signature: "s1", mint: "M1", side: "buy", trader: dev, sol_amount: 5.0, token_amount: 120_000_000, block_time: 100 },
    ];
    for (let i = 0; i < 20; i++) {
      trades.push({
        signature: `s_${i}`,
        mint: "M1",
        side: "buy",
        trader: `buyer_${i}`,
        sol_amount: 1.0,
        token_amount: 1_000_000,
        block_time: 100 + i,
      });
    }
    const metrics = calculateTokenMetrics(trades, dev);
    assert.equal(metrics.dev_supply_pct, 0.12);

    const metadata: LaunchMetadata = {
      name: "Hazard Token",
      symbol: "HAZ",
      twitter: "https://x.com/haz",
      telegram: "https://t.me/haz",
      website: "https://haz.io",
    };
    const score = scoreTokenCandidate(metadata, metrics, 75, dev);
    assert.ok(score.flags.includes("DEV_OVERHOLDING_HAZARD"));
    assert.equal(score.is_high_interest, false);
  });

  it("Theorem 5: Velocity and Stagnant Curve decay", () => {
    const dev = "DevWallet1111111111111111111111111111111";
    // 30 minutes elapsed (1800s) with only 8 SOL raised -> stagnant dead curve
    const trades: TradePoint[] = [
      { signature: "s0", mint: "M1", side: "buy", trader: dev, sol_amount: 1.0, token_amount: 10_000_000, block_time: 1000 },
      { signature: "s1", mint: "M1", side: "buy", trader: "buyer1", sol_amount: 7.0, token_amount: 5_000_000, block_time: 2800 },
    ];
    const metrics = calculateTokenMetrics(trades, dev);
    assert.equal(metrics.elapsed_seconds, 1800);
    assert.ok(metrics.sol_velocity_per_min < 0.40);

    const metadata: LaunchMetadata = {
      name: "Stagnant",
      symbol: "STAG",
      twitter: "https://x.com/stag",
      telegram: "https://t.me/stag",
    };
    const score = scoreTokenCandidate(metadata, metrics, 75, dev);
    assert.ok(score.flags.includes("STAGNANT_MOMENTUM"));
    assert.equal(score.is_high_interest, false);
  });

  it("Theorem 6: Clean High-Conviction Token Passes All Gates", () => {
    const dev = "DevWallet1111111111111111111111111111111";
    const trades: TradePoint[] = [
      // Dev buys small 3% bag and holds
      { signature: "dev_b", mint: "M1", side: "buy", trader: dev, sol_amount: 1.0, token_amount: 30_000_000, block_time: 1000 },
    ];

    // 40 distinct organic buyers in 5 minutes (300 seconds), 22 SOL net raised
    for (let i = 0; i < 40; i++) {
      trades.push({
        signature: `tr_${i}`,
        mint: "M1",
        side: "buy",
        trader: `organic_buyer_${i}`,
        sol_amount: 0.55,
        token_amount: 1_200_000,
        block_time: 1000 + i * 7,
      });
    }

    const metrics = calculateTokenMetrics(trades, dev);
    assert.ok(metrics.net_sol_raised >= 22.0);
    assert.ok(metrics.unique_buyers >= 40);
    assert.ok(metrics.buyer_hhi < 0.12);
    assert.equal(metrics.dev_sold, false);
    assert.ok(metrics.dev_supply_pct <= 0.05);

    const metadata: LaunchMetadata = {
      name: "Alpha Gem",
      symbol: "ALPHA",
      twitter: "https://x.com/alpha",
      telegram: "https://t.me/alpha",
      website: "https://alpha.io",
    };

    const score = scoreTokenCandidate(metadata, metrics, 75, dev);
    assert.ok(score.flags.includes("ORGANIC_DISTRIBUTION"));
    assert.ok(score.flags.includes("COMMUNITY_LINKS"));
    assert.ok(score.flags.includes("DEV_HOLDING"));
    assert.ok(score.total_score >= 80);
    assert.equal(score.is_high_interest, true);

    // Verify Telegram card formats all quant metrics
    const card = formatResearchCard(
      "M1",
      "ALPHA",
      "Alpha Gem",
      dev,
      score.total_score,
      metrics.net_sol_raised,
      metrics.unique_buyers,
      metrics.buyer_hhi,
      ["INITIAL_SIGNAL", ...score.flags],
      metrics.dev_sold,
      metrics.curve_progress_pct,
      metrics.sol_velocity_per_min,
      metrics.top5_buyer_share,
      metrics.dev_supply_pct,
      metrics.order_flow_imbalance
    );

    assert.ok(card.includes("Inflow Velocity:"));
    assert.ok(card.includes("Top 5 Buyer Share:"));
    assert.ok(card.includes("HHI:"));
    assert.ok(card.includes("Holding (3.0% supply)"));
  });
});
