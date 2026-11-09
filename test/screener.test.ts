import test from "node:test";
import assert from "node:assert";
import { computeBuyerHHI, calculateTokenMetrics, scoreTokenCandidate } from "../src/screener.ts";
import type { TradePoint } from "../src/types.ts";

test("computeBuyerHHI computes correct concentration index", () => {
  // Empty
  assert.strictEqual(computeBuyerHHI({}), 1.0);

  // Single buyer (monopoly)
  assert.strictEqual(computeBuyerHHI({ w1: 10 }), 1.0);

  // 2 equal buyers
  assert.strictEqual(Math.round(computeBuyerHHI({ w1: 5, w2: 5 }) * 100) / 100, 0.5);

  // 10 equal buyers
  const tenBuyers: Record<string, number> = {};
  for (let i = 0; i < 10; i++) tenBuyers[`w${i}`] = 1;
  assert.strictEqual(Math.round(computeBuyerHHI(tenBuyers) * 100) / 100, 0.1);
});

test("calculateTokenMetrics calculates flows and dev dump status", () => {
  const dev = "DevWallet123";
  const trades: TradePoint[] = [
    { signature: "s1", mint: "m1", side: "buy", trader: dev, sol_amount: 1.0, token_amount: 100_000_000 },
    { signature: "s2", mint: "m1", side: "buy", trader: "traderA", sol_amount: 2.0, token_amount: 150_000_000 },
    { signature: "s3", mint: "m1", side: "buy", trader: "traderB", sol_amount: 2.0, token_amount: 150_000_000 },
    { signature: "s4", mint: "m1", side: "sell", trader: dev, sol_amount: 0.9, token_amount: 90_000_000 },
  ];

  const metrics = calculateTokenMetrics(trades, dev);
  assert.strictEqual(metrics.total_trades, 4);
  assert.strictEqual(metrics.buy_count, 3);
  assert.strictEqual(metrics.sell_count, 1);
  assert.strictEqual(Math.round(metrics.net_sol_raised * 10) / 10, 4.1);
  assert.strictEqual(metrics.dev_sold, true);
  assert.strictEqual(metrics.unique_buyers, 3);
});

test("scoreTokenCandidate rewards organic distribution and penalizes dev dump", () => {
  const meta = {
    name: "Titcoin",
    symbol: "TIT",
    twitter: "https://x.com/titcoin",
    website: "https://titcoin.io",
  };

  // Organic healthy metrics
  const organicMetrics = {
    total_trades: 50,
    buy_count: 40,
    sell_count: 10,
    net_sol_raised: 25.0,
    gross_volume_sol: 30.0,
    unique_buyers: 25,
    unique_sellers: 5,
    buyer_hhi: 0.05,
    top_buyer_share: 0.05,
    dev_sold: false,
    dev_token_balance: 50_000_000,
    curve_progress_pct: 29.4,
  };

  const scoreResult = scoreTokenCandidate(meta, organicMetrics, 65);
  assert.strictEqual(scoreResult.is_high_interest, true);
  assert.ok(scoreResult.total_score >= 70);
  assert.ok(scoreResult.flags.includes("ORGANIC_DISTRIBUTION"));
  assert.ok(scoreResult.flags.includes("DEV_HOLDING"));
});
