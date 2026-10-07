import { afterEach, describe, expect, it } from "vitest";
import { getRobinhoodChainConfig, ROBINHOOD_CHAIN_ID } from "./config";

afterEach(() => {
  delete process.env.ROBINHOOD_RPC_URL;
  delete process.env.ROBINHOOD_CHAIN_ID;
});

describe("Robinhood Chain configuration", () => {
  it("accepts the production RPC and chain ID 4663", () => {
    process.env.ROBINHOOD_RPC_URL = "https://provider.example/robinhood";
    process.env.ROBINHOOD_CHAIN_ID = String(ROBINHOOD_CHAIN_ID);
    const config = getRobinhoodChainConfig();
    expect(config.configured).toBe(true);
    expect(config.rpcUrl).toBe("https://provider.example/robinhood");
    expect(config.chainId).toBe(4663);
  });

  it("reports missing RPC as unavailable configuration", () => {
    process.env.ROBINHOOD_CHAIN_ID = "4663";
    const config = getRobinhoodChainConfig();
    expect(config.configured).toBe(false);
    expect(config.configurationError).toBeNull();
  });

  it("rejects an invalid RPC URL", () => {
    process.env.ROBINHOOD_RPC_URL = "not a URL";
    const config = getRobinhoodChainConfig();
    expect(config.configured).toBe(false);
    expect(config.configurationError).toContain("valid URL");
  });

  it("rejects a chain ID other than 4663", () => {
    process.env.ROBINHOOD_RPC_URL = "https://provider.example/robinhood";
    process.env.ROBINHOOD_CHAIN_ID = "1";
    const config = getRobinhoodChainConfig();
    expect(config.configured).toBe(false);
    expect(config.configurationError).toContain("4663");
  });
});
