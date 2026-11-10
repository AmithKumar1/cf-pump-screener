/**
 * Defensive, SSRF-hardened off-chain metadata fetcher for Pump.fun tokens.
 */

export interface ParsedSocials {
  success: boolean;
  isAvailable: boolean;
  name?: string;
  symbol?: string;
  twitter?: string | null;
  telegram?: string | null;
  website?: string | null;
  description?: string | null;
  error?: string;
}

const PRIVATE_IP_REGEX = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|169\.254\.|0\.|::1|fe80:)/i;

/**
 * Validate that a URL is safe to fetch (HTTPS only, no private IPs, no localhost).
 */
export function isSafeMetadataUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    const cleanHost = host.replace(/^\[|\]$/g, "");
    if (
      cleanHost === "localhost" ||
      cleanHost === "127.0.0.1" ||
      cleanHost === "::1" ||
      cleanHost === "0.0.0.0"
    ) {
      return false;
    }
    if (PRIVATE_IP_REGEX.test(cleanHost)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch off-chain token metadata with strict bounds:
 * - 3000ms timeout
 * - 15 KB body cap
 * - No redirects followed (prevent SSRF redirect bypasses)
 * - Safe text extraction
 */
export async function fetchTokenMetadata(uri: string): Promise<ParsedSocials> {
  // Normalize deprecated ipfs.io gateway to high-performance Pinata IPFS gateway
  let targetUri = uri;
  if (targetUri.includes("ipfs.io/ipfs/")) {
    targetUri = targetUri.replace("https://ipfs.io/ipfs/", "https://gateway.pinata.cloud/ipfs/");
  }

  if (!targetUri || !isSafeMetadataUrl(targetUri)) {
    return {
      success: false,
      isAvailable: false,
      error: "INVALID_OR_UNSAFE_URI",
    };
  }

  const MAX_BYTES = 15360; // 15 KB cap

  try {
    const res = await fetch(targetUri, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "CF-Pump-Screener/1.0",
      },
      redirect: "error", // Do not follow redirects
      signal: AbortSignal.timeout(3000), // 3.0 second timeout
    });

    if (!res.ok) {
      return {
        success: false,
        isAvailable: false,
        error: `HTTP_${res.status}`,
      };
    }

    // Read response with strict byte size limit
    const text = await res.text();
    if (text.length > MAX_BYTES) {
      return {
        success: false,
        isAvailable: false,
        error: "OVERSIZE_BODY_EXCEEDS_15KB",
      };
    }

    const data = JSON.parse(text);

    const sanitize = (val: unknown): string | null => {
      if (typeof val !== "string") return null;
      const trimmed = val.trim();
      return trimmed.length > 0 ? trimmed.slice(0, 250) : null;
    };

    return {
      success: true,
      isAvailable: true,
      name: sanitize(data.name) || undefined,
      symbol: sanitize(data.symbol) || undefined,
      twitter: sanitize(data.twitter),
      telegram: sanitize(data.telegram),
      website: sanitize(data.website),
      description: sanitize(data.description),
    };
  } catch (err: unknown) {
    const errName = err instanceof Error ? err.name : "FetchError";
    return {
      success: false,
      isAvailable: false,
      error: errName,
    };
  }
}
