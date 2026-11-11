export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  MIN_ALERT_SCORE?: string;
  WEBHOOK_SECRET?: string;
  PAUSE_TELEGRAM_ALERTS?: string;
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
  slot?: number;
}

export interface TradePoint {
  signature: string;
  mint: string;
  side: "buy" | "sell";
  trader: string;
  sol_amount: number;
  token_amount: number;
  block_time?: number;
  slot?: number;
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
  // Advanced Quantitative & Microstructure Theorems
  vpin: number;
  amihud_iliq: number;
  shannon_entropy: number;
  kyle_lambda: number;
  pareto_exponent: number;
  // Predictive Microstructure & Stochastic Models
  hawkes_branching_ratio: number;
  is_supercritical_fomo: boolean;
  graduation_probability: number;
  hurst_exponent: number;
  hurst_regime: "TRENDING" | "RANDOM_WALK" | "MEAN_REVERTING";
  market_regime: "ACCUMULATION" | "MARKUP_FRENZY" | "DISTRIBUTION_EXIT";
  distribution_risk_pct: number;
  sybil_cluster_ratio: number;
  effective_unique_buyers: number;
  // Frontier Quantitative Intelligence
  mev_extraction_ratio: number;
  is_mev_sandwiched: boolean;
  serial_rug_index: number;
  same_slot_bundle_ratio: number;
  slot_velocity: number;
  ai_slop_score: number;
  is_ai_slop: boolean;
  smart_money_buyers: number;
  smart_money_sol: number;
  is_smart_money_in: boolean;
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
