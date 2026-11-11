-- Cloudflare D1 Schema for Pump.fun Screener & Monitor

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    received_at INTEGER NOT NULL,
    kind TEXT NOT NULL,
    mint TEXT NOT NULL,
    creator TEXT NOT NULL,
    bonding_curve TEXT,
    name TEXT,
    symbol TEXT,
    uri TEXT,
    twitter TEXT,
    telegram TEXT,
    website TEXT,
    raw_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_mint ON events(mint);
CREATE INDEX IF NOT EXISTS idx_events_creator ON events(creator);
CREATE INDEX IF NOT EXISTS idx_events_received ON events(received_at);

CREATE TABLE IF NOT EXISTS trades (
    signature TEXT PRIMARY KEY,
    mint TEXT NOT NULL,
    side TEXT NOT NULL,
    trader TEXT NOT NULL,
    sol_amount REAL NOT NULL,
    token_amount REAL NOT NULL,
    block_time INTEGER
);

CREATE INDEX IF NOT EXISTS idx_trades_mint ON trades(mint);
CREATE INDEX IF NOT EXISTS idx_trades_mint_time ON trades(mint, block_time ASC);
CREATE INDEX IF NOT EXISTS idx_trades_trader ON trades(trader);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mint TEXT NOT NULL,
    symbol TEXT NOT NULL,
    score REAL NOT NULL,
    net_sol REAL NOT NULL,
    unique_buyers INTEGER NOT NULL,
    buyer_hhi REAL NOT NULL,
    flags TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alerts_mint ON alerts(mint);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at);

CREATE TABLE IF NOT EXISTS health_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
