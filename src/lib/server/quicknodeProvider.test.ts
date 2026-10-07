import { afterEach, describe, expect, it, vi } from "vitest";
import { getAssetsByOwner } from "./quicknodeProvider";

describe("QuickNode asset provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("maps enhanced asset metadata and token value from the configured Solana endpoint", async () => {
    vi.stubEnv("SOLANA_RPC_URL", "https://quicknode.example");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            result: {
              total: 1,
              items: [
                {
                  id: "Mint111",
                  content: {
                    metadata: { name: "Example", symbol: "EX" },
                    links: { image: "https://example/image.png" },
                  },
                  token_info: {
                    decimals: 2,
                    balance: "1234",
                    price_info: { price_per_token: 0.5 },
                  },
                },
              ],
            },
          })
        )
      )
    );

    const result = await getAssetsByOwner("Wallet111");

    expect(result.status).toBe("AVAILABLE");
    expect(result.assets[0]).toMatchObject({
      mint: "Mint111",
      name: "Example",
      symbol: "EX",
      imageUrl: "https://example/image.png",
      valueUsd: 6.17,
      source: "quicknode-das",
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://quicknode.example",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"method":"getAssetsByOwner"'),
      })
    );
  });

  it("returns unavailable when the configured endpoint does not support enhanced asset data", async () => {
    vi.stubEnv("SOLANA_RPC_URL", "https://quicknode.example");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "method not found" } }))));

    const result = await getAssetsByOwner("Wallet111");

    expect(result).toEqual({
      assets: [],
      status: "UNAVAILABLE",
      reason: "method not found",
    });
  });
});
