import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeBuyerHHI,
  computeTopKShare,
  computeVPIN,
  computeAmihudIlliquidity,
  computeShannonEntropy,
  computeKyleLambda,
  computeParetoExponent,
  computeHawkesProcess,
  computeGraduationProbability,
  computeHurstExponent,
  detectMarketRegime,
  computeSybilClusterMetrics,
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
        block_time: 100 + i * 15,
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

  it("Theorem 6: Volume-Synchronized Probability of Toxicity (VPIN)", () => {
    // 1. Balanced order flow: buys and sells alternate evenly -> VPIN near 0
    const balancedTrades: TradePoint[] = [
      { signature: "b1", mint: "M1", side: "buy", trader: "t1", sol_amount: 1.0, token_amount: 1000 },
      { signature: "s1", mint: "M1", side: "sell", trader: "t2", sol_amount: 1.0, token_amount: 1000 },
      { signature: "b2", mint: "M1", side: "buy", trader: "t3", sol_amount: 1.0, token_amount: 1000 },
      { signature: "s2", mint: "M1", side: "sell", trader: "t4", sol_amount: 1.0, token_amount: 1000 },
    ];
    const vpinBalanced = computeVPIN(balancedTrades, 2);
    assert.equal(vpinBalanced, 0.0);

    // 2. Severe one-sided toxic flow -> VPIN near 1.0
    const oneSidedTrades: TradePoint[] = [
      { signature: "s1", mint: "M1", side: "sell", trader: "t1", sol_amount: 2.0, token_amount: 2000 },
      { signature: "s2", mint: "M1", side: "sell", trader: "t2", sol_amount: 2.0, token_amount: 2000 },
      { signature: "s3", mint: "M1", side: "sell", trader: "t3", sol_amount: 2.0, token_amount: 2000 },
      { signature: "s4", mint: "M1", side: "sell", trader: "t4", sol_amount: 2.0, token_amount: 2000 },
    ];
    const vpinToxic = computeVPIN(oneSidedTrades, 4);
    assert.ok(vpinToxic >= 0.95);
  });

  it("Theorem 7: Amihud Illiquidity Ratio (ILIQ)", () => {
    // Liquid curve: gradual price changes
    const liquidTrades: TradePoint[] = [
      { signature: "t1", mint: "M1", side: "buy", trader: "w1", sol_amount: 1.0, token_amount: 1_000_000 },
      { signature: "t2", mint: "M1", side: "buy", trader: "w2", sol_amount: 1.0, token_amount: 980_000 },
      { signature: "t3", mint: "M1", side: "buy", trader: "w3", sol_amount: 1.0, token_amount: 960_000 },
    ];
    const iliqLiquid = computeAmihudIlliquidity(liquidTrades);
    assert.ok(iliqLiquid < 0.10);

    // Hollow curve: massive slippage per unit SOL
    const hollowTrades: TradePoint[] = [
      { signature: "t1", mint: "M1", side: "buy", trader: "w1", sol_amount: 0.1, token_amount: 1_000_000 },
      { signature: "t2", mint: "M1", side: "buy", trader: "w2", sol_amount: 0.1, token_amount: 200_000 },
      { signature: "t3", mint: "M1", side: "buy", trader: "w3", sol_amount: 0.1, token_amount: 40_000 },
    ];
    const iliqHollow = computeAmihudIlliquidity(hollowTrades);
    assert.ok(iliqHollow > 5.0);
  });

  it("Theorem 8: Normalized Shannon Information Entropy of Capital Distribution", () => {
    // Uniform capital distribution across 10 buyers: Entropy = 1.0
    const uniformBuyers: Record<string, number> = {};
    for (let i = 0; i < 10; i++) {
      uniformBuyers[`w${i}`] = 5.0;
    }
    const entropyUniform = computeShannonEntropy(uniformBuyers);
    assert.ok(Math.abs(entropyUniform - 1.0) < 0.0001);

    // Monopolistic cabal: 1 buyer holds 99.999%
    const cabalBuyers = { whale: 99999.0, pawn: 0.001 };
    const entropyCabal = computeShannonEntropy(cabalBuyers);
    assert.ok(entropyCabal < 0.01);
  });

  it("Theorem 9: Kyle's Lambda Price Impact Coefficient", () => {
    const trades: TradePoint[] = [
      { signature: "t1", mint: "M1", side: "buy", trader: "w1", sol_amount: 0.5, token_amount: 1_000_000 },
      { signature: "t2", mint: "M1", side: "buy", trader: "w2", sol_amount: 1.5, token_amount: 1_200_000 },
      { signature: "t3", mint: "M1", side: "sell", trader: "w3", sol_amount: 0.8, token_amount: 700_000 },
      { signature: "t4", mint: "M1", side: "buy", trader: "w4", sol_amount: 2.0, token_amount: 1_400_000 },
    ];
    const lambda = computeKyleLambda(trades);
    assert.ok(lambda >= 0.0);
  });

  it("Theorem 10: Pareto Power-Law Exponent for Wash-Trade & Bot Detection", () => {
    // 1. Organic distribution: trade sizes follow natural power law
    const organicTrades: TradePoint[] = [];
    for (let i = 1; i <= 30; i++) {
      const u = i / 31;
      const sol = 0.1 * Math.pow(1 - u, -1 / 1.5);
      organicTrades.push({
        signature: `org_${i}`,
        mint: "M1",
        side: "buy",
        trader: `trader_${i}`,
        sol_amount: sol,
        token_amount: sol * 100_000,
      });
    }
    const paretoOrganic = computeParetoExponent(organicTrades);
    assert.equal(paretoOrganic.isOrganicPowerLaw, true);
    assert.equal(paretoOrganic.isWashTradeSuspicious, false);
    assert.ok(paretoOrganic.exponent >= 1.1 && paretoOrganic.exponent <= 3.2);

    // 2. Uniform bot cluster: all trades are identical 0.50 SOL
    const botTrades: TradePoint[] = [];
    for (let i = 1; i <= 30; i++) {
      botTrades.push({
        signature: `bot_${i}`,
        mint: "M1",
        side: "buy",
        trader: `bot_${i}`,
        sol_amount: 0.50,
        token_amount: 50_000,
      });
    }
    const paretoBot = computeParetoExponent(botTrades);
    assert.equal(paretoBot.isWashTradeSuspicious, true);
    assert.equal(paretoBot.isOrganicPowerLaw, false);
  });

  it("Theorem 12: Hawkes Self-Exciting Point Process detects supercritical viral cascade", () => {
    // 1. Supercritical rapid arrivals (1 second inter-arrival)
    const rapidTrades: TradePoint[] = [];
    for (let i = 0; i < 20; i++) {
      rapidTrades.push({
        signature: `rap_${i}`,
        mint: "M1",
        side: "buy",
        trader: `w_${i}`,
        sol_amount: 0.5,
        token_amount: 50_000,
        block_time: 1000 + i * 1,
      });
    }
    const hawkesRapid = computeHawkesProcess(rapidTrades, 0.08);
    assert.equal(hawkesRapid.is_supercritical, true);
    assert.ok(hawkesRapid.branching_ratio >= 1.0);

    // 2. Subcritical slow arrivals (45 seconds inter-arrival)
    const slowTrades: TradePoint[] = [];
    for (let i = 0; i < 20; i++) {
      slowTrades.push({
        signature: `slw_${i}`,
        mint: "M1",
        side: "buy",
        trader: `w_${i}`,
        sol_amount: 0.5,
        token_amount: 50_000,
        block_time: 1000 + i * 45,
      });
    }
    const hawkesSlow = computeHawkesProcess(slowTrades, 0.08);
    assert.equal(hawkesSlow.is_supercritical, false);
    assert.ok(hawkesSlow.branching_ratio < 0.20);
  });

  it("Theorem 13: Cox Proportional Hazards Model projects calibrated graduation odds", () => {
    // High-momentum surging coin (35 SOL raised, fast velocity, high entropy, zero dev dump)
    const highProb = computeGraduationProbability(
      35.0, // net SOL
      3.0,  // velocity SOL/min
      0.92, // entropy
      0.85, // OFI
      0.20, // VPIN toxicity
      0.05, // HHI
      false // dev sold
    );
    assert.ok(highProb >= 0.70);

    // Abandoned dead-end coin (2 SOL raised, 0 velocity, high HHI, dev dumped)
    const dumpedProb = computeGraduationProbability(
      2.0,
      0.05,
      0.20,
      0.10,
      0.80,
      0.60,
      true
    );
    assert.equal(dumpedProb, 0.0);
  });

  it("Theorem 14: Hurst Exponent distinguishes persistent trend from mean reversion", () => {
    // 1. Pure persistent upward trend (H > 0.60)
    let price = 10.0;
    const trendTrades: TradePoint[] = [];
    for (let i = 0; i < 30; i++) {
      price *= 1.02;
      trendTrades.push({
        signature: `tr_${i}`,
        mint: "M1",
        side: "buy",
        trader: `w_${i}`,
        sol_amount: price,
        token_amount: 1.0,
      });
    }
    const hurstTrend = computeHurstExponent(trendTrades, 4);
    assert.equal(hurstTrend.hurst_regime, "TRENDING");
    assert.ok(hurstTrend.hurst_exponent > 0.60);

    // 2. Oscillating mean-reverting chop (H < 0.40)
    const chopTrades: TradePoint[] = [];
    for (let i = 0; i < 30; i++) {
      const p = 10.0 * (i % 2 === 0 ? 1.06 : 0.94);
      chopTrades.push({
        signature: `ch_${i}`,
        mint: "M1",
        side: "buy",
        trader: `w_${i}`,
        sol_amount: p,
        token_amount: 1.0,
      });
    }
    const hurstChop = computeHurstExponent(chopTrades, 4);
    assert.equal(hurstChop.hurst_regime, "MEAN_REVERTING");
    assert.ok(hurstChop.hurst_exponent < 0.40);
  });

  it("Theorem 15: Market Microstructure Regime identifies Frenzy vs Distribution", () => {
    const dummyTrades: TradePoint[] = new Array(15).fill({
      signature: "x",
      mint: "M1",
      side: "buy",
      trader: "w",
      sol_amount: 1,
      token_amount: 1000,
    });

    // 1. Markup Frenzy (high velocity, high OFI, supercritical Hawkes)
    const frenzy = detectMarketRegime(dummyTrades, 0.25, 0.85, 2.5, 1.2);
    assert.equal(frenzy.market_regime, "MARKUP_FRENZY");
    assert.ok(frenzy.distribution_risk_pct < 40);

    // 2. Stealth Distribution Exit (high VPIN toxicity, low OFI)
    const distribution = detectMarketRegime(dummyTrades, 0.75, 0.20, 0.5, 0.3);
    assert.equal(distribution.market_regime, "DISTRIBUTION_EXIT");
    assert.ok(distribution.distribution_risk_pct >= 65);
  });

  it("Theorem 16: Sybil Graph & Co-Execution unmasks synchronized bot farms", () => {
    // 1. Synchronized bot burst (20 wallets buying in identical slot <= 1s)
    const botSwarm: TradePoint[] = [];
    for (let i = 0; i < 20; i++) {
      botSwarm.push({
        signature: `b_${i}`,
        mint: "M1",
        side: "buy",
        trader: `bot_wallet_${i}`,
        sol_amount: 0.5,
        token_amount: 1000,
        block_time: 1000 + (i % 2),
      });
    }
    const sybilBots = computeSybilClusterMetrics(botSwarm);
    assert.equal(sybilBots.is_cabal_sybil, true);
    assert.ok(sybilBots.sybil_cluster_ratio >= 0.80);
    assert.ok(sybilBots.effective_unique_buyers < 10);

    // 2. Natural organic human dispersion (buys spaced 15s apart)
    const organicBuyers: TradePoint[] = [];
    for (let i = 0; i < 20; i++) {
      organicBuyers.push({
        signature: `o_${i}`,
        mint: "M1",
        side: "buy",
        trader: `organic_wallet_${i}`,
        sol_amount: 0.5,
        token_amount: 1000,
        block_time: 1000 + i * 15,
      });
    }
    const sybilOrganic = computeSybilClusterMetrics(organicBuyers);
    assert.equal(sybilOrganic.is_cabal_sybil, false);
    assert.equal(sybilOrganic.sybil_cluster_ratio, 0.0);
    assert.equal(sybilOrganic.effective_unique_buyers, 20);
  });

  it("Theorem 11: Clean High-Conviction Token Passes All Institutional & Predictive Gates", () => {
    const dev = "DevWallet1111111111111111111111111111111";
    const trades: TradePoint[] = [
      // Dev buys small bag (0.25% supply) and holds
      { signature: "dev_b", mint: "M1", side: "buy", trader: dev, sol_amount: 1.0, token_amount: 2_500_000, block_time: 1000 },
    ];

    // 40 distinct organic buyers in 5 minutes (300 seconds), 37 SOL net raised
    for (let i = 0; i < 40; i++) {
      const sol = 0.2 + (i % 8) * 0.2;
      trades.push({
        signature: `tr_${i}`,
        mint: "M1",
        side: "buy",
        trader: `organic_buyer_${i}`,
        sol_amount: sol,
        token_amount: Math.floor(sol * 2_200_000),
        block_time: 1000 + i * 7,
      });
    }

    const metrics = calculateTokenMetrics(trades, dev);
    assert.ok(metrics.net_sol_raised >= 22.0);
    assert.ok(metrics.unique_buyers >= 40);
    assert.ok(metrics.buyer_hhi < 0.12);
    assert.equal(metrics.dev_sold, false);
    assert.ok(metrics.dev_supply_pct <= 0.05);
    assert.ok(metrics.shannon_entropy > 0.80);
    assert.ok(metrics.pareto_exponent >= 1.1 && metrics.pareto_exponent <= 3.2);
    assert.ok(metrics.graduation_probability >= 0.50);
    assert.equal(metrics.is_cabal_sybil ?? false, false);

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
    assert.ok(score.flags.includes("HIGH_ENTROPY_DECENTRALIZED"));
    assert.ok(score.flags.includes("ORGANIC_POWER_LAW_DISTRIBUTION"));
    assert.ok(score.total_score >= 80);
    assert.equal(score.is_high_interest, true);

    // Verify Telegram card formats all quant and predictive metrics
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
      metrics.sybil_cluster_ratio
    );

    assert.ok(card.includes("Inflow Velocity:"));
    assert.ok(card.includes("Top 5 Buyer Share:"));
    assert.ok(card.includes("HHI:"));
    assert.ok(card.includes("Microstructure: VPIN"));
    assert.ok(card.includes("Predictive & Forecasting Analytics:"));
    assert.ok(card.includes("Raydium Migration Probability:"));
    assert.ok(card.includes("Market Microstructure Regime:"));
    assert.ok(card.includes("Hawkes Cascade Intensity:"));
    assert.ok(card.includes("Hurst Trend Persistence:"));
  });
});
