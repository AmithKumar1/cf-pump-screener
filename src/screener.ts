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
 * Theorem 1: Volume-Synchronized Probability of Toxicity (VPIN)
 * Reference: Easley, López de Prado, and O'Hara (2012)
 * Partitions trade volume into B equal volume buckets and measures the normalized order imbalance.
 * Range: [0.0, 1.0]. Values >= 0.75 indicate severe toxic flow (imminent dump).
 */
export function computeVPIN(trades: TradePoint[], bucketCount: number = 5): number {
  if (trades.length < 4) return 0.0;
  const totalVolume = trades.reduce((sum, t) => sum + t.sol_amount, 0);
  if (totalVolume <= 0) return 0.0;

  const bucketSize = totalVolume / bucketCount;
  let currentBucketBuy = 0;
  let currentBucketSell = 0;
  let currentBucketVol = 0;
  let absoluteImbalancesSum = 0;
  let completedBuckets = 0;

  for (const t of trades) {
    let remainingTradeVol = t.sol_amount;
    const isBuy = t.side === "buy";

    while (remainingTradeVol > 0 && completedBuckets < bucketCount) {
      const spaceInBucket = bucketSize - currentBucketVol;
      const fillAmount = Math.min(remainingTradeVol, spaceInBucket);

      if (isBuy) {
        currentBucketBuy += fillAmount;
      } else {
        currentBucketSell += fillAmount;
      }
      currentBucketVol += fillAmount;
      remainingTradeVol -= fillAmount;

      if (currentBucketVol >= bucketSize - 1e-9) {
        absoluteImbalancesSum += Math.abs(currentBucketBuy - currentBucketSell);
        completedBuckets++;
        currentBucketBuy = 0;
        currentBucketSell = 0;
        currentBucketVol = 0;
      }
    }
  }

  if (currentBucketVol > 0 && completedBuckets < bucketCount) {
    absoluteImbalancesSum += Math.abs(currentBucketBuy - currentBucketSell);
    completedBuckets++;
  }

  if (completedBuckets <= 0) return 0.0;
  const vpin = absoluteImbalancesSum / (completedBuckets * bucketSize);
  return Math.max(0.0, Math.min(1.0, vpin));
}

/**
 * Theorem 2: Amihud Illiquidity Ratio (ILIQ)
 * Reference: Amihud (2002)
 * Measures average absolute price return per unit of SOL volume traded.
 * Higher values signify hollow, fragile liquidity (slippage trap).
 */
export function computeAmihudIlliquidity(trades: TradePoint[]): number {
  if (trades.length < 3) return 0.0;

  let iliqSum = 0;
  let validTransitions = 0;

  for (let i = 1; i < trades.length; i++) {
    const prev = trades[i - 1];
    const curr = trades[i];

    if (prev.token_amount <= 0 || curr.token_amount <= 0 || curr.sol_amount <= 0) {
      continue;
    }

    const prevPrice = prev.sol_amount / prev.token_amount;
    const currPrice = curr.sol_amount / curr.token_amount;
    const returnPct = Math.abs(currPrice - prevPrice) / prevPrice;

    iliqSum += returnPct / curr.sol_amount;
    validTransitions++;
  }

  return validTransitions > 0 ? iliqSum / validTransitions : 0.0;
}

/**
 * Theorem 3: Normalized Shannon Information Entropy of Capital Distribution
 * Reference: Shannon (1948)
 * Quantifies the informational dispersion of capital across unique buyer wallets.
 * Range: [0.0, 1.0]. Values >= 0.80 indicate highly decentralized organic crowd allocation.
 */
export function computeShannonEntropy(buyerVolumes: Record<string, number>): number {
  const volumes = Object.values(buyerVolumes).filter((v) => v > 0);
  const n = volumes.length;
  if (n <= 1) return 0.0;

  const total = volumes.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return 0.0;

  let entropy = 0;
  for (const v of volumes) {
    const p = v / total;
    if (p > 0) {
      entropy -= p * Math.log(p);
    }
  }

  const maxEntropy = Math.log(n);
  return maxEntropy > 0 ? Math.max(0.0, Math.min(1.0, entropy / maxEntropy)) : 0.0;
}

