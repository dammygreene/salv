import { afterEach, describe, expect, it } from "vitest";
import { assertIsThreeOfThree, getCullerTreasuryMultisigConfig, CullerTreasuryMultisigConfigError } from "./multisig";

const ENV_VARS = [
  "CULLER_TREASURY_MULTISIG_ADDRESS",
  "CULLER_TREASURY_MEMBER_1",
  "CULLER_TREASURY_MEMBER_2",
  "CULLER_TREASURY_MEMBER_3",
  "CULLER_TREASURY_MEMBER_4",
  "CULLER_TREASURY_THRESHOLD",
  "CULLER_NETWORK",
] as const;

// Real-shaped (but fake) base58 Solana public keys for tests.
const MULTISIG = "11111111111111111111111111111112";
const MEMBER_1 = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const MEMBER_2 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const MEMBER_3 = "So11111111111111111111111111111111111111112";

function clearEnv() {
  for (const name of ENV_VARS) delete process.env[name];
}

describe("$CULLER treasury multisig config", () => {
  afterEach(() => clearEnv());

  it("returns configured: false (never throws) when unset -- the normal pre-deployment state", () => {
    clearEnv();
    const result = getCullerTreasuryMultisigConfig();
    expect(result.configured).toBe(false);
    if (!result.configured) {
      expect(result.missing.length).toBeGreaterThan(0);
    }
  });

  it("returns a valid 3-of-3 config when all three distinct members and the multisig address are set", () => {
    clearEnv();
    process.env.CULLER_TREASURY_MULTISIG_ADDRESS = MULTISIG;
    process.env.CULLER_TREASURY_MEMBER_1 = MEMBER_1;
    process.env.CULLER_TREASURY_MEMBER_2 = MEMBER_2;
    process.env.CULLER_TREASURY_MEMBER_3 = MEMBER_3;

    const result = getCullerTreasuryMultisigConfig();
    expect(result.configured).toBe(true);
    if (result.configured) {
      expect(result.threshold).toBe(3);
      expect(result.memberPublicKeys).toEqual([MEMBER_1, MEMBER_2, MEMBER_3]);
      expect(result.network).toBe("devnet");
    }
  });

  it("fails closed (throws) if a member public key is duplicated", () => {
    clearEnv();
    process.env.CULLER_TREASURY_MULTISIG_ADDRESS = MULTISIG;
    process.env.CULLER_TREASURY_MEMBER_1 = MEMBER_1;
    process.env.CULLER_TREASURY_MEMBER_2 = MEMBER_1;
    process.env.CULLER_TREASURY_MEMBER_3 = MEMBER_3;

    expect(() => getCullerTreasuryMultisigConfig()).toThrow(CullerTreasuryMultisigConfigError);
  });

  it("fails closed if a 4th member variable is set (rejects any non-3-of-3 shape)", () => {
    clearEnv();
    process.env.CULLER_TREASURY_MULTISIG_ADDRESS = MULTISIG;
    process.env.CULLER_TREASURY_MEMBER_1 = MEMBER_1;
    process.env.CULLER_TREASURY_MEMBER_2 = MEMBER_2;
    process.env.CULLER_TREASURY_MEMBER_3 = MEMBER_3;
    process.env.CULLER_TREASURY_MEMBER_4 = "4nBnEhzNnxsJMZrgRW8WFqMzEZ6PB4K88ibFCKunKAMg";

    expect(() => getCullerTreasuryMultisigConfig()).toThrow(CullerTreasuryMultisigConfigError);
  });

  it("fails closed if CULLER_TREASURY_THRESHOLD is set to anything other than 3 (e.g. an attempted 2-of-3)", () => {
    clearEnv();
    process.env.CULLER_TREASURY_MULTISIG_ADDRESS = MULTISIG;
    process.env.CULLER_TREASURY_MEMBER_1 = MEMBER_1;
    process.env.CULLER_TREASURY_MEMBER_2 = MEMBER_2;
    process.env.CULLER_TREASURY_MEMBER_3 = MEMBER_3;
    process.env.CULLER_TREASURY_THRESHOLD = "2";

    expect(() => getCullerTreasuryMultisigConfig()).toThrow(CullerTreasuryMultisigConfigError);
  });

  it("accepts CULLER_TREASURY_THRESHOLD explicitly set to 3 (a no-op, but must not throw)", () => {
    clearEnv();
    process.env.CULLER_TREASURY_MULTISIG_ADDRESS = MULTISIG;
    process.env.CULLER_TREASURY_MEMBER_1 = MEMBER_1;
    process.env.CULLER_TREASURY_MEMBER_2 = MEMBER_2;
    process.env.CULLER_TREASURY_MEMBER_3 = MEMBER_3;
    process.env.CULLER_TREASURY_THRESHOLD = "3";

    expect(() => getCullerTreasuryMultisigConfig()).not.toThrow();
  });

  it("fails closed on an obviously-malformed value (e.g. a private-key-shaped array pasted in)", () => {
    clearEnv();
    process.env.CULLER_TREASURY_MULTISIG_ADDRESS = MULTISIG;
    process.env.CULLER_TREASURY_MEMBER_1 = "[1,2,3,4,5]";
    process.env.CULLER_TREASURY_MEMBER_2 = MEMBER_2;
    process.env.CULLER_TREASURY_MEMBER_3 = MEMBER_3;

    expect(() => getCullerTreasuryMultisigConfig()).toThrow(CullerTreasuryMultisigConfigError);
  });

  it("rejects an unknown network value", () => {
    clearEnv();
    process.env.CULLER_TREASURY_MULTISIG_ADDRESS = MULTISIG;
    process.env.CULLER_TREASURY_MEMBER_1 = MEMBER_1;
    process.env.CULLER_TREASURY_MEMBER_2 = MEMBER_2;
    process.env.CULLER_TREASURY_MEMBER_3 = MEMBER_3;
    process.env.CULLER_NETWORK = "mainnet";

    expect(() => getCullerTreasuryMultisigConfig()).toThrow(CullerTreasuryMultisigConfigError);
  });

  describe("assertIsThreeOfThree", () => {
    it("does not throw for exactly 3 members / 3 threshold", () => {
      expect(() => assertIsThreeOfThree(3, 3)).not.toThrow();
    });

    it("throws for 2-of-3", () => {
      expect(() => assertIsThreeOfThree(3, 2)).toThrow(CullerTreasuryMultisigConfigError);
    });

    it("throws for 3-of-5", () => {
      expect(() => assertIsThreeOfThree(5, 3)).toThrow(CullerTreasuryMultisigConfigError);
    });
  });
});
