const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ALPHABET_MAP: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i += 1) {
  ALPHABET_MAP[ALPHABET[i]] = i;
}

/**
 * Minimal base58 decoder (Bitcoin/Solana alphabet, no checksum).
 * Solana addresses are the raw base58 encoding of a 32-byte public key,
 * so decoding and checking the byte length is the whole validation.
 */
export function base58Decode(input: string): Uint8Array {
  if (input.length === 0) throw new Error("Empty address");

  const bytes = [0];
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const value = ALPHABET_MAP[char];
    if (value === undefined) throw new Error(`Invalid base58 character "${char}"`);

    let carry = value;
    for (let j = 0; j < bytes.length; j += 1) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  // leading '1' characters encode leading zero bytes
  for (let i = 0; i < input.length && input[i] === "1"; i += 1) {
    bytes.push(0);
  }

  return new Uint8Array(bytes.reverse());
}

/** A Solana address is a 32-byte public key, base58 encoded (no checksum). */
export function isValidSolanaAddress(address: string): boolean {
  const trimmed = address.trim();
  if (trimmed.length < 32 || trimmed.length > 44) return false;
  try {
    return base58Decode(trimmed).length === 32;
  } catch {
    return false;
  }
}