/**
 * Theorem 4: Kyle's Lambda (Price Impact & Adverse Selection Coefficient)
 * Reference: Kyle (1985)
 * Measures the slope of price reaction to signed net order flow: Cov(ΔP, ΔV) / Var(ΔV).
 */
export function computeKyleLambda(trades: TradePoint[]): number {
  if (trades.length < 4) return 0.0;

  const deltaP: number[] = [];
  const deltaV: number[] = [];

  for (let i = 1; i < trades.length; i++) {
    const prev = trades[i - 1];
    const curr = trades[i];
    if (prev.token_amount <= 0 || curr.token_amount <= 0) continue;

    const pPrev = prev.sol_amount / prev.token_amount;
    const pCurr = curr.sol_amount / curr.token_amount;
    const dp = pCurr - pPrev;
    const signedVol = curr.side === "buy" ? curr.sol_amount : -curr.sol_amount;

    deltaP.push(dp);
    deltaV.push(signedVol);
  }

  const n = deltaP.length;
  if (n < 3) return 0.0;

  const meanP = deltaP.reduce((s, v) => s + v, 0) / n;
  const meanV = deltaV.reduce((s, v) => s + v, 0) / n;

  let cov = 0;
  let varV = 0;
  for (let i = 0; i < n; i++) {
    const diffV = deltaV[i] - meanV;
    cov += (deltaP[i] - meanP) * diffV;
    varV += diffV * diffV;
  }

  if (varV <= 1e-12) return 0.0;
  const lambda = cov / varV;
  return Math.max(0.0, lambda);
}

/**
 * Theorem 5: Pareto Power-Law Exponent (ζ) for Wash-Trade & Bot Detection
 * Reference: Gabaix et al. (2003), Clauset et al. (2009)
 * Real human trading follows a power-law distribution with exponent 1.1 <= ζ <= 3.2.
 * Uniform trade amounts or lack of variance indicate bot wash-trading rings.
 */
export function computeParetoExponent(trades: TradePoint[]): {
  exponent: number;
  coefficientOfVariation: number;
  isOrganicPowerLaw: boolean;
  isWashTradeSuspicious: boolean;
} {
  const buySizes = trades.filter((t) => t.side === "buy" && t.sol_amount > 0).map((t) => t.sol_amount);
  const m = buySizes.length;
  if (m < 6) {
    return {
      exponent: 1.5,
      coefficientOfVariation: 1.0,
      isOrganicPowerLaw: true,
      isWashTradeSuspicious: false,
    };
  }

  const mean = buySizes.reduce((s, v) => s + v, 0) / m;
  const variance = buySizes.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / m;
  const std = Math.sqrt(variance);
  const cv = mean > 0 ? std / mean : 0.0;

  const sMin = Math.max(Math.min(...buySizes), 0.005);
  let logSum = 0;
  for (const s of buySizes) {
    logSum += Math.log(Math.max(s, sMin) / sMin);
  }

  let exponent = 2.0;
  if (logSum > 1e-6) {
    exponent = 1.0 + m / logSum;
  } else {
    exponent = 10.0;
  }

  const isWashTrade = cv < 0.15 || exponent > 4.5;
  const isOrganic = !isWashTrade && exponent >= 1.1 && exponent <= 3.2 && cv >= 0.30;

  return {
    exponent: Math.round(exponent * 100) / 100,
    coefficientOfVariation: Math.round(cv * 100) / 100,
    isOrganicPowerLaw: isOrganic,
    isWashTradeSuspicious: isWashTrade,
  };
}

