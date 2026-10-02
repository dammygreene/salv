import { afterEach, describe, expect, it } from "vitest";
import { getDistributorSecretKey, getSalvConfig } from "./config";

const SALV_VARS = ["SALV_MINT_ADDRESS", "SALV_REWARD_VAULT", "SALV_DISTRIBUTOR", "SOLANA_RPC_URL", "SALV_FEE_WALLET", "SALV_NETWORK"];

function clearSalvEnv() {
  for (const name of SALV_VARS) delete process.env[name];
  delete process.env.SALV_DISTRIBUTOR_SECRET_KEY;
}

describe("getSalvConfig", () => {
  afterEach(() => clearSalvEnv());

  it("reports not configured when required variables are missing", () => {
    clearSalvEnv();
    const config = getSalvConfig();
    expect(config.configured).toBe(false);
    if (!config.configured) {
      expect(config.missing).toContain("SALV_MINT_ADDRESS");
    }
  });

  it("reports configured once every required variable is set, and defaults network to devnet", () => {
    clearSalvEnv();
    process.env.SALV_MINT_ADDRESS = "Mint1111111111111111111111111111111111111";
    process.env.SALV_REWARD_VAULT = "Vault111111111111111111111111111111111111";
    process.env.SALV_DISTRIBUTOR = "Distributor11111111111111111111111111111";
    process.env.SOLANA_RPC_URL = "https://api.devnet.solana.com";

    const config = getSalvConfig();
    expect(config.configured).toBe(true);
    if (config.configured) {
      expect(config.network).toBe("devnet");
      expect(config.feeWalletAddress).toBeNull();
    }
  });

  it("respects an explicit SALV_NETWORK and SALV_FEE_WALLET", () => {
    clearSalvEnv();
    process.env.SALV_MINT_ADDRESS = "Mint1111111111111111111111111111111111111";
    process.env.SALV_REWARD_VAULT = "Vault111111111111111111111111111111111111";
    process.env.SALV_DISTRIBUTOR = "Distributor11111111111111111111111111111";
    process.env.SOLANA_RPC_URL = "https://api.devnet.solana.com";
    process.env.SALV_NETWORK = "testnet";
    process.env.SALV_FEE_WALLET = "FeeWallet111111111111111111111111111111111";

    const config = getSalvConfig();
    expect(config.configured).toBe(true);
    if (config.configured) {
      expect(config.network).toBe("testnet");
      expect(config.feeWalletAddress).toBe("FeeWallet111111111111111111111111111111111");
    }
  });
});

describe("getDistributorSecretKey", () => {
  afterEach(() => clearSalvEnv());

  it("returns null when unset", () => {
    clearSalvEnv();
    expect(getDistributorSecretKey()).toBeNull();
  });

  it("parses a valid 64-number JSON array", () => {
    clearSalvEnv();
    const key = Array.from({ length: 64 }, (_, i) => i);
    process.env.SALV_DISTRIBUTOR_SECRET_KEY = JSON.stringify(key);
    const parsed = getDistributorSecretKey();
    expect(parsed).toEqual(Uint8Array.from(key));
  });

  it("throws on malformed JSON rather than silently ignoring it", () => {
    clearSalvEnv();
    process.env.SALV_DISTRIBUTOR_SECRET_KEY = "not json";
    expect(() => getDistributorSecretKey()).toThrow();
  });

  it("throws when the array is the wrong length", () => {
    clearSalvEnv();
    process.env.SALV_DISTRIBUTOR_SECRET_KEY = JSON.stringify([1, 2, 3]);
    expect(() => getDistributorSecretKey()).toThrow();
  });
});
