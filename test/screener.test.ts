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
  detectMEVSandwich,
  computeSerialRugIndex,
  computeSlotMetrics,
  analyzeMemeNarrative,
  checkSmartMoney,
  calculateTokenMetrics,
  scoreTokenCandidate,
  PUMP_TOTAL_SUPPLY,
  RAYDIUM_MIGRATION_SOL,
  KNOWN_ALPHA_WALLETS,
} from "../src/screener.ts";
import { formatResearchCard, formatVerifiedLaunchCard } from "../src/telegram.ts";
import { getDetailedTokenInspection } from "../src/inspect.ts";
import type { TradePoint, LaunchMetadata } from "../src/types.ts";

describe("Quantitative Screener, Predictive Models & Cutting-Edge Forensics", () => {
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

  it("Theorem 17: Jito MEV Sandwich Forensics detects frontrun-victim-backrun pattern", () => {
    const sandwichTrades: TradePoint[] = [
      { signature: "s1", mint: "M1", side: "buy", trader: "mev_bot", sol_amount: 4.0, token_amount: 4000, block_time: 100 },
      { signature: "s2", mint: "M1", side: "buy", trader: "victim_user", sol_amount: 1.0, token_amount: 800, block_time: 100 },
      { signature: "s3", mint: "M1", side: "sell", trader: "mev_bot", sol_amount: 4.1, token_amount: 4000, block_time: 101 },
      { signature: "s4", mint: "M1", side: "buy", trader: "user2", sol_amount: 0.5, token_amount: 500, block_time: 105 },
      { signature: "s5", mint: "M1", side: "buy", trader: "user3", sol_amount: 0.5, token_amount: 500, block_time: 108 },
      { signature: "s6", mint: "M1", side: "buy", trader: "user4", sol_amount: 0.5, token_amount: 500, block_time: 110 },
    ];
    const mev = detectMEVSandwich(sandwichTrades);
    assert.equal(mev.is_mev_sandwiched, true);
    assert.ok(mev.mev_extraction_ratio >= 0.70);
  });

  it("Theorem 18: Creator Serial Rug Index (SRI) detects serial scam deployers", () => {
    // 1. Fresh/clean creator (1 created, 0 graduated -> SRI = 0)
    const cleanDev = computeSerialRugIndex(1, 0);
    assert.equal(cleanDev.is_serial_rugger, false);

    // 2. Serial rugger (6 created, 0 graduated -> SRI = 1 - 1/7 = 0.86)
    const serialDev = computeSerialRugIndex(6, 0);
    assert.equal(serialDev.is_serial_rugger, true);
    assert.ok(serialDev.serial_rug_index >= 0.85);

    // 3. Proven dev (4 created, 3 graduated -> SRI = 1 - 4/5 = 0.20)
    const provenDev = computeSerialRugIndex(4, 3);
    assert.equal(provenDev.is_serial_rugger, false);
    assert.ok(provenDev.serial_rug_index <= 0.25);
  });

  it("Theorem 19: Solana Micro-Slot Forensics analyzes sub-second block bundles", () => {
    const bundledTrades: TradePoint[] = [
      { signature: "s1", mint: "M1", side: "buy", trader: "w1", sol_amount: 1.0, token_amount: 1000, slot: 250000000 },
      { signature: "s2", mint: "M1", side: "buy", trader: "w2", sol_amount: 1.0, token_amount: 1000, slot: 250000000 },
      { signature: "s3", mint: "M1", side: "buy", trader: "w3", sol_amount: 1.0, token_amount: 1000, slot: 250000000 },
      { signature: "s4", mint: "M1", side: "buy", trader: "w4", sol_amount: 1.0, token_amount: 1000, slot: 250000001 },
      { signature: "s5", mint: "M1", side: "buy", trader: "w5", sol_amount: 1.0, token_amount: 1000, slot: 250000005 },
    ];
    const slotMetrics = computeSlotMetrics(bundledTrades);
    assert.ok(slotMetrics.same_slot_bundle_ratio >= 0.40);
    assert.ok(slotMetrics.slot_velocity > 0);
  });

  it("Theorem 20: Memetic NLP differentiates corporate AI slop from organic meme culture", () => {
    // 1. Corporate AI slop
    const slop = analyzeMemeNarrative(
      "Visionary Ecosystem",
      "VSO",
      "An innovative ecosystem designed to revolutionize decentralized solutions and empower finance."
    );
    assert.equal(slop.is_ai_slop, true);
    assert.ok(slop.ai_slop_score >= 0.60);

    // 2. Organic cult meme
    const organic = analyzeMemeNarrative(
      "dog wif hat",
      "WIF",
      "literally just a dog with a hat on"
    );
    assert.equal(organic.is_ai_slop, false);
    assert.equal(organic.ai_slop_score, 0.0);
  });

  it("Theorem 21: Smart-Money & Elite Whale Tracker identifies alpha wallet conviction", () => {
    const customTracked = new Set(["custom_tracked_whale_1"]);
    const alphaTrades: TradePoint[] = [
      { signature: "t1", mint: "M1", side: "buy", trader: "custom_tracked_whale_1", sol_amount: 3.5, token_amount: 3500 },
      { signature: "t2", mint: "M1", side: "buy", trader: "anon_user", sol_amount: 0.5, token_amount: 500 },
    ];
    const sm = checkSmartMoney(alphaTrades, customTracked);
    assert.equal(sm.is_smart_money_in, true);
    assert.equal(sm.smart_money_buyers, 1);
    assert.equal(sm.smart_money_sol, 3.5);

    // Empty tracked list returns zero smart money
    const smEmpty = checkSmartMoney(alphaTrades, new Set());
    assert.equal(smEmpty.is_smart_money_in, false);
    assert.equal(smEmpty.smart_money_buyers, 0);
  });

  it("Theorem 11: Clean High-Conviction Token Passes All Institutional, Predictive & Forensic Gates", () => {
    const dev = "DevWallet1111111111111111111111111111111";
    const trades: TradePoint[] = [
      // Dev buys small bag (0.25% supply) and holds
      { signature: "dev_b", mint: "M1", side: "buy", trader: dev, sol_amount: 1.0, token_amount: 2_500_000, block_time: 1000, slot: 200000 },
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
        slot: 200000 + i * 15,
      });
    }

    const metadata: LaunchMetadata = {
      name: "Alpha Gem",
      symbol: "ALPHA",
      twitter: "https://x.com/alpha",
      telegram: "https://t.me/alpha",
      website: "https://alpha.io",
      description: "Organic community movement building the next solana cult",
    };

    const metrics = calculateTokenMetrics(trades, dev, RAYDIUM_MIGRATION_SOL, 1, 0, metadata);
    assert.ok(metrics.net_sol_raised >= 22.0);
    assert.ok(metrics.unique_buyers >= 40);
    assert.ok(metrics.buyer_hhi < 0.12);
    assert.equal(metrics.dev_sold, false);
    assert.ok(metrics.dev_supply_pct <= 0.05);
    assert.ok(metrics.shannon_entropy > 0.80);
    assert.ok(metrics.pareto_exponent >= 1.1 && metrics.pareto_exponent <= 3.2);
    assert.ok(metrics.graduation_probability >= 0.50);
    assert.equal(metrics.is_mev_sandwiched, false);
    assert.equal(metrics.serial_rug_index, 0.0);
    assert.equal(metrics.is_ai_slop, false);

    const score = scoreTokenCandidate(metadata, metrics, 75, dev);
    assert.ok(score.flags.includes("ORGANIC_DISTRIBUTION"));
    assert.ok(score.flags.includes("COMMUNITY_LINKS"));
    assert.ok(score.flags.includes("DEV_HOLDING"));
    assert.ok(score.flags.includes("HIGH_ENTROPY_DECENTRALIZED"));
    assert.ok(score.flags.includes("ORGANIC_POWER_LAW_DISTRIBUTION"));
    assert.ok(score.total_score >= 80);
    assert.equal(score.is_high_interest, true);

    // Verify Telegram card formats all quant, predictive and forensic metrics
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
      metrics.sybil_cluster_ratio,
      metrics.mev_extraction_ratio,
      metrics.serial_rug_index,
      metrics.smart_money_buyers,
      metrics.smart_money_sol,
      metrics.same_slot_bundle_ratio
    );

    assert.ok(card.includes("Inflow Velocity:"));
    assert.ok(card.includes("Top 5 Buyer Share:"));
    assert.ok(card.includes("HHI:"));
    assert.ok(card.includes("Microstructure: VPIN"));
    assert.ok(card.includes("Predictive & Forecasting Analytics:"));
    assert.ok(card.includes("Migration Probability:"));
    assert.ok(card.includes("Elite Quant & Forensic Intelligence:"));
    assert.ok(card.includes("MEV Forensics:"));
    assert.ok(card.includes("Creator DNA: Serial Rug Index:"));
    assert.ok(card.includes("Contract Security Audit (RugCheck):"));
    assert.ok(card.includes("1-Click Fast Sniper Execution:"));
    assert.ok(card.includes("Photon: https://photon-sol.tinyastro.io/en/lp/M1"));
    assert.ok(card.includes("BullX: https://bullx.io/terminal?chainId=1399811149&address=M1"));
    assert.ok(card.includes("GMGN: https://gmgn.ai/sol/token/M1"));
    assert.ok(card.includes("Solscan: https://solscan.io/token/M1"));
  });

  it("Stage 1 Pipeline: formatVerifiedLaunchCard correctly structures early creation intelligence", () => {
    const card = formatVerifiedLaunchCard(
      "5TXLJX6DdbfbuNLWG4LGwqgiQxaz6mPWv1KAH4oSpump",
      "ALICE",
      "Alice In Chains",
      "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
      85,
      "https://x.com/alice",
      "https://t.me/alice",
      "https://alice.fun",
      0.15,
      false,
      0.0,
      true,
      "SAFE",
      1,
      []
    );

    assert.ok(card.includes("STAGE 1 [VERIFIED CREATION]"));
    assert.ok(card.includes("https://x.com/alice"));
    assert.ok(card.includes("Organic Viral Culture"));
    assert.ok(card.includes("Tracked Alpha Wallet"));
    assert.ok(card.includes("RugCheck Security Audit: ✅ SAFE"));
    assert.ok(card.includes("Photon: https://photon-sol.tinyastro.io/en/lp/5TXLJX6DdbfbuNLWG4LGwqgiQxaz6mPWv1KAH4oSpump"));
    assert.ok(card.includes("BullX: https://bullx.io/terminal?chainId=1399811149&address=5TXLJX6DdbfbuNLWG4LGwqgiQxaz6mPWv1KAH4oSpump"));
    assert.ok(card.includes("GMGN: https://gmgn.ai/sol/token/5TXLJX6DdbfbuNLWG4LGwqgiQxaz6mPWv1KAH4oSpump"));
    assert.ok(card.includes("Solscan: https://solscan.io/token/5TXLJX6DdbfbuNLWG4LGwqgiQxaz6mPWv1KAH4oSpump"));
    assert.ok(card.includes("https://solscan.io/account/9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"));
  });

  it("Deep Inspector: getDetailedTokenInspection compiles comprehensive institutional report", async () => {
    const mockEnv = {
      DB: {
        prepare: (query: string) => ({
          bind: (..._args: any[]) => ({
            first: async () => {
              if (query.includes("FROM events")) {
                return {
                  id: 1,
                  mint: "MINT123",
                  symbol: "ALPHA",
                  name: "Alpha Coin",
                  creator: "CREATOR123",
                  bonding_curve: "CURVE123",
                  uri: "https://meta.example.com",
                  twitter: "https://x.com/alpha",
                  created_at: "2026-11-10 05:00:00",
                };
              }
              if (query.includes("COUNT(DISTINCT trader)")) {
                return {
                  unique_investors: 12,
                  gross_buy_sol: 15.5,
                  gross_sell_sol: 1.2,
                  net_sol: 14.3,
                  total_trades: 18,
                };
              }
              return null;
            },
            all: async () => {
              if (query.includes("GROUP BY trader")) {
                return {
                  results: [
                    { trader: "CREATOR123", buy_sol: 2.5, sell_sol: 0, net_sol: 2.5, net_tokens: 20000000, trades_count: 1 },
                    { trader: "WHALE456", buy_sol: 5.0, sell_sol: 0, net_sol: 5.0, net_tokens: 40000000, trades_count: 2 },
                  ],
                };
              }
              return { results: [] };
            },
          }),
        }),
      } as any,
    };

    const report = await getDetailedTokenInspection("MINT123", mockEnv);
    assert.strictEqual(report.mint, "MINT123");
    assert.strictEqual(report.symbol, "ALPHA");
    assert.strictEqual(report.creator, "CREATOR123");
    assert.strictEqual(report.net_sol_deployed, 14.3);
    assert.strictEqual(report.unique_investors, 12);
    assert.strictEqual(report.investors.length, 2);
    assert.strictEqual(report.investors[0].tag, "👨‍💻 Dev Deployer");
    assert.ok(report.sniper_links.photon.includes("MINT123"));
    assert.ok(report.sniper_links.bullx.includes("MINT123"));
    assert.ok(report.sniper_links.gmgn.includes("MINT123"));
    assert.ok(report.sniper_links.solscan_token.includes("MINT123"));
    assert.ok(report.sybil_intelligence);
    assert.ok(report.sybil_intelligence.bubble_graph.nodes.length >= 1);
    assert.ok(report.jito_execution);
    assert.ok(report.jito_execution.recommended_tip_sol > 0);
  });

  it("Theorem 22: Deterministic Pump.fun Bonding Curve Pricing Formula", () => {
    // S_0 = 30 SOL virtual, k = 32.19B
    // Price = (30 + S_curve)^2 / 32.19B
    // Total MCap = 1B * Price * SOL_USD
    const solUsd = 184.20;

    // 0 SOL (Launch)
    const p0 = (30 * 30) / 32_190_000_000;
    const mcap0 = 1_000_000_000 * p0 * solUsd;
    assert.ok(Math.abs(mcap0 - 5150.98) < 1.0, `Expected ~5151 USD at launch, got ${mcap0}`);

    // 85 SOL (Graduation threshold)
    const p85 = (115 * 115) / 32_190_000_000;
    const mcap85 = 1_000_000_000 * p85 * solUsd;
    assert.ok(Math.abs(mcap85 - 75677.23) < 1.0, `Expected ~75677 USD at graduation, got ${mcap85}`);
  });

  it("Deep Inspector: verifies MCap source differentiation (Bonding Curve vs PumpSwap/DEX Pool)", async () => {
    const mockEnvCurve = {
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => ({
              received_at: 1700000000000,
              mint: "CURVE_MINT",
              creator: "DEV_ADDR",
              name: "Curve Token",
              symbol: "CURV",
              net_sol: 25.0,
              gross_buy_sol: 25.0,
              gross_sell_sol: 0.0,
              unique_traders: 15,
              total_trades: 20,
            }),
            all: async () => ({ results: [] }),
          }),
        }),
      } as any,
    };

    const curveReport = await getDetailedTokenInspection("CURVE_MINT", mockEnvCurve);
    assert.strictEqual(curveReport.mcap_source, "BONDING_CURVE");
    assert.ok(curveReport.estimated_mcap_usd > 5000 && curveReport.estimated_mcap_usd < 75000);
    assert.ok(curveReport.sol_price_usd > 0);
    assert.ok(Array.isArray(curveReport.timeline_points));
  });
});
