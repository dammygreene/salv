import { afterEach, describe, expect, it } from "vitest";
import { assertIsThreeOfThree, getSalvTreasuryMultisigConfig, SalvTreasuryMultisigConfigError } from "./multisig";

const ENV_VARS = [
  "SALV_TREASURY_MULTISIG_ADDRESS",
  "SALV_TREASURY_MEMBER_1",
  "SALV_TREASURY_MEMBER_2",
  "SALV_TREASURY_MEMBER_3",
  "SALV_TREASURY_MEMBER_4",
  "SALV_TREASURY_THRESHOLD",
  "SALV_NETWORK",
] as const;

// Real-shaped (but fake) base58 Solana public keys for tests.
const MULTISIG = "11111111111111111111111111111112";
const MEMBER_1 = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const MEMBER_2 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const MEMBER_3 = "So11111111111111111111111111111111111111112";

function clearEnv() {
  for (const name of ENV_VARS) delete process.env[name];
}

describe("$SALV treasury multisig config", () => {
  afterEach(() => clearEnv());

  it("returns configured: false (never throws) when unset -- the normal pre-deployment state", () => {
    clearEnv();
    const result = getSalvTreasuryMultisigConfig();
    expect(result.configured).toBe(false);
    if (!result.configured) {
      expect(result.missing.length).toBeGreaterThan(0);
    }
  });

  it("returns a valid 3-of-3 config when all three distinct members and the multisig address are set", () => {
    clearEnv();
    process.env.SALV_TREASURY_MULTISIG_ADDRESS = MULTISIG;
    process.env.SALV_TREASURY_MEMBER_1 = MEMBER_1;
    process.env.SALV_TREASURY_MEMBER_2 = MEMBER_2;
    process.env.SALV_TREASURY_MEMBER_3 = MEMBER_3;

    const result = getSalvTreasuryMultisigConfig();
    expect(result.configured).toBe(true);
    if (result.configured) {
      expect(result.threshold).toBe(3);
      expect(result.memberPublicKeys).toEqual([MEMBER_1, MEMBER_2, MEMBER_3]);
      expect(result.network).toBe("devnet");
    }
  });

  it("fails closed (throws) if a member public key is duplicated", () => {
    clearEnv();
    process.env.SALV_TREASURY_MULTISIG_ADDRESS = MULTISIG;
    process.env.SALV_TREASURY_MEMBER_1 = MEMBER_1;
    process.env.SALV_TREASURY_MEMBER_2 = MEMBER_1;
    process.env.SALV_TREASURY_MEMBER_3 = MEMBER_3;

    expect(() => getSalvTreasuryMultisigConfig()).toThrow(SalvTreasuryMultisigConfigError);
  });

  it("fails closed if a 4th member variable is set (rejects any non-3-of-3 shape)", () => {
    clearEnv();
    process.env.SALV_TREASURY_MULTISIG_ADDRESS = MULTISIG;
    process.env.SALV_TREASURY_MEMBER_1 = MEMBER_1;
    process.env.SALV_TREASURY_MEMBER_2 = MEMBER_2;
    process.env.SALV_TREASURY_MEMBER_3 = MEMBER_3;
    process.env.SALV_TREASURY_MEMBER_4 = "4nBnEhzNnxsJMZrgRW8WFqMzEZ6PB4K88ibFCKunKAMg";

    expect(() => getSalvTreasuryMultisigConfig()).toThrow(SalvTreasuryMultisigConfigError);
  });

  it("fails closed if SALV_TREASURY_THRESHOLD is set to anything other than 3 (e.g. an attempted 2-of-3)", () => {
    clearEnv();
    process.env.SALV_TREASURY_MULTISIG_ADDRESS = MULTISIG;
    process.env.SALV_TREASURY_MEMBER_1 = MEMBER_1;
    process.env.SALV_TREASURY_MEMBER_2 = MEMBER_2;
    process.env.SALV_TREASURY_MEMBER_3 = MEMBER_3;
    process.env.SALV_TREASURY_THRESHOLD = "2";

    expect(() => getSalvTreasuryMultisigConfig()).toThrow(SalvTreasuryMultisigConfigError);
  });

  it("accepts SALV_TREASURY_THRESHOLD explicitly set to 3 (a no-op, but must not throw)", () => {
    clearEnv();
    process.env.SALV_TREASURY_MULTISIG_ADDRESS = MULTISIG;
    process.env.SALV_TREASURY_MEMBER_1 = MEMBER_1;
    process.env.SALV_TREASURY_MEMBER_2 = MEMBER_2;
    process.env.SALV_TREASURY_MEMBER_3 = MEMBER_3;
    process.env.SALV_TREASURY_THRESHOLD = "3";

    expect(() => getSalvTreasuryMultisigConfig()).not.toThrow();
  });

  it("fails closed on an obviously-malformed value (e.g. a private-key-shaped array pasted in)", () => {
    clearEnv();
    process.env.SALV_TREASURY_MULTISIG_ADDRESS = MULTISIG;
    process.env.SALV_TREASURY_MEMBER_1 = "[1,2,3,4,5]";
    process.env.SALV_TREASURY_MEMBER_2 = MEMBER_2;
    process.env.SALV_TREASURY_MEMBER_3 = MEMBER_3;

    expect(() => getSalvTreasuryMultisigConfig()).toThrow(SalvTreasuryMultisigConfigError);
  });

  it("rejects an unknown network value", () => {
    clearEnv();
    process.env.SALV_TREASURY_MULTISIG_ADDRESS = MULTISIG;
    process.env.SALV_TREASURY_MEMBER_1 = MEMBER_1;
    process.env.SALV_TREASURY_MEMBER_2 = MEMBER_2;
    process.env.SALV_TREASURY_MEMBER_3 = MEMBER_3;
    process.env.SALV_NETWORK = "mainnet";

    expect(() => getSalvTreasuryMultisigConfig()).toThrow(SalvTreasuryMultisigConfigError);
  });

  describe("assertIsThreeOfThree", () => {
    it("does not throw for exactly 3 members / 3 threshold", () => {
      expect(() => assertIsThreeOfThree(3, 3)).not.toThrow();
    });

    it("throws for 2-of-3", () => {
      expect(() => assertIsThreeOfThree(3, 2)).toThrow(SalvTreasuryMultisigConfigError);
    });

    it("throws for 3-of-5", () => {
      expect(() => assertIsThreeOfThree(5, 3)).toThrow(SalvTreasuryMultisigConfigError);
    });
  });
});
