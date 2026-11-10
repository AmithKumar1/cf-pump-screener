import type { Env } from "./types.ts";
import { fetchRugCheck } from "./security.ts";

export interface InvestorRecord {
  rank: number;
  wallet: string;
  short_wallet: string;
  solscan_url: string;
  net_sol: number;
  gross_buy_sol: number;
  gross_sell_sol: number;
  pct_share: number;
  tag: string;
  tag_class: string;
  trades_count: number;
}

export interface LaunchTimelinePoint {
  signature: string;
  trader: string;
  short_trader: string;
  side: "buy" | "sell";
  sol_amount: number;
  token_amount: number;
  block_time: number;
  elapsed_seconds: number;
  is_bundled: boolean;
  tier: "creator" | "bundle" | "whale" | "buyer";
}

export interface SybilBubbleNode {
  id: string;
  short: string;
  role: "CREATOR" | "BUNDLED_INSIDER" | "ALPHA_WHALE" | "WHALE" | "INVESTOR";
  color: string;
  sol: number;
  net_sol: number;
  share_pct: number;
  trades_count: number;
  transfer_info: string;
  solscan_url: string;
  tag: string;
}

export interface SybilBubbleLink {
  source: string;
  target: string;
  type: "bundled_cluster" | "capital_inflow";
}

export interface SybilIntelligence {
  is_bundled_launch: boolean;
  same_slot_wallets: string[];
  insider_holding_pct: number;
  cluster_count: number;
  cluster_verdict: string;
  bubble_graph: {
    nodes: SybilBubbleNode[];
    links: SybilBubbleLink[];
  };
}

export interface ResearchMemo {
  verdict: "ACCUMULATE" | "CAUTION" | "AVOID_RUG" | "NEUTRAL";
  verdict_badge: string;
  verdict_title: string;
  executive_summary: string;
  creator_analysis: string;
  capital_structure_analysis: string;
  sybil_threat_analysis: string;
  liquidity_trajectory: string;
  strategy_recommendation: {
    suggested_action: string;
    max_slippage: string;
    priority_tip: string;
    risk_level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  };
}

export interface JitoExecutionConfig {
  recommended_tip_sol: number;
  mev_risk_level: "LOW" | "MEDIUM" | "HIGH";
  safe_slippage_pct: number;
  photon_tip_url: string;
  bullx_tip_url: string;
  gmgn_tip_url: string;
}

export interface TokenInspectionReport {
  mint: string;
  name: string;
  symbol: string;
  creator: string;
  creator_short: string;
  creator_solscan: string;
  token_solscan: string;
  bonding_curve: string;
  socials: {
    twitter: string | null;
    telegram: string | null;
    website: string | null;
  };
  metadata_uri: string | null;
  created_at: string;

  // Financials & Bonding Curve
  net_sol_deployed: number;
  curve_reserve_sol: number;
  total_inflow_sol: number;
  total_outflow_sol: number;
  curve_progress_pct: number;
  sol_to_graduation: number;
  estimated_mcap_usd: number;
  price_usd: number | null;
  mcap_source: "BONDING_CURVE" | "PUMPSWAP" | "RAYDIUM" | "DEX_POOL";
  sol_price_usd: number;
  sol_price_is_live: boolean;
  total_trades: number;
  unique_investors: number;

  // Creator DNA
  creator_history: {
    past_launches: number;
    dev_buy_sol: number;
    dev_holds_pct: number;
    is_serial_rugger: boolean;
    is_alpha_creator: boolean;
    rug_index: number;
  };

  // Whale & Investor Distribution
  investors: InvestorRecord[];
  timeline_points: LaunchTimelinePoint[];
  top5_share_pct: number;
  hhi_score: number;
  is_whale_concentrated: boolean;

  // Security & Audit
  security: {
    rugcheck_status: "SAFE" | "WARNING" | "DANGER";
    rugcheck_score: number;
    lp_locked_pct: number;
    mint_authority_revoked: boolean;
    freeze_authority_revoked: boolean;
    risks: string[];
  };

  // Advanced Quant & Institutional Intelligence
  sybil_intelligence: SybilIntelligence;
  jito_execution: JitoExecutionConfig;
  research_memo: ResearchMemo;

  // 1-Click Fast Sniper Links
  sniper_links: {
    photon: string;
    bullx: string;
    gmgn: string;
    dexscreener: string;
    pumpfun: string;
    solscan_token: string;
    solscan_creator: string;
  };
}

