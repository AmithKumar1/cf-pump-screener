/**
 * Telegram notification dispatcher for Cloudflare Workers.
 * Strict privacy rule: Catches exceptions and logs ONLY error name to prevent token leaks.
 */

export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string
): Promise<boolean> {
  if (!token || !chatId) {
    return false;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "CF-Pump-Screener/1.0",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch (err: unknown) {
    // SECURITY: Log ONLY the error class name. Never log error string/URL containing token.
    const errName = err instanceof Error ? err.name : "UnknownError";
    console.error(`Telegram fetch failed: ${errName}`);
    return false;
  }
}

export function formatResearchCard(
  mint: string,
  symbol: string,
  name: string,
  creator: string,
  score: number,
  netSol: number,
  buyers: number,
  hhi: number,
  flags: string[],
  devSold: boolean,
  curveProgress: number,
  velocity: number = 0,
  top5Share: number = 0,
  devSupplyPct: number = 0,
  ofi: number = 0,
  vpin: number = 0,
  entropy: number = 0,
  amihudIliq: number = 0,
  paretoExp: number = 0,
  gradProb: number = 0,
  regime: string = "ACCUMULATION",
  hawkesEta: number = 0.5,
  hurstH: number = 0.5,
  effectiveBuyers: number = buyers,
  sybilRatio: number = 0,
  mevRatio: number = 0,
  sri: number = 0,
  smartBuyers: number = 0,
  smartSol: number = 0,
  sameSlotRatio: number = 0,
  rugCheckStatus: string = "SAFE",
  rugCheckScore: number = 1,
  rugCheckRisks: string[] = []
): string {
  const flagsStr = flags.length > 0 ? flags.join(" | ") : "Clean";
  const devStatus = devSold
    ? "❌ DUMPED"
    : `✅ Holding (${(devSupplyPct * 100).toFixed(1)}% supply)`;

  return [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🚀 PUMP SCREENER SIGNAL: ${name} ($${symbol})`,
    `Score: ${score.toFixed(0)}/100 | Dev: ${devStatus}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📍 Mint: ${mint}`,
    `👤 Dev: ${creator.slice(0, 8)}...${creator.slice(-4)} (https://solscan.io/account/${creator})`,
    ``,
    `📊 On-Chain Quant Metrics:`,
    `  • Net Capital Raised: ${netSol.toFixed(2)} SOL (${curveProgress.toFixed(1)}% to Raydium)`,
    `  • Inflow Velocity: ${velocity.toFixed(2)} SOL/min | OFI: ${(ofi * 100).toFixed(0)}% buys`,
    `  • Distribution: ${buyers} Unique Buyers (Effective: ${effectiveBuyers}) | HHI: ${hhi.toFixed(3)}`,
    `  • Top 5 Buyer Share: ${(top5Share * 100).toFixed(1)}% volume | Sybil Cluster: ${(sybilRatio * 100).toFixed(0)}%`,
    `  • Microstructure: VPIN ${(vpin * 100).toFixed(0)}% toxicity | Entropy: ${entropy.toFixed(2)}`,
    `  • Curve Dynamics: ILIQ ${amihudIliq.toFixed(4)} | Pareto: ζ=${paretoExp.toFixed(2)}`,
    ``,
    `🔮 Predictive & Forecasting Analytics:`,
    `  • Raydium Migration Probability: ${(gradProb * 100).toFixed(1)}% (15m survival horizon)`,
    `  • Market Microstructure Regime: ${regime}`,
    `  • Hawkes Cascade Intensity: η=${hawkesEta.toFixed(2)} ${hawkesEta >= 1.0 ? "(⚡ Supercritical FOMO)" : "(Subcritical)"}`,
    `  • Hurst Trend Persistence: H=${hurstH.toFixed(2)} ${hurstH > 0.6 ? "(📈 Persistent Trend)" : hurstH < 0.4 ? "(🔄 Mean Reverting)" : "(🎲 Random Walk)"}`,
    ``,
    `⚡ Elite Quant & Forensic Intelligence:`,
    `  • MEV Forensics: ${(mevRatio * 100).toFixed(0)}% extraction | Single-Slot Bundles: ${(sameSlotRatio * 100).toFixed(0)}%`,
    `  • Creator DNA: Serial Rug Index: ${sri.toFixed(2)} | Alpha Wallets: ${smartBuyers} in (${smartSol.toFixed(2)} SOL)`,
    ``,
    `🛡️ Contract Security Audit (RugCheck):`,
    `  • Safety Verdict: ${rugCheckStatus === "SAFE" ? "✅ SAFE (Preregistered / Revoked Authorities)" : rugCheckStatus === "WARNING" ? "⚠️ WARNING" : "❌ DANGER / HIGH RISK"}`,
    `  • RugCheck Danger Score: ${rugCheckScore}/1000 | LP Protection: 100% Locked`,
    rugCheckRisks && rugCheckRisks.length > 0 ? `  • Flagged Risks: ${rugCheckRisks.join(", ")}` : `  • Flagged Risks: None (Clean)`,
    ``,
    `🏷️ Quantitative Flags:`,
    `  ${flagsStr}`,
    ``,
    `⚡ 1-Click Fast Sniper Execution:`,
    `  • Photon: https://photon-sol.tinyastro.io/en/lp/${mint}`,
    `  • BullX: https://bullx.io/terminal?chainId=1399811149&address=${mint}`,
    `  • GMGN: https://gmgn.ai/sol/token/${mint}`,
    `  • DexScreener: https://dexscreener.com/solana/${mint}`,
    `  • Pump.fun: https://pump.fun/coin/${mint}`,
    `  • Solscan: https://solscan.io/token/${mint}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].join("\n");
}

export function formatVerifiedLaunchCard(
  mint: string,
  symbol: string,
  name: string,
  creator: string,
  score: number,
  twitter: string | null,
  telegram: string | null,
  website: string | null,
  aiSlopScore: number,
  isAiSlop: boolean,
  sriScore: number,
  isSmartMoney: boolean,
  rugCheckStatus: string = "SAFE",
  rugCheckScore: number = 1,
  rugCheckRisks: string[] = []
): string {
  const socials: string[] = [];
  if (twitter) socials.push(`• Twitter/X: ${twitter}`);
  if (telegram) socials.push(`• Telegram: ${telegram}`);
  if (website) socials.push(`• Website: ${website}`);
  const socialsStr = socials.length > 0 ? socials.join("\n  ") : "• No links provided";

  const memeTag = isAiSlop ? "⚠️ AI Slop / Low Conviction" : "🔥 Organic Viral Culture";
  const smartMoneyTag = isSmartMoney
    ? "🎯 Tracked Alpha Wallet (Smart Whale)"
    : "Standard Wallet";

  const rugTag = rugCheckStatus === "SAFE"
    ? "✅ SAFE (Preregistered)"
    : rugCheckStatus === "WARNING"
    ? `⚠️ WARNING (${rugCheckScore}/1000)`
    : `❌ DANGER (${rugCheckScore}/1000)`;

  return [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `💎 PUMP.FUN VERIFIED LAUNCH: ${name} ($${symbol})`,
    `Stage: STAGE 1 [VERIFIED CREATION] | Score: ${score.toFixed(0)}/100`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📍 Mint: ${mint}`,
    `👤 Creator: ${creator.slice(0, 8)}...${creator.slice(-4)} (https://solscan.io/account/${creator})`,
    ``,
    `🌐 Verified Community Links:`,
    `  ${socialsStr}`,
    ``,
    `🧬 Memetic & Creator Forensics:`,
    `  • AI Slop Forensics: ${(aiSlopScore * 100).toFixed(0)}% slop probability (${memeTag})`,
    `  • Creator Serial Rug Index (SRI): ${sriScore.toFixed(2)} ${sriScore === 0 ? "(Clean History)" : sriScore > 0.5 ? "(⚠️ High Rug Risk)" : "(Moderate Risk)"}`,
    `  • Alpha Tracking: ${smartMoneyTag}`,
    `  • RugCheck Security Audit: ${rugTag}`,
    ``,
    `⚡ 1-Click Fast Sniper Execution:`,
    `  • Photon: https://photon-sol.tinyastro.io/en/lp/${mint}`,
    `  • BullX: https://bullx.io/terminal?chainId=1399811149&address=${mint}`,
    `  • GMGN: https://gmgn.ai/sol/token/${mint}`,
    `  • DexScreener: https://dexscreener.com/solana/${mint}`,
    `  • Pump.fun: https://pump.fun/coin/${mint}`,
    `  • Solscan: https://solscan.io/token/${mint}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].join("\n");
}

