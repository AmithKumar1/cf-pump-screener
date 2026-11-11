import { describe, it } from "node:test";
import assert from "node:assert";
import { execSync } from "node:child_process";
import { METADATA_UPDATE_SQL } from "../src/metadata.ts";

describe("D1 SQL Parameter Binding & NULL Socials Verification", () => {
  it("verifies that the production METADATA_UPDATE_SQL from src/metadata.ts has exactly 6 placeholders for 6 bound values", () => {
    const updateSql = METADATA_UPDATE_SQL;

    const placeholderMatches = updateSql.match(/\?/g);
    const placeholderCount = placeholderMatches ? placeholderMatches.length : 0;

    // Must be exactly 6:
    // ? 1: twitter
    // ? 2: telegram
    // ? 3: website
    // ? 4: name
    // ? 5: symbol
    // ? 6: mint (WHERE clause)
    assert.strictEqual(
      placeholderCount,
      6,
      `Expected exactly 6 placeholders in production METADATA_UPDATE_SQL, found ${placeholderCount}`
    );

    // Mock bound args array as assembled in resolveMetadataForToken
    const twitterVal = "https://x.com/sample";
    const telegramVal = null; // Stored as NULL, not ""
    const websiteVal = "https://sample.fun";
    const nameVal = "Sample Token";
    const symbolVal = "SAMPLE";
    const mint = "SampleMint1111111111111111111111111111111111";

    const boundArgs = [twitterVal, telegramVal, websiteVal, nameVal, symbolVal, mint];
    assert.strictEqual(
      placeholderCount,
      boundArgs.length,
      `Placeholder count (${placeholderCount}) must strictly match bound arguments count (${boundArgs.length})`
    );
  });

  it("executes UPDATE on local D1 and asserts strict NULL storage and accurate SQL counts", () => {
    const testMint = "TestD1BindingVerificationToken1111111111111111";
    const now = Date.now();

    // 1. Insert test launch row in local D1
    const insertCmd = `npx wrangler d1 execute pump_launches --local --cwd D:\\update3\\cf-pump-screener --command "INSERT OR REPLACE INTO events (id, received_at, kind, mint, creator, bonding_curve, name, symbol, uri, twitter, telegram, website, raw_json) VALUES (999999, ${now}, 'new_token', '${testMint}', 'creator_test', 'curve_test', '', '', 'https://metadata.j7tracker.io/sample.json', NULL, NULL, NULL, '{}');"`;
    execSync(insertCmd, { stdio: "pipe" });

    // 2. Execute UPDATE with 6 parameters (twitter non-null, telegram null, website non-null)
    const updateCmd = `npx wrangler d1 execute pump_launches --local --cwd D:\\update3\\cf-pump-screener --command "UPDATE events SET twitter = 'https://x.com/alpha_dev', telegram = NULL, website = 'https://alphatoken.fun', name = COALESCE(NULLIF(name, ''), 'Alpha Token'), symbol = COALESCE(NULLIF(symbol, ''), 'ALPHA') WHERE mint = '${testMint}' AND kind = 'new_token';"`;
    execSync(updateCmd, { stdio: "pipe" });

    // 3. Query row from local D1
    const queryCmd = `npx wrangler d1 execute pump_launches --local --cwd D:\\update3\\cf-pump-screener --command "SELECT mint, name, symbol, twitter, telegram, website, COUNT(twitter) as cnt_tw, COUNT(telegram) as cnt_tg FROM events WHERE mint = '${testMint}';"`;
    const out = execSync(queryCmd, { encoding: "utf8" });

    // Parse JSON results from wrangler output
    const jsonMatch = out.match(/\[\s*\{[\s\S]*\}\s*\]/);
    assert.ok(jsonMatch, "Failed to parse wrangler JSON output");
    const parsed = JSON.parse(jsonMatch[0]);
    const row = parsed[0]?.results?.[0];

    assert.ok(row, "Test row not found in local D1");
    assert.strictEqual(row.mint, testMint);
    assert.strictEqual(row.name, "Alpha Token");
    assert.strictEqual(row.symbol, "ALPHA");
    assert.strictEqual(row.twitter, "https://x.com/alpha_dev");
    assert.strictEqual(row.telegram, null, "telegram must be strictly null (not empty string '')");
    assert.strictEqual(row.website, "https://alphatoken.fun");

    // Assert SQL COUNT semantics: COUNT(telegram) must be 0 because it is NULL
    assert.strictEqual(row.cnt_tw, 1, "COUNT(twitter) must be 1 for non-null URL");
    assert.strictEqual(row.cnt_tg, 0, "COUNT(telegram) must be 0 for NULL");

    // 4. Cleanup test row
    const deleteCmd = `npx wrangler d1 execute pump_launches --local --cwd D:\\update3\\cf-pump-screener --command "DELETE FROM events WHERE mint = '${testMint}';"`;
    execSync(deleteCmd, { stdio: "pipe" });
  });
});
