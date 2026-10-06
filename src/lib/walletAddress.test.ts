import { describe, expect, it } from "vitest";
import { detectWalletAddress, isValidEvmAddress, MAX_ADDRESS_INPUT_LENGTH } from "./walletAddress";
import { isValidSolanaAddress } from "./solana/base58";

// A real, publicly documented Solana address (the same one used
// elsewhere in this codebase as a demo/"try it" address).
const VALID_SOLANA = "FAucetgjU1jYWsiL8BfdTrpLNt2U8kqdVfgvbnGqG5sG";
const VALID_EVM_LOWER_FIXED = "0xa1b2c3d4e5f60718293a4b5c6d7e8f9011223344"; // 40 hex chars exactly

describe("isValidEvmAddress", () => {
  it("accepts a well-formed lowercase 0x address", () => {
    expect(isValidEvmAddress(VALID_EVM_LOWER_FIXED)).toBe(true);
  });

  it("accepts a well-formed mixed-case (EIP-55 style) address without requiring checksum validity", () => {
    expect(isValidEvmAddress("0xA1B2c3D4e5F60718293a4B5C6d7E8f9011223344")).toBe(true);
  });

  it("rejects an address missing the 0x prefix", () => {
    expect(isValidEvmAddress("742d35cc6634c0532925a3b844bc9e7595f0beb")).toBe(false);
  });

  it("rejects an address with the wrong hex length", () => {
    expect(isValidEvmAddress("0x742d35cc6634c0532925a3b844bc9e7595f0b")).toBe(false); // too short
    expect(isValidEvmAddress("0x742d35cc6634c0532925a3b844bc9e7595f0beb00")).toBe(false); // too long
  });

  it("rejects non-hex characters", () => {
    expect(isValidEvmAddress("0xZZZd35cc6634c0532925a3b844bc9e7595f0beb")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidEvmAddress("")).toBe(false);
  });

  it("rejects an absurdly long input without throwing", () => {
    expect(isValidEvmAddress("0x" + "a".repeat(10_000))).toBe(false);
  });
});

describe("detectWalletAddress", () => {
  it("detects a valid Solana address", () => {
    expect(isValidSolanaAddress(VALID_SOLANA)).toBe(true); // sanity on the fixture itself
    const result = detectWalletAddress(VALID_SOLANA);
    expect(result).toEqual({ valid: true, network: "solana", address: VALID_SOLANA });
  });

  it("detects a valid EVM/Robinhood-style address", () => {
    const result = detectWalletAddress(VALID_EVM_LOWER_FIXED);
    expect(result).toEqual({ valid: true, network: "evm", address: VALID_EVM_LOWER_FIXED });
  });

  it("trims surrounding whitespace before validating", () => {
    expect(detectWalletAddress(`  ${VALID_SOLANA}  `).valid).toBe(true);
    expect(detectWalletAddress(`\n${VALID_EVM_LOWER_FIXED}\t`).valid).toBe(true);
  });

  it("rejects obviously invalid garbage", () => {
    expect(detectWalletAddress("not-an-address").valid).toBe(false);
    expect(detectWalletAddress("").valid).toBe(false);
    expect(detectWalletAddress("   ").valid).toBe(false);
  });

  it("rejects a value that looks like a seed phrase, never treating it as an address", () => {
    const seedPhrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const result = detectWalletAddress(seedPhrase);
    expect(result.valid).toBe(false);
    expect(result.network).toBeNull();
  });

  it("rejects an extremely large/unusual address input without throwing", () => {
    const huge = "1".repeat(1_000_000);
    expect(() => detectWalletAddress(huge)).not.toThrow();
    expect(detectWalletAddress(huge).valid).toBe(false);
  });

  it("MAX_ADDRESS_INPUT_LENGTH rejects input one character over the limit", () => {
    const tooLong = "1".repeat(MAX_ADDRESS_INPUT_LENGTH + 1);
    expect(detectWalletAddress(tooLong).valid).toBe(false);
  });

  it("never reports both a Solana and EVM match for the same input", () => {
    // Shape-wise these two formats can never overlap (base58 has no 0x
    // prefix requirement and a different length/alphabet than hex), but
    // assert it explicitly as a safety net against a future regression.
    expect(detectWalletAddress(VALID_SOLANA).network).not.toBe("evm");
    expect(detectWalletAddress(VALID_EVM_LOWER_FIXED).network).not.toBe("solana");
  });
});
