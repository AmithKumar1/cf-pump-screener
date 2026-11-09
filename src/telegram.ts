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
  curveProgress: number
): string {
  const flagsStr = flags.length > 0 ? flags.join(" | ") : "Clean";
  const devStatus = devSold ? "❌ DUMPED" : "✅ Holding";

  return [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🚀 PUMP SCREENER SIGNAL: ${name} ($${symbol})`,
    `Score: ${score.toFixed(0)}/100 | Dev: ${devStatus}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📍 Mint: ${mint}`,
    `👤 Dev: ${creator.slice(0, 10)}...`,
    ``,
    `📊 On-Chain Metrics:`,
    `  • Net SOL Raised: ${netSol.toFixed(2)} SOL`,
    `  • Unique Buyers: ${buyers} | HHI: ${hhi.toFixed(3)}`,
    `  • Curve Progress: ${curveProgress.toFixed(1)}% to Raydium`,
    ``,
    `🏷️ Flags: ${flagsStr}`,
    ``,
    `🔗 Charts:`,
    `  • https://dexscreener.com/solana/${mint}`,
    `  • https://pump.fun/coin/${mint}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].join("\n");
}
