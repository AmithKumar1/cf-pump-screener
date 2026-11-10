/**
 * Automated RugCheck Security Audit Integration.
 * Queries RugCheck.xyz public REST API to verify contract safety, mint/freeze authorities,
 * and liquidity pool lock status.
 */

export interface RugCheckSummary {
  success: boolean;
  score: number;
  status: "SAFE" | "WARNING" | "DANGER";
  risks: string[];
  lpLockedPct: number;
}

export async function fetchRugCheck(mint: string): Promise<RugCheckSummary> {
  try {
    const res = await fetch(`https://api.rugcheck.xyz/v1/tokens/${mint}/report/summary`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "CF-Pump-Screener/1.0",
      },
      signal: AbortSignal.timeout(2500),
    });

    if (!res.ok) {
      return { success: false, score: 0, status: "SAFE", risks: [], lpLockedPct: 0 };
    }

    const data = await res.json<any>();
    const score = Number(data.score || 0);
    const risks = Array.isArray(data.risks) ? data.risks.map((r: any) => r.name || String(r)) : [];
    const lpLockedPct = Number(data.lpLockedPct || 0);

    let status: "SAFE" | "WARNING" | "DANGER" = "SAFE";
    if (score > 1500 || risks.some((r: string) => r.toLowerCase().includes("danger") || r.toLowerCase().includes("mutable"))) {
      status = "DANGER";
    } else if (score > 500 || risks.length > 0) {
      status = "WARNING";
    }

    return {
      success: true,
      score,
      status,
      risks,
      lpLockedPct,
    };
  } catch {
    // Graceful fallback if RugCheck API is slow, rate-limited, or unreachable
    return { success: false, score: 0, status: "SAFE", risks: [], lpLockedPct: 0 };
  }
}
