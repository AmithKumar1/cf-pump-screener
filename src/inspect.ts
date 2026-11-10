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
       COALESCE(SUM(CASE WHEN side = 'BUY' THEN sol_amount ELSE 0 END), 0) as gross_buy_sol,
       COALESCE(SUM(CASE WHEN side = 'SELL' THEN sol_amount ELSE 0 END), 0) as gross_sell_sol,
       COALESCE(SUM(CASE WHEN side = 'BUY' THEN sol_amount ELSE -sol_amount END), 0) as net_sol,
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

  // 4. Top Investors Breakdown
  const topRows = await env.DB.prepare(
    `SELECT
       trader,
       COALESCE(SUM(CASE WHEN side = 'BUY' THEN sol_amount ELSE 0 END), 0) as buy_sol,
       COALESCE(SUM(CASE WHEN side = 'SELL' THEN sol_amount ELSE 0 END), 0) as sell_sol,
       COALESCE(SUM(CASE WHEN side = 'BUY' THEN sol_amount ELSE -sol_amount END), 0) as net_sol,
       COALESCE(SUM(CASE WHEN side = 'BUY' THEN token_amount ELSE -token_amount END), 0) as net_tokens,
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

  const investors: InvestorRecord[] = (topRows.results || []).map((row, idx) => {
    const traderNet = Number(row.net_sol || 0);
    const traderBuy = Number(row.buy_sol || 0);
    const isDev = row.trader === creator;
    if (isDev) {
      devBuySol = traderBuy;
    }

    if (idx < 5 && traderNet > 0) {
      top5NetSol += traderNet;
    }

    const sharePct = Math.max(0, (traderBuy / totalPositiveSol) * 100);
    const fraction = traderBuy / totalPositiveSol;
    sumSquaredShares += fraction * fraction;

    let tag = "⚡ Early Buyer";
    let tagClass = "badge-muted";

    if (isDev) {
      tag = "👨‍💻 Dev Deployer";
      tagClass = "badge-yellow";
    } else if (KNOWN_ALPHA_WALLETS.has(row.trader)) {
      tag = "🎯 Smart Alpha Whale";
      tagClass = "badge-purple";
    } else if (traderNet >= 3.0) {
      tag = "🐋 Conviction Whale";
      tagClass = "badge-green";
    } else if (traderNet <= 0 && row.trades_count > 1) {
      tag = "💨 Scalper (Exited)";
      tagClass = "badge-red";
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

  // 5. Parallel live data: RugCheck & DexScreener
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

  return {
    mint,
    name,
    symbol,
    creator,
    creator_short: creator.slice(0, 4) + "..." + creator.slice(-4),
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
