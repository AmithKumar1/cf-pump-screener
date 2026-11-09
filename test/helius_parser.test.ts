import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  parseHeliusCreate,
  parseHeliusSwap,
  PUMP_PROGRAM_ID,
  CREATE_V2_DISCRIMINATOR,
  LEGACY_CREATE_DISCRIMINATOR,
} from "../src/parser.ts";
import { isSafeMetadataUrl, fetchTokenMetadata } from "../src/metadata.ts";
import { decodeBase58 } from "../src/base58.ts";

// Helper to encode bytes to Base58
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function encodeBase58(buffer: Uint8Array): string {
  const digits: number[] = [0];
  for (let i = 0; i < buffer.length; i++) {
    for (let j = 0; j < digits.length; j++) {
      digits[j] <<= 8;
    }
    digits[0] += buffer[i];
    let carry = 0;
    for (let j = 0; j < digits.length; j++) {
      digits[j] += carry;
      carry = (digits[j] / 58) | 0;
      digits[j] %= 58;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
    digits.push(0);
  }
  return digits.reverse().map((d) => ALPHABET[d]).join("");
}

// Build synthetic Borsh CreateV2 instruction buffer
function buildCreateV2Data(
  discriminatorHex: string,
  name: string,
  symbol: string,
  uri: string
): string {
  const disc = Buffer.from(discriminatorHex, "hex");
  const nameBuf = Buffer.from(name, "utf-8");
  const symBuf = Buffer.from(symbol, "utf-8");
  const uriBuf = Buffer.from(uri, "utf-8");

  const totalLen = 8 + 4 + nameBuf.length + 4 + symBuf.length + 4 + uriBuf.length;
  const out = Buffer.alloc(totalLen);
  let offset = 0;

  disc.copy(out, offset);
  offset += 8;

  out.writeUInt32LE(nameBuf.length, offset);
  offset += 4;
  nameBuf.copy(out, offset);
  offset += nameBuf.length;

  out.writeUInt32LE(symBuf.length, offset);
  offset += 4;
  symBuf.copy(out, offset);
  offset += symBuf.length;

  out.writeUInt32LE(uriBuf.length, offset);
  offset += 4;
  uriBuf.copy(out, offset);

  return encodeBase58(out);
}

describe("Helius Enhanced Transaction Parser", () => {
  function findFixture(filename: string): string {
    const candidates = [
      path.resolve(process.cwd(), "test", "fixtures", filename),
      path.resolve(process.cwd(), filename),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    throw new Error(`Fixture not found: ${filename}`);
  }

  const launchPath = findFixture("launch.json");
  const swapPath = findFixture("swap.json");

  const launchTx = JSON.parse(fs.readFileSync(launchPath, "utf-8"));
  const swapTx = JSON.parse(fs.readFileSync(swapPath, "utf-8"));

  it("Test 1: Canonical launch.json matches CreateV2 layout and decoded fields", () => {
    const parsed = parseHeliusCreate(launchTx);
    assert.ok(parsed !== null);
    assert.equal(parsed.kind, "create_v2");
    assert.equal(parsed.mint, "D7Gxp1MCzs8t8GBDyEoGJdaJw27U2p9PC1qFo351pump");
    assert.equal(parsed.bondingCurve, "HQZhB3UtRGbD6RYMixnn9xDjTiYgVv2jiomD5zyUrzNg");
    assert.equal(parsed.creator, launchTx.feePayer);
    assert.equal(parsed.creatorVerified, true);
    assert.equal(parsed.name, "김정은 코인");
    assert.equal(parsed.symbol, "김");
    assert.equal(parsed.uri, "https://metadata.j7tracker.io/metadata/f047689168c94ba8.json");
    assert.equal(parsed.signature, launchTx.signature);
  });

  it("Test 2: Canonical swap.json correctly parses swap side, SOL amount, and token decimals", () => {
    const parsed = parseHeliusSwap(swapTx);
    assert.ok(parsed !== null);
    assert.equal(parsed.signature, "4jNrMi7eQWH9EQGA5ThW7jJyEwJNERrBmuyAxVqWDUD5UJki5amsdeZUnbXJwQ4UAMZVhuRBvukxXBhu4i8JBN6z");
    assert.equal(parsed.mint, "D7Gxp1MCzs8t8GBDyEoGJdaJw27U2p9PC1qFo351pump");
    assert.equal(parsed.side, "buy");
    assert.equal(parsed.trader, "BFXuLHHWmGMyta4fqQf2T3TGhM3QuvGJjWmqbPMown1C");
    // 38,714,319 lamports = 0.038714319 SOL
    assert.equal(parsed.sol_amount, 0.038714319);
    // 639,556,732,784 raw units with 6 decimals = 639,556.732784
    assert.equal(parsed.token_amount, 639556.732784);
    assert.equal(parsed.block_time, 1794237805);
  });

  it("Test 3: Sponsored create marks creator unknown if candidate does not match feePayer", () => {
    const clone = JSON.parse(JSON.stringify(launchTx));
    clone.feePayer = "DifferentFeePayerSponsorWallet11111111111111";

    const parsed = parseHeliusCreate(clone);
    assert.ok(parsed !== null);
    assert.equal(parsed.kind, "create_v2");
    assert.equal(parsed.creator, "unknown");
    assert.equal(parsed.creatorVerified, false);
  });

  it("Edge Case 1: Truncated instruction data (< 8 bytes) returns invalid", () => {
    const clone = JSON.parse(JSON.stringify(launchTx));
    // Provide only 4 bytes of data
    clone.instructions[0].data = encodeBase58(Buffer.from([0x01, 0x02, 0x03, 0x04]));

    const parsed = parseHeliusCreate(clone);
    assert.ok(parsed !== null);
    assert.equal(parsed.kind, "invalid");
    assert.equal(parsed.error, "INSTRUCTION_DATA_TOO_SHORT");
  });

  it("Edge Case 2: Wrong program ID returns null", () => {
    const clone = JSON.parse(JSON.stringify(launchTx));
    clone.instructions[0].programId = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

    const parsed = parseHeliusCreate(clone);
    assert.equal(parsed, null);
  });

  it("Edge Case 3: Legacy create discriminator returns unsupported_legacy_create", () => {
    const legacyData = buildCreateV2Data(
      LEGACY_CREATE_DISCRIMINATOR,
      "Legacy Token",
      "LEGACY",
      "https://example.com/legacy.json"
    );
    const clone = JSON.parse(JSON.stringify(launchTx));
    clone.instructions[0].data = legacyData;

    const parsed = parseHeliusCreate(clone);
    assert.ok(parsed !== null);
    assert.equal(parsed.kind, "unsupported_legacy_create");
    assert.equal(parsed.error, "UNSUPPORTED_LEGACY_CREATE");
  });

  it("Edge Case 4: Invalid UTF-8 bytes in Borsh payload triggers parse error", () => {
    const disc = Buffer.from(CREATE_V2_DISCRIMINATOR, "hex");
    const badUtf8 = Buffer.from([0xff, 0xff, 0xff, 0xff]); // Invalid UTF-8 sequence
    const out = Buffer.alloc(8 + 4 + badUtf8.length);
    disc.copy(out, 0);
    out.writeUInt32LE(badUtf8.length, 8);
    badUtf8.copy(out, 12);

    const clone = JSON.parse(JSON.stringify(launchTx));
    clone.instructions[0].data = encodeBase58(out);

    const parsed = parseHeliusCreate(clone);
    assert.ok(parsed !== null);
    assert.equal(parsed.kind, "invalid");
    assert.ok(parsed.error?.length! > 0);
  });

  it("Edge Case 5: Insufficient accounts (< 6 accounts for CreateV2) returns invalid", () => {
    const clone = JSON.parse(JSON.stringify(launchTx));
    clone.instructions[0].accounts = clone.instructions[0].accounts.slice(0, 4);

    const parsed = parseHeliusCreate(clone);
    assert.ok(parsed !== null);
    assert.equal(parsed.kind, "invalid");
    assert.equal(parsed.error, "INSUFFICIENT_ACCOUNTS_FOR_CREATE_V2");
  });

  it("Edge Case 6: Cut-off string payload where length exceeds buffer returns invalid", () => {
    const disc = Buffer.from(CREATE_V2_DISCRIMINATOR, "hex");
    const out = Buffer.alloc(8 + 4 + 2);
    disc.copy(out, 0);
    out.writeUInt32LE(100, 8); // Claim length is 100 bytes, but only 2 bytes follow
    out.writeUInt16LE(0x1234, 12);

    const clone = JSON.parse(JSON.stringify(launchTx));
    clone.instructions[0].data = encodeBase58(out);

    const parsed = parseHeliusCreate(clone);
    assert.ok(parsed !== null);
    assert.equal(parsed.kind, "invalid");
    assert.ok(parsed.error?.includes("String payload exceeds buffer length"));
  });
});

describe("Defensive Off-Chain Metadata Fetcher", () => {
  it("SSRF Defense: Rejects insecure, loopback, private IP, and link-local cloud metadata URIs", () => {
    // Insecure HTTP
    assert.equal(isSafeMetadataUrl("http://example.com/meta.json"), false);

    // Localhost / Loopback
    assert.equal(isSafeMetadataUrl("https://localhost/meta.json"), false);
    assert.equal(isSafeMetadataUrl("https://127.0.0.1/meta.json"), false);
    assert.equal(isSafeMetadataUrl("https://[::1]/meta.json"), false);

    // Cloud Metadata endpoint (AWS / GCP / Azure IMDS)
    assert.equal(isSafeMetadataUrl("https://169.254.169.254/latest/meta-data"), false);

    // RFC 1918 Private ranges
    assert.equal(isSafeMetadataUrl("https://10.0.0.1/meta.json"), false);
    assert.equal(isSafeMetadataUrl("https://192.168.1.1/meta.json"), false);
    assert.equal(isSafeMetadataUrl("https://172.16.0.1/meta.json"), false);

    // Legitimate public HTTPS endpoints
    assert.equal(isSafeMetadataUrl("https://metadata.j7tracker.io/metadata/f047689168c94ba8.json"), true);
    assert.equal(isSafeMetadataUrl("https://ipfs.io/ipfs/QmSomeHash"), true);
    assert.equal(isSafeMetadataUrl("https://arweave.net/tx_id_123"), true);
  });

  it("fetchTokenMetadata rejects immediately on unsafe URI without network call", async () => {
    const res = await fetchTokenMetadata("http://169.254.169.254/latest/meta-data");
    assert.equal(res.success, false);
    assert.equal(res.isAvailable, false);
    assert.equal(res.error, "INVALID_OR_UNSAFE_URI");
  });

  it("fetchTokenMetadata enforces 15KB oversize limit", async () => {
    // Mock global fetch to return an oversize response (> 15KB)
    const originalFetch = globalThis.fetch;
    try {
      const oversizeChunk = new Uint8Array(20 * 1024); // 20 KB
      oversizeChunk.fill(65); // ASCII 'A'

      globalThis.fetch = async () => {
        return new Response(oversizeChunk, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const res = await fetchTokenMetadata("https://metadata.example.com/huge.json");
      assert.equal(res.success, false);
      assert.equal(res.isAvailable, false);
      assert.equal(res.error, "OVERSIZE_BODY_EXCEEDS_15KB");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("fetchTokenMetadata sanitizes and extracts social links safely", async () => {
    const originalFetch = globalThis.fetch;
    try {
      const sampleJson = JSON.stringify({
        name: "  Kim Jong Un Coin  ",
        symbol: " KIM ",
        twitter: "https://x.com/kimcoin",
        telegram: "https://t.me/kimcoin",
        website: "https://kim.io",
        description: "Official community meme token",
      });

      globalThis.fetch = async () => {
        return new Response(sampleJson, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const res = await fetchTokenMetadata("https://metadata.example.com/token.json");
      assert.equal(res.success, true);
      assert.equal(res.isAvailable, true);
      assert.equal(res.name, "Kim Jong Un Coin");
      assert.equal(res.symbol, "KIM");
      assert.equal(res.twitter, "https://x.com/kimcoin");
      assert.equal(res.telegram, "https://t.me/kimcoin");
      assert.equal(res.website, "https://kim.io");
      assert.equal(res.description, "Official community meme token");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
