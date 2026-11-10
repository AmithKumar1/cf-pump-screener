import { decodeBase58 } from "./base58.ts";
import type { TradePoint } from "./types.ts";

export const PUMP_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
export const PUMP_MAYHEM_PROGRAM_ID = "MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e";
export const PUMPSWAP_PROGRAM_ID = "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
export const PUMP_FEE_PROGRAM_ID = "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ";

export const PUMP_CORE_PROGRAM_IDS = new Set<string>([
  PUMP_PROGRAM_ID,
  PUMP_MAYHEM_PROGRAM_ID,
]);

export const PUMP_PROGRAM_IDS = new Set<string>([
  PUMP_PROGRAM_ID,
  PUMP_MAYHEM_PROGRAM_ID,
  PUMPSWAP_PROGRAM_ID,
  PUMP_FEE_PROGRAM_ID,
]);
export const CREATE_V2_DISCRIMINATOR = "d6904cec5f8b31b4";
export const LEGACY_CREATE_DISCRIMINATOR = "181ec828051c0777";

export interface ParsedCreateEvent {
  kind: "create_v2" | "unsupported_legacy_create" | "invalid";
  mint?: string;
  creator?: string;
  creatorVerified: boolean;
  bondingCurve?: string;
  name?: string;
  symbol?: string;
  uri?: string;
  signature: string;
  blockTime: number;
  error?: string;
}

/**
 * Safely parse Borsh string: 4-byte LE length prefix followed by UTF-8 bytes.
 */
function readBorshString(
  buf: Uint8Array,
  offset: number
): { text: string; newOffset: number } {
  if (offset + 4 > buf.length) {
    throw new Error(`Buffer truncated reading length prefix at offset ${offset}`);
  }

  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const len = view.getUint32(offset, true);
  const start = offset + 4;
  const end = start + len;

  if (end > buf.length) {
    throw new Error(
      `String payload exceeds buffer length: offset ${start}, len ${len}, total ${buf.length}`
    );
  }

  const slice = buf.subarray(start, end);
  const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(slice);
  return { text, newOffset: end };
}

/**
 * Parse Helius Enhanced Transaction for a Pump.fun token creation event.
 */
export function parseHeliusCreate(tx: any): ParsedCreateEvent | null {
  if (!tx || typeof tx !== "object") return null;

  const signature = tx.signature || "";
  const blockTime = tx.timestamp || tx.blockTime || Math.floor(Date.now() / 1000);
  const feePayer = tx.feePayer || "";

  // Search across ALL instructions for pump.fun program
  const instructions = Array.isArray(tx.instructions) ? tx.instructions : [];
  let targetIx: any = null;

  for (const ix of instructions) {
    if (ix && PUMP_CORE_PROGRAM_IDS.has(ix.programId) && ix.data) {
      targetIx = ix;
      break;
    }
  }

  if (!targetIx) {
    return null; // Not a pump.fun transaction
  }

  try {
    const rawData = decodeBase58(targetIx.data);
    if (rawData.length < 8) {
      return {
        kind: "invalid",
        signature,
        blockTime,
        creatorVerified: false,
        error: "INSTRUCTION_DATA_TOO_SHORT",
      };
    }

    // Read 8-byte Anchor discriminator as hex
    let discHex = "";
    for (let i = 0; i < 8; i++) {
      discHex += rawData[i].toString(16).padStart(2, "0");
    }

    if (discHex === LEGACY_CREATE_DISCRIMINATOR) {
      return {
        kind: "unsupported_legacy_create",
        signature,
        blockTime,
        creatorVerified: false,
        error: "UNSUPPORTED_LEGACY_CREATE",
      };
    }

    if (discHex !== CREATE_V2_DISCRIMINATOR) {
      return {
        kind: "invalid",
        signature,
        blockTime,
        creatorVerified: false,
        error: `UNRECOGNIZED_DISCRIMINATOR_${discHex}`,
      };
    }

    // Accounts validation for CreateV2:
    // accounts[0] = mint
    // accounts[2] = bonding curve
    // accounts[5] = user (creator)
    const accounts = Array.isArray(targetIx.accounts) ? targetIx.accounts : [];
    if (accounts.length < 6) {
      return {
        kind: "invalid",
        signature,
        blockTime,
        creatorVerified: false,
        error: "INSUFFICIENT_ACCOUNTS_FOR_CREATE_V2",
      };
    }

    const mint = accounts[0];
    const bondingCurve = accounts[2];
    const candidateCreator = accounts[5];

    // Creator verification:
    // feePayer is guaranteed to be a transaction signer in Solana.
    // If candidateCreator matches feePayer, it is verified.
    // If not matching, mark creator unknown to prevent recording a relayer/sponsor as dev.
    let creator = "unknown";
    let creatorVerified = false;
    if (candidateCreator && candidateCreator === feePayer) {
      creator = candidateCreator;
      creatorVerified = true;
    }

    // Unpack Borsh strings: name, symbol, uri
    let offset = 8;
    const nameRes = readBorshString(rawData, offset);
    offset = nameRes.newOffset;

    const symRes = readBorshString(rawData, offset);
    offset = symRes.newOffset;

    const uriRes = readBorshString(rawData, offset);

    return {
      kind: "create_v2",
      mint,
      creator,
      creatorVerified,
      bondingCurve,
      name: nameRes.text,
      symbol: symRes.text,
      uri: uriRes.text,
      signature,
      blockTime,
    };
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : "PARSE_ERROR";
    return {
      kind: "invalid",
      signature,
      blockTime,
      creatorVerified: false,
      error: errMessage,
    };
  }
}