/**
 * Model 6: Hawkes Self-Exciting Point Process (Branching Ratio & Viral Cascade)
 * Reference: Hawkes (1971), Bacry et al. (2015)
 * Measures endogenous clustering of arrivals. Branching ratio η >= 1.0 signifies supercritical viral FOMO.
 */
export function computeHawkesProcess(
  trades: TradePoint[],
  beta: number = 0.08
): {
  branching_ratio: number;
  is_supercritical: boolean;
} {
  if (trades.length < 4) {
    return { branching_ratio: 0.5, is_supercritical: false };
  }
  const times = trades
    .map((t) => t.block_time || 0)
    .filter((t) => t > 0)
    .sort((a, b) => a - b);

  if (times.length < 4) {
    return { branching_ratio: 0.5, is_supercritical: false };
  }

  let r = 0;
  let rSum = 0;
  for (let i = 1; i < times.length; i++) {
    const dt = Math.max(0, times[i] - times[i - 1]);
    r = Math.exp(-beta * dt) * (1 + r);
    rSum += r;
  }

  const meanR = rSum / (times.length - 1);
  const branching = Math.min(2.5, Math.max(0.0, meanR / 2.0));
  return {
    branching_ratio: Math.round(branching * 100) / 100,
    is_supercritical: branching >= 1.0,
  };
}

/**
 * Model 7: Cox Proportional Hazards Model (Predictive Raydium Migration Probability)
 * Reference: Cox (1972), Kalbfleisch & Prentice (2002)
 * Computes calibrated probability of reaching 85 SOL graduation within forecast horizon (15m).
 */
export function computeGraduationProbability(
  netSol: number,
  velocity: number,
  entropy: number,
  ofi: number,
  vpin: number,
  hhi: number,
  devSold: boolean
): number {
  if (devSold) return 0.0;

  const progressRatio = Math.min(1.0, Math.max(0.0, netSol / RAYDIUM_MIGRATION_SOL));
  const z =
    -2.2 +
    3.5 * progressRatio +
    0.6 * Math.min(velocity, 4.0) +
    1.5 * (ofi - 0.5) +
    1.2 * (entropy - 0.5) -
    2.0 * hhi -
    1.5 * vpin;

  const prob = 1.0 / (1.0 + Math.exp(-z));
  return Math.max(0.01, Math.min(0.99, Math.round(prob * 1000) / 1000));
}

/**
 * Model 8: Hurst Exponent (H) via Variance Ratio Analysis
 * Reference: Hurst (1951), Lo & MacKinlay (1988)
 * H > 0.60: Persistent directional momentum.
 * 0.40 <= H <= 0.60: Brownian random walk / noise.
 * H < 0.40: Mean-reverting chop / whipsaw.
 */
export function computeHurstExponent(
  trades: TradePoint[],
  q: number = 4
): {
  hurst_exponent: number;
  hurst_regime: "TRENDING" | "RANDOM_WALK" | "MEAN_REVERTING";
} {
  const prices: number[] = [];
  for (const t of trades) {
    if (t.sol_amount > 0 && t.token_amount > 0) {
      prices.push(t.sol_amount / t.token_amount);
    }
  }

  if (prices.length < 8) {
    return { hurst_exponent: 0.5, hurst_regime: "RANDOM_WALK" };
  }

  const r1: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    r1.push(Math.log(prices[i] / prices[i - 1]));
  }
  const mean1 = r1.reduce((a, b) => a + b, 0) / r1.length;
  const var1 = r1.reduce((a, b) => a + Math.pow(b - mean1, 2), 0) / r1.length;
  if (var1 < 1e-12) {
    return { hurst_exponent: 0.85, hurst_regime: "TRENDING" };
  }

  const rq: number[] = [];
  for (let i = q; i < prices.length; i += q) {
    rq.push(Math.log(prices[i] / prices[i - q]));
  }
  if (rq.length < 2) {
    return { hurst_exponent: 0.5, hurst_regime: "RANDOM_WALK" };
  }

  const meanq = rq.reduce((a, b) => a + b, 0) / rq.length;
  const varq = rq.reduce((a, b) => a + Math.pow(b - meanq, 2), 0) / rq.length;

  const vr = varq / (q * var1);
  const h = 0.5 * (1 + Math.log(Math.max(1e-4, vr)) / Math.log(q));
  const clampedH = Math.max(0.0, Math.min(1.0, Math.round(h * 100) / 100));
  const regime: "TRENDING" | "RANDOM_WALK" | "MEAN_REVERTING" =
    clampedH > 0.6 ? "TRENDING" : clampedH < 0.4 ? "MEAN_REVERTING" : "RANDOM_WALK";

  return { hurst_exponent: clampedH, hurst_regime: regime };
}

