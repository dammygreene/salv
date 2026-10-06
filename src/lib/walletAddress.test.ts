import { describe, expect, it } from "vitest";
import { detectWalletAddress, isValidEvmAddress, MAX_ADDRESS_INPUT_LENGTH, validateCombinedWalletSubmission } from "./walletAddress";
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

describe("validateCombinedWalletSubmission (Phase 8: Solana required, Robinhood optional)", () => {
  // Robustness scenarios 1-8 from the Phase 8 spec.
  it("1. Solana-only submission succeeds", () => {
    const result = validateCombinedWalletSubmission({ solanaWallet: VALID_SOLANA });
    expect(result).toEqual({ valid: true, submission: { solanaWallet: VALID_SOLANA, robinhoodWallet: null } });
  });

  it("2. Solana + Robinhood submission succeeds", () => {
    const result = validateCombinedWalletSubmission({ solanaWallet: VALID_SOLANA, robinhoodWallet: VALID_EVM_LOWER_FIXED });
    expect(result).toEqual({
      valid: true,
      submission: { solanaWallet: VALID_SOLANA, robinhoodWallet: VALID_EVM_LOWER_FIXED },
    });
  });

  it("3. Robinhood-only submission always fails -- Solana is unconditionally required", () => {
    const result = validateCombinedWalletSubmission({ robinhoodWallet: VALID_EVM_LOWER_FIXED });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toMatch(/solana/i);
    }
  });

  it("3b. Robinhood-only submission fails even with an explicit empty-string Solana field", () => {
    const result = validateCombinedWalletSubmission({ solanaWallet: "", robinhoodWallet: VALID_EVM_LOWER_FIXED });
    expect(result.valid).toBe(false);
  });

  it("4. Invalid Solana address fails, regardless of Robinhood", () => {
    expect(validateCombinedWalletSubmission({ solanaWallet: "not-a-solana-address" }).valid).toBe(false);
    expect(
      validateCombinedWalletSubmission({ solanaWallet: "not-a-solana-address", robinhoodWallet: VALID_EVM_LOWER_FIXED }).valid
    ).toBe(false);
  });

  it("5. Invalid Robinhood address fails, even with a valid Solana address", () => {
    const result = validateCombinedWalletSubmission({ solanaWallet: VALID_SOLANA, robinhoodWallet: "not-an-evm-address" });
    expect(result.valid).toBe(false);
  });

  it("6. Empty Robinhood succeeds (undefined, null, and empty string all mean 'no Robinhood')", () => {
    expect(validateCombinedWalletSubmission({ solanaWallet: VALID_SOLANA }).valid).toBe(true);
    expect(validateCombinedWalletSubmission({ solanaWallet: VALID_SOLANA, robinhoodWallet: null }).valid).toBe(true);
    expect(validateCombinedWalletSubmission({ solanaWallet: VALID_SOLANA, robinhoodWallet: "" }).valid).toBe(true);
    expect(validateCombinedWalletSubmission({ solanaWallet: VALID_SOLANA, robinhoodWallet: "   " }).valid).toBe(true);
  });

  it("7. Whitespace is trimmed from both fields before validating", () => {
    const result = validateCombinedWalletSubmission({
      solanaWallet: `  ${VALID_SOLANA}  `,
      robinhoodWallet: `\t${VALID_EVM_LOWER_FIXED}\n`,
    });
    expect(result).toEqual({
      valid: true,
      submission: { solanaWallet: VALID_SOLANA, robinhoodWallet: VALID_EVM_LOWER_FIXED },
    });
  });

  it("8. Oversized input is rejected for both the Solana and Robinhood fields", () => {
    const hugeSolana = "1".repeat(MAX_ADDRESS_INPUT_LENGTH + 1);
    expect(validateCombinedWalletSubmission({ solanaWallet: hugeSolana }).valid).toBe(false);

    const hugeRobinhood = "0x" + "a".repeat(MAX_ADDRESS_INPUT_LENGTH + 1);
    expect(validateCombinedWalletSubmission({ solanaWallet: VALID_SOLANA, robinhoodWallet: hugeRobinhood }).valid).toBe(false);
  });

  it("rejects a missing/non-string solanaWallet outright", () => {
    expect(validateCombinedWalletSubmission({}).valid).toBe(false);
    expect(validateCombinedWalletSubmission({ solanaWallet: 12345 }).valid).toBe(false);
    expect(validateCombinedWalletSubmission({ solanaWallet: null }).valid).toBe(false);
  });

  it("rejects a non-string robinhoodWallet (e.g. a number or object) rather than silently coercing it", () => {
    const result = validateCombinedWalletSubmission({ solanaWallet: VALID_SOLANA, robinhoodWallet: 12345 });
    expect(result.valid).toBe(false);
  });

  it("never reports the Robinhood address as the Solana identity, even when both are valid", () => {
    const result = validateCombinedWalletSubmission({ solanaWallet: VALID_SOLANA, robinhoodWallet: VALID_EVM_LOWER_FIXED });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.submission.solanaWallet).toBe(VALID_SOLANA);
      expect(result.submission.solanaWallet).not.toBe(VALID_EVM_LOWER_FIXED);
    }
  });
});
