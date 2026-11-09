/**
 * Zero-dependency, memory-safe Base58 decoder for Solana transactions.
 */
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const MAP = new Uint8Array(256);
MAP.fill(255);
for (let i = 0; i < ALPHABET.length; i++) {
  MAP[ALPHABET.charCodeAt(i)] = i;
}

export function decodeBase58(str: string): Uint8Array {
  if (!str || str.length === 0) {
    return new Uint8Array(0);
  }

  // Count leading '1's (zeros in base58)
  let zeroes = 0;
  while (zeroes < str.length && str[zeroes] === "1") {
    zeroes++;
  }

  // Allocate upper bound of bytes: log(58) / log(256) ≈ 0.733
  const size = Math.ceil(str.length * 0.733) + 1;
  const b58 = new Uint8Array(size);
  let length = 0;

  for (let i = zeroes; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 256 || MAP[code] === 255) {
      throw new Error(`Invalid Base58 character: ${str[i]}`);
    }

    let carry = MAP[code];
    let j = 0;
    for (let it = size - 1; (carry !== 0 || j < length) && it >= 0; it--, j++) {
      carry += 58 * b58[it];
      b58[it] = carry % 256;
      carry = Math.floor(carry / 256);
    }
    length = j;
  }

  // Skip leading zeros in calculated buffer
  let it = size - length;
  while (it < size && b58[it] === 0) {
    it++;
  }

  const result = new Uint8Array(zeroes + (size - it));
  result.fill(0, 0, zeroes);
  result.set(b58.subarray(it), zeroes);
  return result;
}
