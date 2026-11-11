#!/usr/bin/env node
/**
 * Database Retention & Pruning Script
 * Prunes un-alerted generic events older than N days while safely preserving:
 * - All historical alerts
 * - All trades and on-chain transactions
 * - All tokens that generated alerts or trades
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB_PATH = process.env.DB_PATH || path.resolve(PROJECT_ROOT, "data", "pump_launches.db");

// Parse command line flags
const args = process.argv.slice(2);
const daysArg = args.find((a) => a.startsWith("--days="));
const isDryRun = args.includes("--dry-run");
const shouldVacuum = args.includes("--vacuum");

const retentionDays = daysArg ? parseInt(daysArg.split("=")[1], 10) : 7;
const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

console.log("==================================================");
console.log("  CF-PUMP-SCREENER DB RETENTION & PRUNING UTILITY");
console.log("==================================================");
console.log(`Database:       ${DB_PATH}`);
console.log(`Retention:      ${retentionDays} days`);
console.log(`Cutoff Time:    ${new Date(cutoffMs).toISOString()}`);
console.log(`Dry Run:        ${isDryRun ? "YES (Preview only)" : "NO (Live deletion)"}`);
console.log("--------------------------------------------------");

if (!fs.existsSync(DB_PATH)) {
  console.error("Database file not found at:", DB_PATH);
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH);

// 1. Calculate candidates
const countQuery = `
  SELECT COUNT(*) as cnt
  FROM events
  WHERE received_at < ?
    AND mint NOT IN (SELECT DISTINCT mint FROM alerts)
    AND mint NOT IN (SELECT DISTINCT mint FROM trades)
`;

const countRes = db.prepare(countQuery).get(cutoffMs);
const candidateCount = countRes?.cnt || 0;

console.log(`Found ${candidateCount} un-alerted generic events older than ${retentionDays} days.`);

if (candidateCount === 0) {
  console.log("Nothing to prune. Database is clean!");
} else if (isDryRun) {
  console.log("[Dry Run] Would prune:", candidateCount, "rows.");
} else {
  const deleteQuery = `
    DELETE FROM events
    WHERE received_at < ?
      AND mint NOT IN (SELECT DISTINCT mint FROM alerts)
      AND mint NOT IN (SELECT DISTINCT mint FROM trades)
  `;
  const result = db.prepare(deleteQuery).run(cutoffMs);
  console.log(`Successfully deleted ${result.changes} stale un-alerted rows.`);

  if (shouldVacuum) {
    console.log("Running VACUUM to reclaim disk space (this may take a few seconds)...");
    db.exec("VACUUM;");
    console.log("VACUUM completed.");
  } else {
    db.exec("PRAGMA optimize;");
  }
}

// Current database stats
const totalEvents = db.prepare("SELECT COUNT(*) as c FROM events").get().c;
const totalTrades = db.prepare("SELECT COUNT(*) as c FROM trades").get().c;
const totalAlerts = db.prepare("SELECT COUNT(*) as c FROM alerts").get().c;

console.log("--------------------------------------------------");
console.log(`Active Records:`);
console.log(`  • Events:     ${totalEvents}`);
console.log(`  • Trades:     ${totalTrades}`);
console.log(`  • Alerts:     ${totalAlerts}`);
console.log("==================================================");
