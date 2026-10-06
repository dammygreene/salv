import { afterEach, describe, expect, it } from "vitest";
import { getDistributorSecretKey, getCullerConfig } from "./config";

const CULLER_VARS = [
  "CULLER_MINT_ADDRESS",
  "CULLER_REWARD_VAULT",
  "CULLER_DISTRIBUTOR",
  "SOLANA_RPC_URL",
  "CULLER_FEE_WALLET",
  "CULLER_NETWORK",
  "CULLER_TREASURY_ADDRESS",
];

function clearCullerEnv() {
  for (const name of CULLER_VARS) delete process.env[name];
  delete process.env.CULLER_DISTRIBUTOR_SECRET_KEY;
}

describe("getCullerConfig", () => {
  afterEach(() => clearCullerEnv());

  it("reports not configured when required variables are missing", () => {
    clearCullerEnv();
    const config = getCullerConfig();
    expect(config.configured).toBe(false);
    if (!config.configured) {
      expect(config.missing).toContain("CULLER_MINT_ADDRESS");
    }
  });

  it("reports configured once every required variable is set, and defaults network to devnet", () => {
    clearCullerEnv();
    process.env.CULLER_MINT_ADDRESS = "Mint1111111111111111111111111111111111111";
    process.env.CULLER_REWARD_VAULT = "Vault111111111111111111111111111111111111";
    process.env.CULLER_DISTRIBUTOR = "Distributor11111111111111111111111111111";
    process.env.SOLANA_RPC_URL = "https://api.devnet.solana.com";

    const config = getCullerConfig();
    expect(config.configured).toBe(true);
    if (config.configured) {
      expect(config.network).toBe("devnet");
      expect(config.feeWalletAddress).toBeNull();
      expect(config.treasuryAddress).toBeNull();
    }
  });

  it("respects an explicit CULLER_NETWORK and CULLER_FEE_WALLET", () => {
    clearCullerEnv();
    process.env.CULLER_MINT_ADDRESS = "Mint1111111111111111111111111111111111111";
    process.env.CULLER_REWARD_VAULT = "Vault111111111111111111111111111111111111";
    process.env.CULLER_DISTRIBUTOR = "Distributor11111111111111111111111111111";
    process.env.SOLANA_RPC_URL = "https://api.devnet.solana.com";
    process.env.CULLER_NETWORK = "testnet";
    process.env.CULLER_FEE_WALLET = "FeeWallet111111111111111111111111111111111";
    process.env.CULLER_TREASURY_ADDRESS = "Treasury11111111111111111111111111111111111";

    const config = getCullerConfig();
    expect(config.configured).toBe(true);
    if (config.configured) {
      expect(config.network).toBe("testnet");
      expect(config.feeWalletAddress).toBe("FeeWallet111111111111111111111111111111111");
      expect(config.treasuryAddress).toBe("Treasury11111111111111111111111111111111111");
    }
  });
});

describe("getDistributorSecretKey", () => {
  afterEach(() => clearCullerEnv());

  it("returns null when unset", () => {
    clearCullerEnv();
    expect(getDistributorSecretKey()).toBeNull();
  });

  it("parses a valid 64-number JSON array", () => {
    clearCullerEnv();
    const key = Array.from({ length: 64 }, (_, i) => i);
    process.env.CULLER_DISTRIBUTOR_SECRET_KEY = JSON.stringify(key);
    const parsed = getDistributorSecretKey();
    expect(parsed).toEqual(Uint8Array.from(key));
  });

  it("throws on malformed JSON rather than silently ignoring it", () => {
    clearCullerEnv();
    process.env.CULLER_DISTRIBUTOR_SECRET_KEY = "not json";
    expect(() => getDistributorSecretKey()).toThrow();
  });

  it("throws when the array is the wrong length", () => {
    clearCullerEnv();
    process.env.CULLER_DISTRIBUTOR_SECRET_KEY = JSON.stringify([1, 2, 3]);
    expect(() => getDistributorSecretKey()).toThrow();
  });
});
