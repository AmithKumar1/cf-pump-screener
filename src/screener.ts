import type { LaunchMetadata, ScoreResult, TokenMetrics, TradePoint } from "./types.ts";

export const PUMP_TOTAL_SUPPLY = 1_000_000_000;
export const RAYDIUM_MIGRATION_SOL = 85.0;

/**
 * Calculate Herfindahl-Hirschman Index of buyer volumes.
 * Range: (0.0, 1.0]. Lower values indicate broad organic accumulation.
 */
export function computeBuyerHHI(buyerVolumes: Record<string, number>): number {
  const total = Object.values(buyerVolumes).reduce((sum, v) => sum + v, 0);
  if (total <= 0) return 1.0;
  return Object.values(buyerVolumes).reduce(
    (sum, v) => sum + Math.pow(v / total, 2),
    0
  );
}

/**
 * Calculate Top-K Concentration Ratio (CR_k):
 * The proportion of total buy volume accounted for by the top k buyers.
 */
export function computeTopKShare(
  buyerVolumes: Record<string, number>,
  k: number = 5
): number {
  const volumes = Object.values(buyerVolumes).sort((a, b) => b - a);
  const total = volumes.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return 1.0;
  const topKSum = volumes.slice(0, k).reduce((sum, v) => sum + v, 0);
  return topKSum / total;
}

/**
 * Compute quantitative flow, concentration, developer status, and velocity metrics.
 */
export function calculateTokenMetrics(
  trades: TradePoint[],
  creatorAddress: string,
  migrationTargetSol: number = RAYDIUM_MIGRATION_SOL
): TokenMetrics {
  if (trades.length === 0) {
    return {
      total_trades: 0,
      buy_count: 0,
      sell_count: 0,
      net_sol_raised: 0,
      gross_volume_sol: 0,
      unique_buyers: 0,
      unique_sellers: 0,
      buyer_hhi: 1.0,
      top_buyer_share: 0,
      top5_buyer_share: 0,
      dev_sold: false,
      dev_dump_pct: 0,
      dev_token_balance: 0,
      dev_supply_pct: 0,
      curve_progress_pct: 0,
      elapsed_seconds: 0,
      sol_velocity_per_min: 0,
      order_flow_imbalance: 0,
    };
  }

  let buyCount = 0;
  let sellCount = 0;
  let totalBuySol = 0;
  let totalSellSol = 0;
  const buyerVolumes: Record<string, number> = {};
  const sellerVolumes: Record<string, number> = {};

  let devBoughtTokens = 0;
  let devSoldTokens = 0;

  let minBlockTime = Infinity;
  let maxBlockTime = -Infinity;

  for (const t of trades) {
    const isDev = creatorAddress !== "unknown" && t.trader === creatorAddress;

    if (t.block_time && t.block_time > 0) {
      if (t.block_time < minBlockTime) minBlockTime = t.block_time;
      if (t.block_time > maxBlockTime) maxBlockTime = t.block_time;
    }

    if (t.side === "buy") {
      buyCount++;
      totalBuySol += t.sol_amount;
      buyerVolumes[t.trader] = (buyerVolumes[t.trader] || 0) + t.sol_amount;
      if (isDev) devBoughtTokens += t.token_amount;
    } else {
      sellCount++;
      totalSellSol += t.sol_amount;
      sellerVolumes[t.trader] = (sellerVolumes[t.trader] || 0) + t.sol_amount;
      if (isDev) devSoldTokens += t.token_amount;
    }
  }

  const netSol = Math.max(totalBuySol - totalSellSol, 0);
  const grossVolume = totalBuySol + totalSellSol;
  const hhi = computeBuyerHHI(buyerVolumes);
  const top1Share = computeTopKShare(buyerVolumes, 1);
  const top5Share = computeTopKShare(buyerVolumes, 5);

  // Microstructure Order Flow Imbalance: (Buy - Sell) / (Buy + Sell)
  const ofi = grossVolume > 0 ? (totalBuySol - totalSellSol) / grossVolume : 0;

  // Developer Holdings & Dump Detection (Zero-Tolerance: >= 10% sold)
  const devBalance = Math.max(devBoughtTokens - devSoldTokens, 0);
  const devDumpPct = devBoughtTokens > 0 ? devSoldTokens / devBoughtTokens : (devSoldTokens > 0 ? 1.0 : 0.0);
  const devSold = devBoughtTokens > 0 ? devSoldTokens >= devBoughtTokens * 0.10 : devSoldTokens > 0;
  const devSupplyPct = devBalance / PUMP_TOTAL_SUPPLY;

  // Curve progress toward Raydium 85 SOL target
  const progressPct = Math.min((netSol / migrationTargetSol) * 100, 100);

  // Time elapsed and capital velocity (SOL / minute)
  const elapsedSeconds =
    minBlockTime !== Infinity && maxBlockTime !== -Infinity && maxBlockTime >= minBlockTime
      ? Math.max(maxBlockTime - minBlockTime, 1)
      : 60;
  const elapsedMinutes = Math.max(elapsedSeconds / 60.0, 0.5);
  const solVelocity = netSol / elapsedMinutes;

  return {
    total_trades: trades.length,
    buy_count: buyCount,
    sell_count: sellCount,
    net_sol_raised: netSol,
    gross_volume_sol: grossVolume,
    unique_buyers: Object.keys(buyerVolumes).length,
    unique_sellers: Object.keys(sellerVolumes).length,
    buyer_hhi: hhi,
    top_buyer_share: top1Share,
    top5_buyer_share: top5Share,
    dev_sold: devSold,
    dev_dump_pct: devDumpPct,
    dev_token_balance: devBalance,
    dev_supply_pct: devSupplyPct,
    curve_progress_pct: progressPct,
    elapsed_seconds: elapsedSeconds,
    sol_velocity_per_min: solVelocity,
    order_flow_imbalance: ofi,
  };
}

