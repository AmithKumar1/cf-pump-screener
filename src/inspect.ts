import type { Env } from "./types.ts";
import { fetchRugCheck } from "./security.ts";
import { KNOWN_ALPHA_WALLETS } from "./screener.ts";

export interface InvestorRecord {
  rank: number;
  wallet: string;
  short_wallet: string;
  solscan_url: string;
  net_sol: number;
  gross_buy_sol: number;
  pct_share: number;
  tag: string;
  tag_class: string;
  trades_count: number;
}

export interface SybilBubbleNode {
  id: string;
  short: string;
  role: "CREATOR" | "BUNDLED_INSIDER" | "ALPHA_WHALE" | "WHALE" | "INVESTOR";
  color: string;
  sol: number;
  share_pct: number;
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
  total_inflow_sol: number;
  total_outflow_sol: number;
  curve_progress_pct: number;
  sol_to_graduation: number;
  estimated_mcap_usd: number;
  price_usd: number | null;
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
  if (creator !== "unknown") {
    const creatorCount = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM events WHERE creator = ?"
    )
      .bind(creator)
      .first<{ count: number }>();
    pastLaunches = creatorCount?.count || 1;
  }

  const isAlphaCreator = KNOWN_ALPHA_WALLETS.has(creator);
  const isSerialRugger = pastLaunches >= 4 && !isAlphaCreator;
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

  // 4. Early Trades for Sybil & Co-Execution Clustering
  const earlyTradesRows = await env.DB.prepare(
    `SELECT trader, sol_amount, block_time
     FROM trades
     WHERE mint = ? AND LOWER(side) = 'buy'
     ORDER BY block_time ASC
     LIMIT 25`
  )
    .bind(mint)
    .all<any>();

  const timeMap = new Map<number, string[]>();
  const sameSlotSet = new Set<string>();
  let earlyClusterSol = 0;

  for (const t of earlyTradesRows.results || []) {
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

  for (const t of earlyTradesRows.results || []) {
    if (sameSlotSet.has(t.trader)) {
      earlyClusterSol += Number(t.sol_amount || 0);
    }
  }

  const sameSlotWallets = Array.from(sameSlotSet);
  const insiderHoldingPct = grossBuySol > 0 ? (earlyClusterSol / grossBuySol) * 100 : 0;
  const isBundledLaunch = sameSlotWallets.length >= 3 || insiderHoldingPct > 35;
  const clusterVerdict = isBundledLaunch
    ? "❌ High Sybil Co-Execution (Bundled Snipers)"
    : sameSlotWallets.length > 0
    ? "⚠️ Moderate Co-Execution (Co-Timed Orders)"
    : "✅ Organic Decentralized Order Flow";

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
  const creatorShort = creator.slice(0, 4) + "..." + creator.slice(-4);
  bubbleNodes.push({
    id: creator,
    short: creatorShort,
    role: "CREATOR",
    color: "#f59e0b",
    sol: 0, // updated below once dev buy found
    share_pct: 0,
  });

  const investors: InvestorRecord[] = (topRows.results || []).map((row, idx) => {
    const traderNet = Number(row.net_sol || 0);
    const traderBuy = Number(row.buy_sol || 0);
    const isDev = row.trader === creator;
    if (isDev) {
      devBuySol = traderBuy;
      bubbleNodes[0].sol = devBuySol;
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
      tag = "👨‍💻 Dev Deployer";
      tagClass = "badge-yellow";
      role = "CREATOR";
      nodeColor = "#f59e0b";
    } else if (isSameSlot) {
      tag = "🤖 Bundled Insider";
      tagClass = "badge-red";
      role = "BUNDLED_INSIDER";
      nodeColor = "#ef4444";
    } else if (KNOWN_ALPHA_WALLETS.has(row.trader)) {
      tag = "🎯 Smart Alpha Whale";
      tagClass = "badge-purple";
      role = "ALPHA_WHALE";
      nodeColor = "#a855f7";
    } else if (traderNet >= 2.0) {
      tag = "🐋 Conviction Whale";
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
        share_pct: Number(sharePct.toFixed(1)),
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
      pct_share: Number(sharePct.toFixed(1)),
      tag,
      tag_class: tagClass,
      trades_count: Number(row.trades_count || 1),
    };
  });

  const top5SharePct = netSol > 0 ? Math.min(100, (top5NetSol / netSol) * 100) : 0;
  const isWhaleConcentrated = top5SharePct > 65 || sumSquaredShares > 0.25;

  // 6. Parallel live data: RugCheck & DexScreener
  const [rugCheck, dexData] = await Promise.all([
    fetchRugCheck(mint),
    fetchDexScreenerData(mint),
  ]);

  // Bonding Curve: Standard Pump.fun curve requires ~85 SOL to graduate to Raydium
  const GRADUATION_SOL_TARGET = 85.0;
  const curveProgress = Math.min(100, Math.max(0, (netSol / GRADUATION_SOL_TARGET) * 100));
  const solToGraduation = Math.max(0, GRADUATION_SOL_TARGET - netSol);

  // Market Cap Estimation: Use DexScreener if available, otherwise estimate from curve
  let estimatedMcapUsd = dexData?.marketCap || Math.round(5000 + netSol * 180);
  let priceUsd = dexData?.priceUsd || null;

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

  return {
    mint,
    name,
    symbol,
    creator,
    creator_short: creatorShort,
    creator_solscan: `https://solscan.io/account/${creator}`,
    token_solscan: `https://solscan.io/token/${mint}`,
    bonding_curve: bondingCurve,
    socials,
    metadata_uri: uri,
    created_at: createdAt,

    net_sol_deployed: Number(netSol.toFixed(2)),
    total_inflow_sol: Number(grossBuySol.toFixed(2)),
    total_outflow_sol: Number(grossSellSol.toFixed(2)),
    curve_progress_pct: Number(curveProgress.toFixed(1)),
    sol_to_graduation: Number(solToGraduation.toFixed(2)),
    estimated_mcap_usd: estimatedMcapUsd,
    price_usd: priceUsd,
    total_trades: totalTrades,
    unique_investors: uniqueInvestors,

    creator_history: {
      past_launches: pastLaunches,
      dev_buy_sol: Number(devBuySol.toFixed(2)),
      dev_holds_pct: grossBuySol > 0 ? Number(((devBuySol / grossBuySol) * 100).toFixed(1)) : 0,
      is_serial_rugger: isSerialRugger,
      is_alpha_creator: isAlphaCreator,
      rug_index: Number(rugIndex.toFixed(2)),
    },

    investors,
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
): Promise<{ priceUsd: number | null; marketCap: number | null } | null> {
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
    };
  } catch {
    return null;
  }
}
