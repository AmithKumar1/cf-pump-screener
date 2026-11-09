export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  MIN_ALERT_SCORE?: string;
  WEBHOOK_SECRET?: string;
}

export interface LaunchMetadata {
  name?: string;
  symbol?: string;
  uri?: string;
  twitter?: string | null;
  telegram?: string | null;
  website?: string | null;
  description?: string | null;
  metadata_available?: boolean;
}

export interface LaunchCandidate {
  id?: number;
  received_at: number;
  kind: string;
  mint: string;
  creator: string;
  bonding_curve?: string;
  metadata: LaunchMetadata;
  raw_json?: string;
}

export interface TradePoint {
  signature: string;
  mint: string;
  side: "buy" | "sell";
  trader: string;
  sol_amount: number;
  token_amount: number;
  block_time?: number;
}

export interface TokenMetrics {
  total_trades: number;
  buy_count: number;
  sell_count: number;
  net_sol_raised: number;
  gross_volume_sol: number;
  unique_buyers: number;
  unique_sellers: number;
  buyer_hhi: number;
  top_buyer_share: number;
  top5_buyer_share: number;
  dev_sold: boolean;
  dev_dump_pct: number;
  dev_token_balance: number;
  dev_supply_pct: number;
  curve_progress_pct: number;
  elapsed_seconds: number;
  sol_velocity_per_min: number;
  order_flow_imbalance: number;
}

export interface ScoreResult {
  total_score: number;
  decentralization_score: number;
  momentum_score: number;
  creator_trust_score: number;
  metadata_score: number;
  flags: string[];
  is_high_interest: boolean;
}