/**
 * Compute multi-factor composite score (0 - 100) with strict institutional risk gates.
 */
export function scoreTokenCandidate(
  metadata: LaunchMetadata,
  metrics: TokenMetrics,
  highInterestThreshold: number = 75.0,
  creatorAddress: string = "unknown"
): ScoreResult {
  const flags: string[] = [];

  // ========================================================================
  // 1. Decentralization & Anti-Sybil Score (0 to 30 pts)
  // ========================================================================
  let decScore = 0;
  if (metrics.unique_buyers >= 35) {
    decScore += 15;
  } else if (metrics.unique_buyers >= 20) {
    decScore += 10;
  } else if (metrics.unique_buyers >= 12) {
    decScore += 5;
  }

  if (metrics.buyer_hhi < 0.12) {
    decScore += 15;
    flags.push("ORGANIC_DISTRIBUTION");
  } else if (metrics.buyer_hhi < 0.18) {
    decScore += 10;
  } else if (metrics.buyer_hhi > 0.28) {
    flags.push("WHALE_CONCENTRATION");
  }

  // Top-K Concentration penalties / bonuses
  if (metrics.top5_buyer_share <= 0.25 && metrics.unique_buyers >= 20) {
    decScore = Math.min(decScore + 5, 30);
  } else if (metrics.top5_buyer_share > 0.38 && metrics.total_trades > 10) {
    flags.push("CLUSTER_CONCENTRATION");
    decScore = Math.max(decScore - 10, 0);
  }

  if (metrics.top_buyer_share > 0.28) {
    decScore = Math.max(decScore - 8, 0);
  }

  // ========================================================================
  // 2. Capital Flow, Order Flow Imbalance & Velocity (0 to 35 pts)
  // ========================================================================
  let momScore = 0;
  if (metrics.net_sol_raised >= 25.0) {
    momScore += 20;
    flags.push("STRONG_CAPITAL_INFLOW");
  } else if (metrics.net_sol_raised >= 18.0) {
    momScore += 15;
    flags.push("SOLID_CAPITAL_INFLOW");
  } else if (metrics.net_sol_raised >= 15.0) {
    momScore += 10;
  }

  // Order Flow Imbalance (OFI)
  if (metrics.order_flow_imbalance >= 0.60) {
    momScore += 10;
    flags.push("BULLISH_FLOW_IMBALANCE");
  } else if (metrics.order_flow_imbalance >= 0.35) {
    momScore += 5;
  } else if (metrics.order_flow_imbalance < 0.15) {
    flags.push("SELL_PRESSURE");
  }

  // Curve Velocity (SOL / min)
  if (metrics.sol_velocity_per_min >= 1.5 && metrics.net_sol_raised >= 15.0) {
    momScore += 5;
    flags.push("HIGH_VELOCITY_SURGE");
  } else if (metrics.elapsed_seconds > 1500 && (metrics.net_sol_raised < 20.0 || metrics.sol_velocity_per_min < 0.40)) {
    // 25+ minutes elapsed without crossing 20 SOL -> stagnant dead curve
    flags.push("STAGNANT_MOMENTUM");
  }

  // ========================================================================
  // 3. Creator Trust & Supply Alignment (0 to 15 pts)
  // ========================================================================
  let creatorScore = 0;
  if (creatorAddress && creatorAddress !== "unknown") {
    // Check A: Dev dump (Zero-tolerance: >= 10% sold)
    if (metrics.dev_sold) {
      creatorScore = 0;
      flags.push("DEV_DUMPED_TOKENS");
    } else if (metrics.dev_supply_pct > 0.10) {
      // Check B: Dev holding hazard (> 10% of total supply)
      creatorScore = 0;
      flags.push("DEV_OVERHOLDING_HAZARD");
    } else {
      creatorScore = 15;
      flags.push("DEV_HOLDING");
    }
  } else {
    flags.push("DEV_UNKNOWN");
  }

  // ========================================================================
  // 4. Social Metadata & Narrative Presence (0 to 20 pts)
  // ========================================================================
  let metaScore = 0;
  if (metadata.metadata_available === false) {
    // Off-chain metadata was unavailable, timed out, or not yet fetched (neutral pending)
    flags.push("SOCIAL_METADATA_UNAVAILABLE");
    metaScore = 0;
  } else {
    // Metadata was successfully retrieved & parsed
    if (metadata.website) metaScore += 7;
    if (metadata.twitter) metaScore += 7;
    if (metadata.telegram) metaScore += 6;

    if (metaScore >= 14) {
      flags.push("COMMUNITY_LINKS");
    } else if (metaScore === 0) {
      // Strictly confirmed zero socials on valid metadata payload
      flags.push("NO_SOCIALS");
    }
  }

  // ========================================================================
  // 5. Penalties & Zero-Tolerance Disqualifications
  // ========================================================================
  let penalty = 0;
  if (flags.includes("DEV_DUMPED_TOKENS")) penalty += 40;
  if (flags.includes("DEV_OVERHOLDING_HAZARD")) penalty += 40;
  if (flags.includes("DEV_UNKNOWN")) penalty += 15;
  if (flags.includes("NO_SOCIALS")) penalty += 30; // Confirmed zero socials penalized
  if (flags.includes("WHALE_CONCENTRATION")) penalty += 15;
  if (flags.includes("CLUSTER_CONCENTRATION")) penalty += 15;
  if (flags.includes("STAGNANT_MOMENTUM")) penalty += 25;

  const total = Math.max(
    0,
    Math.min(100, decScore + momScore + creatorScore + metaScore - penalty)
  );

  // HARD DISQUALIFICATION GATES:
  // 1. Zero tolerance on anonymous coins
  // 2. Zero tolerance on dev dumps (>=10% sold)
  // 3. Zero tolerance on dev overholding (>10% total supply)
  // 4. Zero tolerance on dead/stagnant momentum (>25 mins crawl)
  // 5. Zero tolerance on sub-12 buyers (bot/wash-trading cluster)
  // 6. Zero tolerance on extreme whale dominance (HHI > 0.28 or top5 > 45%)
  const isDisqualified =
    flags.includes("NO_SOCIALS") ||
    flags.includes("DEV_DUMPED_TOKENS") ||
    flags.includes("DEV_OVERHOLDING_HAZARD") ||
    flags.includes("STAGNANT_MOMENTUM") ||
    metrics.unique_buyers < 12 ||
    metrics.buyer_hhi > 0.28 ||
    metrics.top5_buyer_share > 0.45;

  const isHigh = total >= highInterestThreshold && !isDisqualified;

  return {
    total_score: Math.round(total * 10) / 10,
    decentralization_score: decScore,
    momentum_score: momScore,
    creator_trust_score: creatorScore,
    metadata_score: metaScore,
    flags,
    is_high_interest: isHigh,
  };
}