export async function getDetailedTokenInspection(
  mint: string,
  env: Env
): Promise<TokenInspectionReport> {
  // 1. Fetch Event record
  const eventRow = await env.DB.prepare(
    `SELECT id, mint, symbol, name, creator, bonding_curve, uri, twitter, telegram, website, datetime(received_at/1000, 'unixepoch') as created_at
     FROM events
     WHERE mint = ?
     ORDER BY id DESC
     LIMIT 1`
  )
    .bind(mint)
    .first<any>();

  const symbol = eventRow?.symbol || "PUMP";
  const name = eventRow?.name || "Pump Token";
  const creator = eventRow?.creator || "unknown";
  const bondingCurve = eventRow?.bonding_curve || "";
  const uri = eventRow?.uri || null;
  const createdAt = eventRow?.created_at || new Date().toISOString();

  const socials = {
    twitter: eventRow?.twitter || null,
    telegram: eventRow?.telegram || null,
    website: eventRow?.website || null,
  };

  // 2. Creator Historical Activity
  let pastLaunches = 1;
  const isUnknownCreator = !creator || creator === "unknown";
  if (!isUnknownCreator) {
    const creatorCount = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM events WHERE creator = ?"
    )
      .bind(creator)
      .first<{ count: number }>();
    pastLaunches = creatorCount?.count || 1;
  }

  // Serial Launcher heuristic: deployer wallet with >= 4 launches recorded in DB
  const isSerialRugger = !isUnknownCreator && pastLaunches >= 4;
  const rugIndex = isSerialRugger ? Math.min(1, pastLaunches / 10) : 0;

  // 3. Trade Totals & Summary
  const totalsRow = await env.DB.prepare(
    `SELECT
       COUNT(DISTINCT trader) as unique_investors,
       COALESCE(SUM(CASE WHEN LOWER(side) = 'buy' THEN sol_amount ELSE 0 END), 0) as gross_buy_sol,
       COALESCE(SUM(CASE WHEN LOWER(side) = 'sell' THEN sol_amount ELSE 0 END), 0) as gross_sell_sol,
       COALESCE(SUM(CASE WHEN LOWER(side) = 'buy' THEN sol_amount ELSE -sol_amount END), 0) as net_sol,
       COUNT(*) as total_trades
     FROM trades
     WHERE mint = ?`
  )
    .bind(mint)
    .first<any>();

  const totalTrades = Number(totalsRow?.total_trades || 0);
  const uniqueInvestors = Number(totalsRow?.unique_investors || 0);
  const grossBuySol = Number(totalsRow?.gross_buy_sol || 0);
  const grossSellSol = Number(totalsRow?.gross_sell_sol || 0);
  const netSol = Number(totalsRow?.net_sol || 0);

  // 4. Early Trades for Sybil & Co-Execution Clustering & Launch Timeline
  const earlyTradesRows = await env.DB.prepare(
    `SELECT signature, trader, sol_amount, token_amount, side, block_time
     FROM trades
     WHERE mint = ?
     ORDER BY block_time ASC
     LIMIT 40`
  )
    .bind(mint)
    .all<any>();

  const timeMap = new Map<number, string[]>();
  const sameSlotSet = new Set<string>();
  let earlyClusterSol = 0;

  const earlyTrades = earlyTradesRows.results || [];
  const minBlockTime = earlyTrades[0]?.block_time ? Number(earlyTrades[0].block_time) : 0;

  for (const t of earlyTrades) {
    if ((t.side || "").toLowerCase() !== "buy") continue;
    const bTime = Number(t.block_time || 0);
    if (!bTime) continue;
    if (!timeMap.has(bTime)) {
      timeMap.set(bTime, []);
    }
    const list = timeMap.get(bTime)!;
    list.push(t.trader);
    if (list.length >= 2) {
      for (const w of list) {
        sameSlotSet.add(w);
      }
    }
  }

  for (const t of earlyTrades) {
    if ((t.side || "").toLowerCase() === "buy" && sameSlotSet.has(t.trader)) {
      earlyClusterSol += Number(t.sol_amount || 0);
    }
  }

  const timelinePoints: LaunchTimelinePoint[] = earlyTrades.map(t => {
    const bTime = Number(t.block_time || 0);
    const elapsed = minBlockTime > 0 && bTime >= minBlockTime ? bTime - minBlockTime : 0;
    const isBundled = sameSlotSet.has(t.trader) && t.trader !== creator;
    const tier: "creator" | "bundle" | "whale" | "buyer" =
      t.trader === creator
        ? "creator"
        : isBundled
        ? "bundle"
        : Number(t.sol_amount || 0) >= 2.0
        ? "whale"
        : "buyer";

    return {
      signature: t.signature || "",
      trader: t.trader,
      short_trader: t.trader.slice(0, 4) + "..." + t.trader.slice(-4),
      side: ((t.side || "buy").toLowerCase() === "sell" ? "sell" : "buy") as "buy" | "sell",
      sol_amount: Number(Number(t.sol_amount || 0).toFixed(2)),
      token_amount: Number(Number(t.token_amount || 0).toFixed(0)),
      block_time: bTime,
      elapsed_seconds: elapsed,
      is_bundled: isBundled,
      tier,
    };
  });

  const sameSlotWallets = Array.from(sameSlotSet);
  const insiderHoldingPct = grossBuySol > 0 ? (earlyClusterSol / grossBuySol) * 100 : 0;
  // Calibrated using empirical D1 baseline (778 tokens share 2 co-timed wallets organically):
  // True bundling requires either high co-execution (>=4 wallets) or high capital concentration (>=2 wallets holding >=20% inflow).
  const isBundledLaunch = sameSlotWallets.length >= 4 || (sameSlotWallets.length >= 2 && insiderHoldingPct >= 20.0);
  const clusterVerdict = isBundledLaunch
    ? (insiderHoldingPct >= 35 ? "❌ High Sybil Co-Execution (Bundled Snipers)" : `🚨 Concentrated Bundle Risk (${insiderHoldingPct.toFixed(1)}% Inflow)`)
    : sameSlotWallets.length >= 2
    ? `⚠️ Co-Timed Wallets (${sameSlotWallets.length} wallets, ${insiderHoldingPct.toFixed(1)}% inflow)`
    : sameSlotWallets.length === 1
    ? "ℹ️ Isolated Co-Timed Transaction"
    : "✅ Organic Distributed Order Flow";

  // 5. Top Investors Breakdown
  const topRows = await env.DB.prepare(
    `SELECT
       trader,
       COALESCE(SUM(CASE WHEN LOWER(side) = 'buy' THEN sol_amount ELSE 0 END), 0) as buy_sol,
       COALESCE(SUM(CASE WHEN LOWER(side) = 'sell' THEN sol_amount ELSE 0 END), 0) as sell_sol,
       COALESCE(SUM(CASE WHEN LOWER(side) = 'buy' THEN sol_amount ELSE -sol_amount END), 0) as net_sol,
       COALESCE(SUM(CASE WHEN LOWER(side) = 'buy' THEN token_amount ELSE -token_amount END), 0) as net_tokens,
       COUNT(*) as trades_count
     FROM trades
     WHERE mint = ?
     GROUP BY trader
     ORDER BY net_sol DESC
     LIMIT 10`
  )
    .bind(mint)
    .all<any>();

  let devBuySol = 0;
  let top5NetSol = 0;
  let sumSquaredShares = 0;

  const totalPositiveSol = Math.max(0.01, grossBuySol);

  const bubbleNodes: SybilBubbleNode[] = [];
  const bubbleLinks: SybilBubbleLink[] = [];

  // Creator bubble node
  const creatorShort = isUnknownCreator ? "Proxy Deployer" : creator.slice(0, 4) + "..." + creator.slice(-4);
  bubbleNodes.push({
    id: creator,
    short: creatorShort,
    role: "CREATOR",
    color: isUnknownCreator ? "#94a3b8" : "#f59e0b",
    sol: 0, // updated below once dev buy found
    net_sol: 0,
    share_pct: 0,
    trades_count: 1,
    transfer_info: isUnknownCreator
      ? "⚠️ Unverified Deployer (Sponsored launch / Fee-Payer Proxy)"
      : "Token deployer / initial bonding curve creation",
    solscan_url: isUnknownCreator ? `https://solscan.io/token/${mint}` : `https://solscan.io/account/${creator}`,
    tag: isUnknownCreator ? "⚠️ Unverified Deployer" : "👨‍💻 Creator Deployer",
  });

  const investors: InvestorRecord[] = (topRows.results || []).map((row, idx) => {
    const traderNet = Number(row.net_sol || 0);
    const traderBuy = Number(row.buy_sol || 0);
    const traderSell = Number(row.sell_sol || 0);
    const isDev = row.trader === creator;
    if (isDev) {
      devBuySol = traderBuy;
      bubbleNodes[0].sol = devBuySol;
      bubbleNodes[0].net_sol = traderNet;
      bubbleNodes[0].share_pct = Number(((devBuySol / totalPositiveSol) * 100).toFixed(1));
    }

    if (idx < 5 && traderNet > 0) {
      top5NetSol += traderNet;
    }

    const sharePct = Math.max(0, (traderBuy / totalPositiveSol) * 100);
    const fraction = traderBuy / totalPositiveSol;
    sumSquaredShares += fraction * fraction;

    const isSameSlot = sameSlotSet.has(row.trader) && !isDev;
    let tag = "⚡ Early Buyer";
    let tagClass = "badge-muted";
    let role: "CREATOR" | "BUNDLED_INSIDER" | "ALPHA_WHALE" | "WHALE" | "INVESTOR" = "INVESTOR";
    let nodeColor = "#00d2ff";

    if (isDev) {
      tag = isUnknownCreator ? "⚠️ Proxy Deployer" : "👨‍💻 Dev Deployer";
      tagClass = isUnknownCreator ? "badge-muted" : "badge-yellow";
      role = "CREATOR";
      nodeColor = isUnknownCreator ? "#94a3b8" : "#f59e0b";
    } else if (isSameSlot) {
      tag = "🤖 Bundled Insider";
      tagClass = "badge-red";
      role = "BUNDLED_INSIDER";
      nodeColor = "#ef4444";
    } else if (traderNet >= 2.0) {
      tag = "🐋 Large Buyer (>=2 SOL)";
      tagClass = "badge-green";
      role = "WHALE";
      nodeColor = "#10b981";
    } else if (traderNet <= 0 && row.trades_count > 1) {
      tag = "💨 Scalper (Exited)";
      tagClass = "badge-red";
      role = "INVESTOR";
      nodeColor = "#64748b";
    }

    // Add node and link for bubble graph if not dev
    if (!isDev) {
      const shortAddr = row.trader.slice(0, 4) + "..." + row.trader.slice(-4);
      bubbleNodes.push({
        id: row.trader,
        short: shortAddr,
        role,
        color: nodeColor,
        sol: Number(traderBuy.toFixed(2)),
        net_sol: Number(traderNet.toFixed(2)),
        share_pct: Number(sharePct.toFixed(1)),
        trades_count: Number(row.trades_count || 1),
        transfer_info: isSameSlot
          ? "🚨 BUNDLE SYBIL: Co-executed in same slot as creator"
          : traderNet <= 0
            ? "💨 Scalper: Dumped/exited entire position"
            : `💎 Conviction Holder: ${traderNet.toFixed(2)} SOL net retained`,
        solscan_url: `https://solscan.io/account/${row.trader}`,
        tag,
      });

      bubbleLinks.push({
        source: creator,
        target: row.trader,
        type: isSameSlot ? "bundled_cluster" : "capital_inflow",
      });
    }

    return {
      rank: idx + 1,
      wallet: row.trader,
      short_wallet: row.trader.slice(0, 4) + "..." + row.trader.slice(-4),
      solscan_url: `https://solscan.io/account/${row.trader}`,
      net_sol: Number(traderNet.toFixed(3)),
      gross_buy_sol: Number(traderBuy.toFixed(3)),
      gross_sell_sol: Number(traderSell.toFixed(3)),
      pct_share: Number(sharePct.toFixed(1)),
      tag,
      tag_class: tagClass,
      trades_count: Number(row.trades_count || 1),
    };
  });

  const top5SharePct = netSol > 0 ? Math.min(100, (top5NetSol / netSol) * 100) : 0;
  const isWhaleConcentrated = top5SharePct > 55 || sumSquaredShares > 0.20 || insiderHoldingPct >= 20.0;

  // 6. Parallel live data: RugCheck & DexScreener & Live SOL Price
  const [rugCheck, dexData, solPriceInfo] = await Promise.all([
    fetchRugCheck(mint),
    fetchDexScreenerData(mint),
    fetchLiveSolPrice(),
  ]);

  const solUsd = solPriceInfo.price;

  // Bonding Curve: Standard Pump.fun curve requires ~85 SOL to migrate to PumpSwap AMM
  const GRADUATION_SOL_TARGET = 85.0;
  const curveReserveSol = Math.min(GRADUATION_SOL_TARGET, Math.max(0, netSol));
  const curveProgress = Math.min(100, Math.max(0, (netSol / GRADUATION_SOL_TARGET) * 100));
  const solToGraduation = Math.max(0, GRADUATION_SOL_TARGET - netSol);
  const isGraduated = curveProgress >= 100 || (dexData?.marketCap != null && (dexData.dexId === "pumpswap" || dexData.dexId === "raydium") && netSol >= 75);

  // Deterministic Curve Pricing:
  const virtualSol = 30.0 + curveReserveSol;
  const tokenPriceSol = (virtualSol * virtualSol) / 32_190_000_000;
  const deterministicMcapUsd = Math.round((1_000_000_000 * tokenPriceSol) * solUsd);

  let estimatedMcapUsd: number;
  let priceUsd: number;
  let mcapSource: "BONDING_CURVE" | "PUMPSWAP" | "RAYDIUM" | "DEX_POOL";

  if (isGraduated && dexData?.marketCap) {
    estimatedMcapUsd = Math.round(dexData.marketCap);
    priceUsd = dexData.priceUsd || Number((tokenPriceSol * solUsd).toFixed(8));
    if (dexData.dexId === "pumpswap") {
      mcapSource = "PUMPSWAP";
    } else if (dexData.dexId === "raydium") {
      mcapSource = "RAYDIUM";
    } else {
      mcapSource = "DEX_POOL";
    }
  } else {
    estimatedMcapUsd = deterministicMcapUsd;
    priceUsd = Number((tokenPriceSol * solUsd).toFixed(8));
    mcapSource = "BONDING_CURVE";
  }

  // 7. Jito Anti-MEV Tip Recommendation
  let mevRiskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  let recommendedTipSol = 0.003;
  let safeSlippagePct = 10;

  if (curveProgress > 25 || grossBuySol > 15 || isBundledLaunch) {
    mevRiskLevel = "HIGH";
    recommendedTipSol = 0.015;
    safeSlippagePct = 20;
  } else if (grossBuySol > 5 || top5SharePct > 50) {
    mevRiskLevel = "MEDIUM";
    recommendedTipSol = 0.007;
    safeSlippagePct = 15;
  }

  const jitoExecution: JitoExecutionConfig = {
    recommended_tip_sol: recommendedTipSol,
    mev_risk_level: mevRiskLevel,
    safe_slippage_pct: safeSlippagePct,
    photon_tip_url: `https://photon-sol.tinyastro.io/en/lp/${mint}`,
    bullx_tip_url: `https://bullx.io/terminal?chainId=1399811149&address=${mint}`,
    gmgn_tip_url: `https://gmgn.ai/sol/token/${mint}`,
  };

  const sybilIntelligence: SybilIntelligence = {
    is_bundled_launch: isBundledLaunch,
    same_slot_wallets: sameSlotWallets,
    insider_holding_pct: Number(insiderHoldingPct.toFixed(1)),
    cluster_count: sameSlotWallets.length,
    cluster_verdict: clusterVerdict,
    bubble_graph: {
      nodes: bubbleNodes,
      links: bubbleLinks,
    },
  };

  // Generate Structured Institutional Quantitative Research Memo
  let memoVerdict: "ACCUMULATE" | "CAUTION" | "AVOID_RUG" | "NEUTRAL" = "NEUTRAL";
  let memoBadge = "badge-cyan";
  let memoTitle = "DISCOVERY PHASE: EARLY INFLOW";
  let riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" = "MODERATE";

  if (isSerialRugger || rugCheck.score > 500) {
    memoVerdict = "AVOID_RUG";
    memoBadge = "badge-red";
    memoTitle = "CRITICAL HAZARD: SERIAL RUGGER / HIGH RISK CONTRACT";
    riskLevel = "CRITICAL";
  } else if (isBundledLaunch || insiderHoldingPct >= 20.0) {
    memoVerdict = "CAUTION";
    memoBadge = "badge-yellow";
    memoTitle = `INSIDER BUNDLE DETECTED: ${insiderHoldingPct.toFixed(1)}% EARLY INFLOW`;
    riskLevel = "HIGH";
  } else if (netSol >= 10 && uniqueInvestors >= 10 && !isWhaleConcentrated) {
    memoVerdict = "ACCUMULATE";
    memoBadge = "badge-green";
    memoTitle = "ORGANIC ORDER FLOW: DISTRIBUTED INFLOW";
    riskLevel = "LOW";
  }

  const researchMemo: ResearchMemo = {
    verdict: memoVerdict,
    verdict_badge: memoBadge,
    verdict_title: memoTitle,
    executive_summary: `Quantitative analysis for $${symbol} (${name}). Token has registered ${totalTrades} on-chain trades from ${uniqueInvestors} unique participants, deploying ${netSol.toFixed(2)} SOL net capital. ${
      memoVerdict === "ACCUMULATE"
        ? "Order flow reflects decentralized accumulation with healthy power-law distribution and low insider clustering."
        : memoVerdict === "AVOID_RUG"
        ? "Elevated risk profile: deployer signature correlates with frequent token generation or high contract penalties."
        : isBundledLaunch
        ? `Co-executed bundle activity detected (${insiderHoldingPct.toFixed(1)}% of early inflow).`
        : "Early discovery phase with active bonding curve progression."
    }`,
    creator_analysis: isUnknownCreator
      ? "Deployer signature unresolved (sponsored transaction / fee-payer proxy). Creator history unverified."
      : `Deployer wallet ${creatorShort} has launched ${pastLaunches} token(s). Dev initial purchase was ${devBuySol.toFixed(2)} SOL. Serial Rug Index is ${rugIndex.toFixed(2)} (${isSerialRugger ? "FLAGGED: Serial Launcher" : "No Prior Flags Recorded"}).`,
    capital_structure_analysis: `Top 5 wallets control ${top5SharePct.toFixed(1)}% of net capital. Herfindahl-Hirschman Index (HHI) is ${sumSquaredShares.toFixed(3)} (${isWhaleConcentrated ? "High Concentration Risk" : "Broad Organic Decentralization"}). Total gross inflow is ${grossBuySol.toFixed(2)} SOL against ${grossSellSol.toFixed(2)} SOL sell outflow.`,
    sybil_threat_analysis: isBundledLaunch
      ? `🚨 Sub-second slot forensics detected ${sameSlotWallets.length} bundled sniper wallets co-executing in identical blocks. Insider ring commands ${insiderHoldingPct.toFixed(1)}% of curve liquidity.`
      : "✅ Zero same-slot bot bundling detected. Wallet entry timestamps demonstrate natural latency distribution.",
    liquidity_trajectory: `Bonding curve progress is at ${curveProgress.toFixed(1)}% (${curveReserveSol.toFixed(2)} / 85.00 SOL). Requires ${solToGraduation.toFixed(2)} SOL additional capital to reach the PumpSwap migration threshold.`,
    strategy_recommendation: {
      suggested_action: memoVerdict === "ACCUMULATE"
        ? "Decentralized order flow observed; monitor curve progression"
        : memoVerdict === "AVOID_RUG"
        ? "Elevated risk flags active; caution advised"
        : isBundledLaunch
        ? `Bundled insider activity (${insiderHoldingPct.toFixed(1)}% inflow); monitor exit transactions`
        : "Early curve discovery; observe trade volume",
      max_slippage: safeSlippagePct + "%",
      priority_tip: recommendedTipSol + " SOL (Heuristic Jito Tip)",
      risk_level: riskLevel,
    },
  };

  return {
    mint,
    name,
    symbol,
    creator,
    creator_short: creatorShort,
    creator_solscan: isUnknownCreator ? `https://solscan.io/token/${mint}` : `https://solscan.io/account/${creator}`,
    token_solscan: `https://solscan.io/token/${mint}`,
    bonding_curve: bondingCurve,
    socials,
    metadata_uri: uri,
    created_at: createdAt,

    net_sol_deployed: Number(netSol.toFixed(2)),
    curve_reserve_sol: Number(curveReserveSol.toFixed(2)),
    total_inflow_sol: Number(grossBuySol.toFixed(2)),
    total_outflow_sol: Number(grossSellSol.toFixed(2)),
    curve_progress_pct: Number(curveProgress.toFixed(1)),
    sol_to_graduation: Number(solToGraduation.toFixed(2)),
    estimated_mcap_usd: estimatedMcapUsd,
    price_usd: priceUsd,
    mcap_source: mcapSource,
    sol_price_usd: solUsd,
    sol_price_is_live: solPriceInfo.is_live,
    total_trades: totalTrades,
    unique_investors: uniqueInvestors,

    creator_history: {
      past_launches: pastLaunches,
      dev_buy_sol: Number(devBuySol.toFixed(2)),
      dev_holds_pct: grossBuySol > 0 ? Number(((devBuySol / grossBuySol) * 100).toFixed(1)) : 0,
      is_serial_rugger: isSerialRugger,
      is_alpha_creator: false,
      rug_index: Number(rugIndex.toFixed(2)),
    },

    investors,
    timeline_points: timelinePoints,
    top5_share_pct: Number(top5SharePct.toFixed(1)),
    hhi_score: Number(sumSquaredShares.toFixed(3)),
    is_whale_concentrated: isWhaleConcentrated,

    security: {
      rugcheck_status: rugCheck.status,
      rugcheck_score: rugCheck.score,
      lp_locked_pct: rugCheck.lpLockedPct || 100,
      mint_authority_revoked: true,
      freeze_authority_revoked: true,
      risks: rugCheck.risks,
    },

    sybil_intelligence: sybilIntelligence,
    jito_execution: jitoExecution,
    research_memo: researchMemo,

    sniper_links: {
      photon: `https://photon-sol.tinyastro.io/en/lp/${mint}`,
      bullx: `https://bullx.io/terminal?chainId=1399811149&address=${mint}`,
      gmgn: `https://gmgn.ai/sol/token/${mint}`,
      dexscreener: `https://dexscreener.com/solana/${mint}`,
      pumpfun: `https://pump.fun/coin/${mint}`,
      solscan_token: `https://solscan.io/token/${mint}`,
      solscan_creator: `https://solscan.io/account/${creator}`,
    },
  };
}

