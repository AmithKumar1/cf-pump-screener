import { resolveMetadataForToken, evaluateTokenForSignal } from "./index.ts";
import type { Env } from "./types.ts";

export interface PumpPortalLaunchMessage {
  txType: "create";
  signature: string;
  mint: string;
  traderPublicKey: string;
  initialBuy?: number;
  solAmount?: number;
  bondingCurveKey?: string;
  vTokensInBondingCurve?: number;
  vSolInBondingCurve?: number;
  marketCapSol?: number;
  name: string;
  symbol: string;
  uri: string;
  pool?: string;
}

export interface PumpPortalTradeMessage {
  txType: "buy" | "sell";
  signature: string;
  mint: string;
  traderPublicKey: string;
  solAmount: number;
  tokenAmount: number;
  bondingCurveKey?: string;
  marketCapSol?: number;
}

export class PumpPortalFeed {
  private ws: any = null;
  private isRunning: boolean = false;
  private reconnectTimeout: any = null;
  private env: Env;
  private trackedMints: Set<string> = new Set();
  private maxTrackedMints: number = 200;

  constructor(env: Env) {
    this.env = env;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.connect();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    console.log("[PumpPortal Feed] Stopped.");
  }

  private connect(): void {
    if (!this.isRunning) return;

    try {
      console.log("[PumpPortal Feed] Connecting to wss://pumpportal.fun/api/data...");
      // @ts-ignore
      this.ws = new WebSocket("wss://pumpportal.fun/api/data");

      this.ws.addEventListener("open", () => {
        console.log("[PumpPortal Feed] Connected! Subscribing to token creations...");
        this.ws?.send(JSON.stringify({ method: "subscribeNewToken" }));

        // Resubscribe to tracked mints for trades if any
        if (this.trackedMints.size > 0) {
          this.ws?.send(
            JSON.stringify({
              method: "subscribeTokenTrade",
              keys: Array.from(this.trackedMints),
            })
          );
        }
      });

      this.ws.addEventListener("message", async (event: any) => {
        try {
          const raw = typeof event.data === "string" ? event.data : event.data.toString();
          const msg = JSON.parse(raw);
          await this.handleMessage(msg, raw);
        } catch {
          // Ignore malformed message frames
        }
      });

      this.ws.addEventListener("error", (err: any) => {
        console.warn("[PumpPortal Feed] Connection error:", err?.message || "error");
      });

      this.ws.addEventListener("close", () => {
        console.log("[PumpPortal Feed] Connection closed.");
        this.ws = null;
        if (this.isRunning) {
          this.reconnectTimeout = setTimeout(() => this.connect(), 3000);
        }
      });
    } catch (err: unknown) {
      console.error("[PumpPortal Feed] Setup exception:", err);
      if (this.isRunning) {
        this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
      }
    }
  }

  private async handleMessage(msg: any, rawJson: string): Promise<void> {
    const now = Date.now();

    // 1. Handle New Token Creation
    if (msg.txType === "create" && msg.mint) {
      const launch = msg as PumpPortalLaunchMessage;
      try {
        await this.env.DB.prepare(
          `INSERT OR IGNORE INTO events
           (received_at, kind, mint, creator, bonding_curve, name, symbol, uri, raw_json)
           VALUES (?, 'new_token', ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            now,
            launch.mint,
            launch.traderPublicKey || "unknown",
            launch.bondingCurveKey || null,
            launch.name || null,
            launch.symbol || null,
            launch.uri || null,
            rawJson
          )
          .run();

        console.log(`[PumpPortal] New Launch: ${launch.symbol || "???"} (${launch.mint.slice(0, 8)}...)`);

        // Record creator's initial buy trade if present
        if (launch.solAmount && launch.solAmount > 0) {
          await this.env.DB.prepare(
            `INSERT OR IGNORE INTO trades (signature, mint, side, trader, sol_amount, token_amount, block_time)
             VALUES (?, ?, 'buy', ?, ?, ?, ?)`
          )
            .bind(
              launch.signature || `init_${launch.mint}`,
              launch.mint,
              launch.traderPublicKey || "unknown",
              launch.solAmount,
              launch.initialBuy || 0,
              Math.floor(now / 1000)
            )
            .run();
        }

        // Track trades for this newly created mint (capped at maxTrackedMints)
        if (this.trackedMints.size >= this.maxTrackedMints) {
          const oldest = this.trackedMints.values().next().value;
          if (oldest) this.trackedMints.delete(oldest);
        }
        this.trackedMints.add(launch.mint);

        if (this.ws && this.ws.readyState === 1) {
          this.ws.send(JSON.stringify({ method: "subscribeTokenTrade", keys: [launch.mint] }));
        }

        // Resolve off-chain metadata & socials asynchronously
        if (launch.uri) {
          resolveMetadataForToken(launch.mint, launch.uri, this.env).catch((err: any) => {
            console.error(`[Metadata] Failed for ${launch.mint}:`, err?.message || err);
          });
        }
      } catch (err: unknown) {
        console.error(`[DB Error] Insert new token ${launch.mint}:`, err);
      }
      return;
    }

    // 2. Handle Trades (Buy / Sell)
    if ((msg.txType === "buy" || msg.txType === "sell") && msg.mint && msg.signature) {
      const trade = msg as PumpPortalTradeMessage;
      try {
        await this.env.DB.prepare(
          `INSERT OR IGNORE INTO trades (signature, mint, side, trader, sol_amount, token_amount, block_time)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            trade.signature,
            trade.mint,
            trade.txType,
            trade.traderPublicKey || "unknown",
            trade.solAmount || 0,
            trade.tokenAmount || 0,
            Math.floor(now / 1000)
          )
          .run();

        // Trigger quantitative screener evaluation for high-conviction signals
        evaluateTokenForSignal(trade.mint, this.env).catch((err: any) => {
          console.error(`[Screener Error] Evaluating ${trade.mint}:`, err?.message || err);
        });
      } catch (err: unknown) {
        console.error(`[DB Error] Insert trade ${trade.signature}:`, err);
      }
    }
  }
}