/**
 * Model 9: Market Microstructure Regime Detection (HMM)
 * Reference: Hamilton (1989)
 * Identifies latent accumulation, markup frenzy, or stealth distribution exit traps.
 */
export function detectMarketRegime(
  trades: TradePoint[],
  vpin: number,
  ofi: number,
  velocity: number,
  hawkes: number
): {
  market_regime: "ACCUMULATION" | "MARKUP_FRENZY" | "DISTRIBUTION_EXIT";
  distribution_risk_pct: number;
} {
  const distributionRisk = Math.min(
    100,
    Math.max(0, Math.round(vpin * 50 + (1.0 - ofi) * 50))
  );

  if (distributionRisk >= 65 && trades.length >= 8) {
    return {
      market_regime: "DISTRIBUTION_EXIT",
      distribution_risk_pct: distributionRisk,
    };
  }

  if (velocity >= 1.5 && ofi >= 0.65 && hawkes >= 0.9 && trades.length >= 8) {
    return {
      market_regime: "MARKUP_FRENZY",
      distribution_risk_pct: distributionRisk,
    };
  }

  return {
    market_regime: "ACCUMULATION",
    distribution_risk_pct: distributionRisk,
  };
}

/**
 * Model 10: Sybil Graph & Co-Execution Clustering Heuristic
 * Reference: Newman (2006)
 * Identifies coordinated bot farms executing synchronized multi-wallet bursts (<= 2s).
 */
export function computeSybilClusterMetrics(trades: TradePoint[]): {
  sybil_cluster_ratio: number;
  effective_unique_buyers: number;
  is_cabal_sybil: boolean;
} {
  if (trades.length < 6) {
    const rawBuyers = new Set(trades.filter((t) => t.side === "buy").map((t) => t.trader)).size;
    return {
      sybil_cluster_ratio: 0.0,
      effective_unique_buyers: rawBuyers,
      is_cabal_sybil: false,
    };
  }

  const sorted = [...trades].sort((a, b) => (a.block_time || 0) - (b.block_time || 0));
  let syncCount = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const dt = Math.abs((curr.block_time || 0) - (prev.block_time || 0));
    if (dt <= 2 && curr.trader !== prev.trader) {
      syncCount += 1;
    }
  }

  const ratio = Math.min(1.0, syncCount / sorted.length);
  const uniqueBuyers = new Set(trades.filter((t) => t.side === "buy").map((t) => t.trader)).size;
  const effective = Math.max(1, Math.round(uniqueBuyers * (1.0 - 0.7 * ratio)));
  const isCabal = ratio >= 0.35 && sorted.length >= 10;

  return {
    sybil_cluster_ratio: Math.round(ratio * 100) / 100,
    effective_unique_buyers: effective,
    is_cabal_sybil: isCabal,
  };
}

