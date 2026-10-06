import { afterEach, describe, expect, it } from "vitest";
import { getCullerExplorerUrl, getPublicCullerConfig, shortenCullerMint } from "./public-config";

const VALID_MINT = "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T";

const PUBLIC_VARS = [
  "NEXT_PUBLIC_CULLER_MINT_ADDRESS",
  "NEXT_PUBLIC_CULLER_TOKEN_SYMBOL",
  "NEXT_PUBLIC_CULLER_TOKEN_NAME",
  "NEXT_PUBLIC_CULLER_NETWORK",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_APP_URL",
];

afterEach(() => {
  for (const name of PUBLIC_VARS) delete process.env[name];
});

describe("getPublicCullerConfig", () => {
  it("uses a polished pre-launch state when the mint is empty", () => {
    const config = getPublicCullerConfig();
    expect(config.mintStatus).toBe("prelaunch");
    expect(config.mintAddress).toBeNull();
    expect(config.tokenSymbol).toBe("CULLER");
  });

  it("accepts a valid public Solana mint", () => {
    process.env.NEXT_PUBLIC_CULLER_MINT_ADDRESS = VALID_MINT;
    process.env.NEXT_PUBLIC_CULLER_NETWORK = "mainnet-beta";
    const config = getPublicCullerConfig();
    expect(config.mintStatus).toBe("live");
    expect(config.mintAddress).toBe(VALID_MINT);
    expect(getCullerExplorerUrl(config)).toBe(`https://solscan.io/token/${VALID_MINT}`);
  });

  it("fails safely for an invalid public mint", () => {
    process.env.NEXT_PUBLIC_CULLER_MINT_ADDRESS = "not-a-solana-address";
    const config = getPublicCullerConfig();
    expect(config.mintStatus).toBe("invalid");
    expect(config.mintAddress).toBeNull();
    expect(config.configurationError).toContain("valid Solana address");
    expect(getCullerExplorerUrl(config)).toBeNull();
  });

  it("uses the configured cluster for non-mainnet explorer links", () => {
    process.env.NEXT_PUBLIC_CULLER_MINT_ADDRESS = VALID_MINT;
    process.env.NEXT_PUBLIC_CULLER_NETWORK = "devnet";
    const config = getPublicCullerConfig();
    expect(getCullerExplorerUrl(config)).toBe(`https://solscan.io/token/${VALID_MINT}?cluster=devnet`);
  });
});

describe("shortenCullerMint", () => {
  it("keeps the full address available while shortening the visual label", () => {
    expect(shortenCullerMint(VALID_MINT)).toBe("4Nd1...DB4T");
  });
});
