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
 * Partial SSRF Defense: Validate HTTPS scheme and block loopback, RFC1918 IP literals, and localhost.
 * Note: Cloudflare Workers fetch does not expose pre-connect DNS resolution, so hostnames
 * resolving to private IPs via external DNS are not caught by string-level URL parsing.
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

// In-memory cache for immutable IPFS/URI metadata (content-addressed CIDs never change)
const METADATA_CACHE = new Map<string, { result: ParsedSocials; ts: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour TTL

/**
 * Fetch off-chain token metadata with strict bounds:
 * - In-memory cache for immutable content-addressed IPFS CIDs
 * - 3000ms timeout
 * - 15 KB body cap
 * - Safe redirect following for public HTTPS targets (up to 3 hops, re-validating every hop)
 * - Multi-gateway IPFS fallback: Pinata -> Filebase with backoff
 * - Safe text extraction
 */
export async function fetchTokenMetadata(uri: string): Promise<ParsedSocials> {
  const MAX_BYTES = 15360; // 15 KB cap

  if (!uri || !isSafeMetadataUrl(uri)) {
    return {
      success: false,
      isAvailable: false,
      error: "INVALID_OR_UNSAFE_URI",
    };
  }

  // Check in-memory cache
  const cached = METADATA_CACHE.get(uri);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.result;
  }

  // Detect IPFS CID (v0 Qm... or v1 bafk...)
  const ipfsMatch = uri.match(/(?:ipfs\/|ipfs:\/\/)(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafk[a-z0-9]{55})/i);
  const candidates: string[] = [];

  if (ipfsMatch && ipfsMatch[1]) {
    const cid = ipfsMatch[1];
    // Fast gateway first (Filebase ~250ms), fallback to Pinata
    candidates.push(`https://ipfs.filebase.io/ipfs/${cid}`);
    candidates.push(`https://gateway.pinata.cloud/ipfs/${cid}`);
  } else {
    candidates.push(uri);
  }

  let lastError = "METADATA_UNRESOLVABLE";

  for (const targetUri of candidates) {
    if (!targetUri || !isSafeMetadataUrl(targetUri)) continue;

    // Retry loop with light backoff (max 2 attempts per candidate)
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 150 * attempt));
      }

      try {
        let currentUrl = targetUri;
        let finalRes: Response | null = null;

        // Safe redirect hop limit (up to 3 hops, re-checking isSafeMetadataUrl on each hop)
        for (let hop = 0; hop < 3; hop++) {
          const res = await fetch(currentUrl, {
            method: "GET",
            headers: {
              Accept: "application/json",
              "User-Agent": "CF-Pump-Screener/1.0",
            },
            redirect: "manual",
            signal: AbortSignal.timeout(2500),
          });

          if (res.status >= 300 && res.status < 400) {
            const loc = res.headers.get("location");
            if (!loc) break;
            const nextUrl = new URL(loc, currentUrl).toString();
            if (!isSafeMetadataUrl(nextUrl)) {
              return {
                success: false,
                isAvailable: false,
                error: "REDIRECT_TO_UNSAFE_HOST",
              };
            }
            currentUrl = nextUrl;
            continue;
          }

          finalRes = res;
          break;
        }

        if (!finalRes || !finalRes.ok) {
          if (finalRes) {
            lastError = `HTTP_${finalRes.status}`;
            if (finalRes.status === 429 || finalRes.status >= 500) {
              // Rate limited or server error: retry with backoff or switch candidate
              continue;
            }
          }
          break;
        }

        const text = await finalRes.text();
        if (text.length > MAX_BYTES) {
          return {
            success: false,
            isAvailable: false,
            error: "OVERSIZE_BODY_EXCEEDS_15KB",
          };
        }

        const data = JSON.parse(text);
        if (!data || typeof data !== "object") continue;

        const sanitize = (val: unknown): string | null => {
          if (typeof val !== "string") return null;
          const trimmed = val.trim();
          return trimmed.length > 0 ? trimmed.slice(0, 250) : null;
        };

        const parsedResult: ParsedSocials = {
          success: true,
          isAvailable: true,
          name: sanitize(data.name) || undefined,
          symbol: sanitize(data.symbol) || undefined,
          twitter: sanitize(data.twitter),
          telegram: sanitize(data.telegram),
          website: sanitize(data.website),
          description: sanitize(data.description),
        };

        // Cache successful resolution
        METADATA_CACHE.set(uri, { result: parsedResult, ts: Date.now() });
        return parsedResult;
      } catch (err: unknown) {
        const errName = err instanceof Error ? err.name : "FetchError";
        lastError = errName;
        continue;
      }
    }
  }

  const failedResult: ParsedSocials = {
    success: false,
    isAvailable: false,
    error: lastError,
  };
  // Cache negative result briefly (30s) to avoid repeated spamming of failed URIs
  METADATA_CACHE.set(uri, { result: failedResult, ts: Date.now() - CACHE_TTL_MS + 30000 });
  return failedResult;
}