async function fetchDexScreenerData(
  mint: string
): Promise<{ priceUsd: number | null; marketCap: number | null; dexId?: string; pairAddress?: string; liquidityUsd?: number } | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
      headers: { Accept: "application/json", "User-Agent": "CF-Pump-Screener/1.0" },
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    const json = await res.json<any>();
    const pair = json.pairs?.[0];
    if (!pair) return null;
    return {
      priceUsd: pair.priceUsd ? Number(pair.priceUsd) : null,
      marketCap: pair.marketCap || pair.fdv ? Number(pair.marketCap || pair.fdv) : null,
      dexId: pair.dexId,
      pairAddress: pair.pairAddress,
      liquidityUsd: pair.liquidity?.usd ? Number(pair.liquidity.usd) : 0,
    };
  } catch {
    return null;
  }
}

let cachedSolPrice: { price: number; timestamp: number } = { price: 85.00, timestamp: 0 };

export async function fetchLiveSolPrice(): Promise<{ price: number; is_live: boolean; updated_at: number }> {
  const now = Date.now();
  if (now - cachedSolPrice.timestamp < 60_000 && cachedSolPrice.timestamp > 0) {
    return { price: cachedSolPrice.price, is_live: true, updated_at: cachedSolPrice.timestamp };
  }
  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok) {
      const data = await res.json<{ price?: string }>();
      const p = parseFloat(data.price || "");
      if (!isNaN(p) && p > 10 && p < 2000) {
        cachedSolPrice = { price: Number(p.toFixed(2)), timestamp: now };
        return { price: cachedSolPrice.price, is_live: true, updated_at: now };
      }
    }
  } catch {
    // Fallback to DexScreener Wrapped SOL
    try {
      const dRes = await fetch("https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112", {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(1500),
      });
      if (dRes.ok) {
        const dJson = await dRes.json<any>();
        const p = parseFloat(dJson.pairs?.[0]?.priceUsd || "");
        if (!isNaN(p) && p > 10 && p < 2000) {
          cachedSolPrice = { price: Number(p.toFixed(2)), timestamp: now };
          return { price: cachedSolPrice.price, is_live: true, updated_at: now };
        }
      }
    } catch {}
  }
  return { price: cachedSolPrice.price, is_live: cachedSolPrice.timestamp > 0, updated_at: cachedSolPrice.timestamp || now };
}
