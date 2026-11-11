import { test, describe } from "node:test";
import assert from "node:assert";
import { LocalD1Database } from "../src/local_db.ts";

describe("Local D1 SQLite Database Adapter", () => {
  test("successfully executes queries against local SQLite database", async () => {
    const db = new LocalD1Database();

    const maxRow = await db.prepare("SELECT MAX(id) as max_id FROM events").first<{ max_id: number }>();
    assert(maxRow !== null, "maxRow should not be null");
    assert(maxRow.max_id > 20000, `Expected max_id > 20000, got ${maxRow.max_id}`);

    const tradeRow = await db.prepare("SELECT COUNT(*) as cnt FROM trades").first<{ cnt: number }>();
    assert(tradeRow !== null, "tradeRow should not be null");
    assert(tradeRow.cnt > 5000, `Expected trades > 5000, got ${tradeRow.cnt}`);

    const recent = await db.prepare(
      "SELECT id, mint, symbol, strftime('%Y-%m-%dT%H:%M:%SZ', received_at/1000, 'unixepoch') as time_utc FROM events ORDER BY id DESC LIMIT 5"
    ).all<{ id: number; mint: string; symbol: string; time_utc: string }>();

    assert.strictEqual(recent.success, true);
    assert.strictEqual(recent.results.length, 5);
    assert(recent.results[0].time_utc.endsWith("Z"), "time_utc should end with Z");

    db.close();
  });
});