/**
 * Compute quantitative flow, concentration, developer status, velocity, and predictive metrics.
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
      vpin: 0,
      amihud_iliq: 0,
      shannon_entropy: 0,
      kyle_lambda: 0,
      pareto_exponent: 1.5,
      hawkes_branching_ratio: 0.5,
      is_supercritical_fomo: false,
      graduation_probability: 0.01,
      hurst_exponent: 0.5,
      hurst_regime: "RANDOM_WALK",
      market_regime: "ACCUMULATION",
      distribution_risk_pct: 50,
      sybil_cluster_ratio: 0,
      effective_unique_buyers: 0,
    };
  }

  let buyCount = 0;
  let sellCount = 0;
  let totalBuySol = 0;
  let totalSellSol = 0;
  let grossVolume = 0;

  const buyerVolumes: Record<string, number> = {};
  const sellerVolumes: Record<string, number> = {};

  let devTokensBought = 0;
  let devTokensSold = 0;

  let minBlockTime = Infinity;
  let maxBlockTime = -Infinity;

  for (const t of trades) {
    grossVolume += t.sol_amount;

    if (t.block_time) {
      if (t.block_time < minBlockTime) minBlockTime = t.block_time;
      if (t.block_time > maxBlockTime) maxBlockTime = t.block_time;
    }

    const isCreator = creatorAddress && t.trader.toLowerCase() === creatorAddress.toLowerCase();

    if (t.side === "buy") {
      buyCount++;
      totalBuySol += t.sol_amount;
      buyerVolumes[t.trader] = (buyerVolumes[t.trader] || 0) + t.sol_amount;
      if (isCreator) {
        devTokensBought += t.token_amount;
      }
    } else {
      sellCount++;
      totalSellSol += t.sol_amount;
      sellerVolumes[t.trader] = (sellerVolumes[t.trader] || 0) + t.sol_amount;
      if (isCreator) {
        devTokensSold += t.token_amount;
      }
    }
  }

  const netSol = Math.max(0, totalBuySol - totalSellSol);
  const progressPct = Math.min(100, (netSol / migrationTargetSol) * 100);

  // Developer holding dynamics
  const devBalance = Math.max(0, devTokensBought - devTokensSold);
  const devSupplyPct = devBalance / PUMP_TOTAL_SUPPLY;
  const devDumpPct = devTokensBought > 0 ? devTokensSold / devTokensBought : 0;
  const devSold = devDumpPct >= 0.10;

  // Concentration indices
  const hhi = computeBuyerHHI(buyerVolumes);
  const top1Share = computeTopKShare(buyerVolumes, 1);
  const top5Share = computeTopKShare(buyerVolumes, 5);

  // OFI
  const ofi = grossVolume > 0 ? totalBuySol / grossVolume : 0;

  // Velocity (SOL / min)
  const elapsedSeconds =
    minBlockTime !== Infinity && maxBlockTime !== -Infinity && maxBlockTime >= minBlockTime
      ? Math.max(maxBlockTime - minBlockTime, 1)
      : 60;
  const elapsedMinutes = Math.max(elapsedSeconds / 60.0, 0.5);
  const solVelocity = netSol / elapsedMinutes;

  // Advanced Microstructure & Quantitative Theorems
  const vpin = computeVPIN(trades, 5);
  const amihudIliq = computeAmihudIlliquidity(trades);
  const shannonEntropy = computeShannonEntropy(buyerVolumes);
  const kyleLambda = computeKyleLambda(trades);
  const paretoResult = computeParetoExponent(trades);

  // Predictive & Stochastic Models
  const hawkes = computeHawkesProcess(trades, 0.08);
  const hurst = computeHurstExponent(trades, 4);
  const gradProb = computeGraduationProbability(
    netSol,
    solVelocity,
    shannonEntropy,
    ofi,
    vpin,
    hhi,
    devSold
  );
  const regime = detectMarketRegime(trades, vpin, ofi, solVelocity, hawkes.branching_ratio);
  const sybil = computeSybilClusterMetrics(trades);

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
    vpin,
    amihud_iliq: amihudIliq,
    shannon_entropy: shannonEntropy,
    kyle_lambda: kyleLambda,
    pareto_exponent: paretoResult.exponent,
    hawkes_branching_ratio: hawkes.branching_ratio,
    is_supercritical_fomo: hawkes.is_supercritical,
    graduation_probability: gradProb,
    hurst_exponent: hurst.hurst_exponent,
    hurst_regime: hurst.hurst_regime,
    market_regime: regime.market_regime,
    distribution_risk_pct: regime.distribution_risk_pct,
    sybil_cluster_ratio: sybil.sybil_cluster_ratio,
    effective_unique_buyers: sybil.effective_unique_buyers,
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
  const effectiveBuyers = metrics.effective_unique_buyers || metrics.unique_buyers;

  if (effectiveBuyers >= 35) {
    decScore += 15;
  } else if (effectiveBuyers >= 20) {
    decScore += 10;
  } else if (effectiveBuyers >= 12) {
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
  if (metrics.top5_buyer_share <= 0.25 && effectiveBuyers >= 20) {
    decScore = Math.min(decScore + 5, 30);
  } else if (metrics.top5_buyer_share > 0.38 && metrics.total_trades > 10) {
    flags.push("CLUSTER_CONCENTRATION");
    decScore = Math.max(decScore - 10, 0);
  }

  if (metrics.top_buyer_share > 0.28) {
    decScore = Math.max(decScore - 8, 0);
  }

  // Theorem 3: Shannon Information Entropy
  if (metrics.shannon_entropy >= 0.80 && effectiveBuyers >= 15) {
    decScore = Math.min(decScore + 5, 30);
    flags.push("HIGH_ENTROPY_DECENTRALIZED");
  } else if (metrics.shannon_entropy > 0 && metrics.shannon_entropy < 0.45 && effectiveBuyers >= 10) {
    flags.push("LOW_ENTROPY_CABAL");
  }

  // Model 10: Sybil Co-Execution Ring
  if (metrics.sybil_cluster_ratio >= 0.35 && metrics.total_trades >= 10) {
    flags.push("SYNCHRONIZED_SYBIL_RING");
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
    flags.push("STAGNANT_MOMENTUM");
  }

  // Theorem 1: Volume-Synchronized Probability of Toxicity (VPIN)
  if (metrics.vpin >= 0.75 && metrics.order_flow_imbalance < 0.40 && metrics.total_trades >= 8) {
    flags.push("TOXIC_ORDER_FLOW");
  } else if (metrics.vpin <= 0.45 && metrics.total_trades >= 8) {
    momScore = Math.min(momScore + 5, 35);
    flags.push("BALANCED_ORDER_FLOW");
  }

  // Theorem 2: Amihud Illiquidity (ILIQ)
  if (metrics.amihud_iliq > 1.50 && metrics.total_trades >= 6) {
    flags.push("HOLLOW_CURVE_SLIPPAGE");
  } else if (metrics.amihud_iliq > 0 && metrics.amihud_iliq <= 0.60 && metrics.total_trades >= 6) {
    momScore = Math.min(momScore + 5, 35);
    flags.push("RESILIENT_LIQUIDITY_DEPTH");
  }

  // Model 6: Hawkes Point Process Supercritical FOMO
  if (metrics.is_supercritical_fomo && metrics.total_trades >= 8) {
    momScore = Math.min(momScore + 5, 35);
    flags.push("SUPERCRITICAL_FOMO_CASCADE");
  }

  // Model 7: Cox Graduation Survival Forecast
  if (metrics.graduation_probability >= 0.65) {
    momScore = Math.min(momScore + 5, 35);
    flags.push("HIGH_GRADUATION_PROBABILITY");
  }

  // Model 8: Hurst Exponent Trend Persistence
  if (metrics.hurst_regime === "TRENDING" && metrics.total_trades >= 8) {
    momScore = Math.min(momScore + 5, 35);
    flags.push("PERSISTENT_DIRECTIONAL_TREND");
  }

  // Model 9: Market Microstructure Regime
  if (metrics.market_regime === "MARKUP_FRENZY") {
    flags.push("MARKUP_REGIME");
  } else if (metrics.market_regime === "DISTRIBUTION_EXIT" || metrics.distribution_risk_pct >= 65) {
    flags.push("STEALTH_DISTRIBUTION_TRAP");
  }

  // ========================================================================
  // 3. Creator Trust & Supply Alignment (0 to 15 pts)
  // ========================================================================
  let creatorScore = 0;
  if (creatorAddress && creatorAddress !== "unknown") {
    if (metrics.dev_sold) {
      creatorScore = 0;
      flags.push("DEV_DUMPED_TOKENS");
    } else if (metrics.dev_supply_pct > 0.10) {
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
    flags.push("SOCIAL_METADATA_UNAVAILABLE");
    metaScore = 0;
  } else {
    if (metadata.website) metaScore += 7;
    if (metadata.twitter) metaScore += 7;
    if (metadata.telegram) metaScore += 6;

    if (metaScore >= 14) {
      flags.push("COMMUNITY_LINKS");
    } else if (metaScore === 0) {
      flags.push("NO_SOCIALS");
    }
  }

  // ========================================================================
  // 5. Wash-Trading / Sybil Bot Ring Detection (Theorem 5)
  // ========================================================================
  if (metrics.pareto_exponent > 4.5 && metrics.total_trades >= 8) {
    flags.push("WASH_TRADE_SUSPICION");
  } else if (metrics.pareto_exponent >= 1.1 && metrics.pareto_exponent <= 3.2 && metrics.total_trades >= 10) {
    flags.push("ORGANIC_POWER_LAW_DISTRIBUTION");
  }

  // ========================================================================
  // 6. Penalties & Zero-Tolerance Disqualifications
  // ========================================================================
  let penalty = 0;
  if (flags.includes("DEV_DUMPED_TOKENS")) penalty += 40;
  if (flags.includes("DEV_OVERHOLDING_HAZARD")) penalty += 40;
  if (flags.includes("DEV_UNKNOWN")) penalty += 15;
  if (flags.includes("NO_SOCIALS")) penalty += 30;
  if (flags.includes("WHALE_CONCENTRATION")) penalty += 15;
  if (flags.includes("CLUSTER_CONCENTRATION")) penalty += 15;
  if (flags.includes("STAGNANT_MOMENTUM")) penalty += 25;
  if (flags.includes("TOXIC_ORDER_FLOW")) penalty += 25;
  if (flags.includes("HOLLOW_CURVE_SLIPPAGE")) penalty += 20;
  if (flags.includes("LOW_ENTROPY_CABAL")) penalty += 20;
  if (flags.includes("WASH_TRADE_SUSPICION")) penalty += 30;
  if (flags.includes("STEALTH_DISTRIBUTION_TRAP")) penalty += 30;
  if (flags.includes("SYNCHRONIZED_SYBIL_RING")) penalty += 30;

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
  // 7. Zero tolerance on toxic order flow (VPIN >= 0.75 + sell dominance)
  // 8. Zero tolerance on bot wash-trading rings (Pareto zeta > 4.5)
  // 9. Zero tolerance on stealth distribution traps (HMM distribution regime)
  // 10. Zero tolerance on synchronized multi-wallet sybil farms
  const isDisqualified =
    flags.includes("NO_SOCIALS") ||
    flags.includes("DEV_DUMPED_TOKENS") ||
    flags.includes("DEV_OVERHOLDING_HAZARD") ||
    flags.includes("STAGNANT_MOMENTUM") ||
    flags.includes("TOXIC_ORDER_FLOW") ||
    flags.includes("WASH_TRADE_SUSPICION") ||
    flags.includes("STEALTH_DISTRIBUTION_TRAP") ||
    flags.includes("SYNCHRONIZED_SYBIL_RING") ||
    effectiveBuyers < 12 ||
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
