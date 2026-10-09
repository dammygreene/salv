import { afterEach, describe, expect, it, vi } from "vitest";
import { getAssetsByMints, getAssetsByOwner } from "./quicknodeProvider";

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
    const request = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(request).toMatchObject({
      id: 1,
      method: "getAssetsByOwner",
      params: {
        ownerAddress: "Wallet111",
        page: 1,
        limit: 100,
        options: {
          showFungible: true,
          showCollectionMetadata: true,
        },
      },
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

  it("reads fungible token metadata through batched getAssets when owner results omit fungibles", async () => {
      vi.stubEnv("SOLANA_RPC_URL", "https://quicknode.example");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              result: [
                {
                  interface: "FungibleToken",
                  id: "Mint111",
                  content: { metadata: { name: "USD Coin", symbol: "USDC" } },
                  token_info: { decimals: 6, token_program: "Tokenkeg..." },
                },
              ],
            })
          )
        )
      );

      const result = await getAssetsByMints(["Mint111"]);

      expect(result.assets[0]).toMatchObject({
        mint: "Mint111",
        assetType: "FUNGIBLE",
        name: "USD Coin",
        symbol: "USDC",
        valueUsd: null,
      });
      const request = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
      expect(request).toMatchObject({
        method: "getAssets",
        params: { ids: ["Mint111"], options: { showFungible: true, showCollectionMetadata: true } },
      });
  });

  it("chunks mint enrichment into bounded batch requests", async () => {
      vi.stubEnv("SOLANA_RPC_URL", "https://quicknode.example");
      vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ result: [] })))));

      await getAssetsByMints(Array.from({ length: 101 }, (_, index) => `Mint${index}`));

      expect(fetch).toHaveBeenCalledTimes(3);
      for (const [, init] of vi.mocked(fetch).mock.calls) {
        const request = JSON.parse(init?.body as string);
        expect(request.method).toBe("getAssets");
        expect(request.params.ids.length).toBeLessThanOrEqual(50);
      }
  });
});
