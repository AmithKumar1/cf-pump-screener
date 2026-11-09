import type { LaunchMetadata, ScoreResult, TokenMetrics, TradePoint } from "./types.ts";

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
 * Compute quantitative flow, concentration, and developer status metrics.
 */
export function calculateTokenMetrics(
  trades: TradePoint[],
  creatorAddress: string,
  migrationTargetSol: number = 85.0
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
      dev_sold: false,
      dev_token_balance: 0,
      curve_progress_pct: 0,
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

  for (const t of trades) {
    const isDev = t.trader === creatorAddress;

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

  const topBuyerSol = Math.max(0, ...Object.values(buyerVolumes));
  const topShare = totalBuySol > 0 ? topBuyerSol / totalBuySol : 0;

  const devBalance = Math.max(devBoughtTokens - devSoldTokens, 0);
  const devSold = devBoughtTokens > 0 && devSoldTokens >= devBoughtTokens * 0.8;
  const progressPct = Math.min((netSol / migrationTargetSol) * 100, 100);

  return {
    total_trades: trades.length,
    buy_count: buyCount,
    sell_count: sellCount,
    net_sol_raised: netSol,
    gross_volume_sol: grossVolume,
    unique_buyers: Object.keys(buyerVolumes).length,
    unique_sellers: Object.keys(sellerVolumes).length,
    buyer_hhi: hhi,
    top_buyer_share: topShare,
    dev_sold: devSold,
    dev_token_balance: devBalance,
    curve_progress_pct: progressPct,
  };
}

/**
 * Compute 3-gate multi-factor composite score (0 - 100).
 */
export function scoreTokenCandidate(
  metadata: LaunchMetadata,
  metrics: TokenMetrics,
  highInterestThreshold: number = 65.0
): ScoreResult {
  const flags: string[] = [];

  // 1. Decentralization Score (0 to 30 pts)
  let decScore = 0;
  if (metrics.unique_buyers >= 20) decScore += 15;
  else if (metrics.unique_buyers >= 10) decScore += 10;
  else if (metrics.unique_buyers >= 5) decScore += 5;

  if (metrics.buyer_hhi < 0.12) {
    decScore += 15;
    flags.push("ORGANIC_DISTRIBUTION");
  } else if (metrics.buyer_hhi < 0.25) {
    decScore += 10;
  } else if (metrics.buyer_hhi > 0.5) {
    flags.push("WHALE_CONCENTRATION");
  }

  if (metrics.top_buyer_share > 0.35) {
    decScore = Math.max(decScore - 8, 0);
  }

  // 2. Momentum & Flow Score (0 to 30 pts)
  let momScore = 0;
  if (metrics.net_sol_raised >= 10.0) {
    momScore += 20;
    flags.push("STRONG_CAPITAL_INFLOW");
  } else if (metrics.net_sol_raised >= 5.0) {
    momScore += 15;
  } else if (metrics.net_sol_raised >= 2.0) {
    momScore += 10;
  } else if (metrics.net_sol_raised >= 0.5) {
    momScore += 5;
  }

  const totalTrades = metrics.buy_count + metrics.sell_count;
  if (totalTrades > 0) {
    const buyRatio = metrics.buy_count / totalTrades;
    if (buyRatio >= 0.75) momScore += 10;
    else if (buyRatio >= 0.55) momScore += 5;
    else if (buyRatio < 0.35) flags.push("SELL_PRESSURE");
  }

  // 3. Creator Trust Score (0 to 20 pts)
  let creatorScore = 15;
  if (metrics.dev_sold) {
    creatorScore = 0;
    flags.push("DEV_DUMPED_TOKENS");
  } else {
    flags.push("DEV_HOLDING");
  }

  // 4. Social Metadata Score (0 to 20 pts)
  let metaScore = 0;
  if (metadata.website) metaScore += 7;
  if (metadata.twitter) metaScore += 7;
  if (metadata.telegram) metaScore += 6;

  if (metaScore >= 14) flags.push("COMMUNITY_LINKS");
  else if (metaScore === 0) flags.push("NO_SOCIALS");

  // Penalties
  let penalty = 0;
  if (flags.includes("DEV_DUMPED_TOKENS")) penalty += 35;
  if (flags.includes("WHALE_CONCENTRATION") && metrics.total_trades > 10) penalty += 15;

  const total = Math.max(0, Math.min(100, decScore + momScore + creatorScore + metaScore - penalty));
  const isHigh = total >= highInterestThreshold && !flags.includes("DEV_DUMPED_TOKENS");

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