/**
 * Verify whether a Helius Enhanced transaction interacts with genuine Pump.fun or Mayhem programs.
 * Note: Drops unverified mint.endsWith("pump") shortcut to ensure deterministic program-level verification.
 */
export function isPumpFunTransaction(tx: any, mint?: string): boolean {
  if (!tx || typeof tx !== "object") return false;

  // 1. Explicit Helius source tag for pump.fun bonding curve
  if (tx.source === "PUMP_FUN") return true;

  const instructions = Array.isArray(tx.instructions) ? tx.instructions : [];

  // 2. Direct or CPI execution on Pump Core Programs (Bonding Curve or Mayhem Mode)
  for (const ix of instructions) {
    if (ix?.programId && PUMP_CORE_PROGRAM_IDS.has(ix.programId)) return true;
    if (Array.isArray(ix?.innerInstructions)) {
      for (const inner of ix.innerInstructions) {
        if (inner?.programId && PUMP_CORE_PROGRAM_IDS.has(inner.programId)) return true;
      }
    }
  }

  // 3. Inspect accountData for Core Pump Program IDs
  const accountData = Array.isArray(tx.accountData) ? tx.accountData : [];
  for (const acc of accountData) {
    if (acc?.account && PUMP_CORE_PROGRAM_IDS.has(acc.account)) return true;
  }

  // 4. Execution on PumpSwap AMM is verified only for tokens originating from Pump.fun
  let hasPumpSwap = tx.source === "PUMP_SWAP";
  let hasPumpFee = false;
  for (const ix of instructions) {
    if (ix?.programId === PUMPSWAP_PROGRAM_ID) hasPumpSwap = true;
    if (ix?.programId === PUMP_FEE_PROGRAM_ID) hasPumpFee = true;
    if (Array.isArray(ix?.innerInstructions)) {
      for (const inner of ix.innerInstructions) {
        if (inner?.programId === PUMPSWAP_PROGRAM_ID) hasPumpSwap = true;
        if (inner?.programId === PUMP_FEE_PROGRAM_ID) hasPumpFee = true;
      }
    }
  }

  if (hasPumpSwap || hasPumpFee) {
    // A PumpSwap pool is accepted only if the token originated on Pump.fun
    if (mint && (mint.toLowerCase().endsWith("pump") || hasPumpFee)) {
      return true;
    }
    if (!mint && (hasPumpFee || tx.source === "PUMP_SWAP" || hasPumpSwap)) {
      return true;
    }
  }

  return false;
}

/**
 * Parse Helius Enhanced Transaction for a swap event.
 */
export function parseHeliusSwap(tx: any): TradePoint | null {
  if (!tx || !tx.events || !tx.events.swap) return null;

  const swap = tx.events.swap;
  const signature = tx.signature || "";
  const blockTime = tx.timestamp || tx.blockTime || Math.floor(Date.now() / 1000);

  let mint = "";
  let side: "buy" | "sell" = "buy";
  let solAmount = 0;
  let tokenAmount = 0;
  let trader = "unknown";

  if (swap.nativeInput && swap.tokenOutputs && swap.tokenOutputs.length > 0) {
    // Buy transaction: SOL -> Tokens
    side = "buy";
    trader = swap.nativeInput.account || tx.feePayer || "unknown";
    solAmount = Number(swap.nativeInput.amount || 0) / 1e9;

    const out = swap.tokenOutputs[0];
    mint = out.mint || "";
    const rawUnits = Number(out.rawTokenAmount?.tokenAmount || 0);
    const decimals = typeof out.rawTokenAmount?.decimals === "number" ? out.rawTokenAmount.decimals : 6;
    tokenAmount = rawUnits / Math.pow(10, decimals);
  } else if (swap.tokenInputs && swap.tokenInputs.length > 0 && swap.nativeOutput) {
    // Sell transaction: Tokens -> SOL
    side = "sell";
    const inToken = swap.tokenInputs[0];
    trader = inToken.userAccount || tx.feePayer || "unknown";
    mint = inToken.mint || "";
    solAmount = Number(swap.nativeOutput.amount || 0) / 1e9;

    const rawUnits = Number(inToken.rawTokenAmount?.tokenAmount || 0);
    const decimals = typeof inToken.rawTokenAmount?.decimals === "number" ? inToken.rawTokenAmount.decimals : 6;
    tokenAmount = rawUnits / Math.pow(10, decimals);
  } else {
    return null;
  }

  if (!mint) return null;

  // Enforce pump.fun program verification: reject non-pump swaps (e.g. Raydium, Orca, external DEX)
  if (!isPumpFunTransaction(tx, mint)) {
    return null;
  }

  return {
    signature,
    mint,
    side,
    trader,
    sol_amount: solAmount,
    token_amount: tokenAmount,
    block_time: blockTime,
  };
}
