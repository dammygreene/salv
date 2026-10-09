import { afterEach, describe, expect, it, vi } from "vitest";
import { getMagicEdenMarketData, getMagicEdenMarketDataBatch } from "./magicEdenProvider";

const compressed = {
  assetId: "CompressedAsset111111111111111111111111111",
  assetType: "COMPRESSED_NFT" as const,
};

describe("Magic Eden compressed NFT provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses the DAS asset ID for metadata, listings, and activities", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: "Example" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ price: 0.12 }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ type: "sale", price: 0.1 }]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getMagicEdenMarketData(compressed, "secret");

    expect(result.source).toBe("magic-eden");
    expect(result.marketExists).toBe(true);
    expect(result.bestListingNative).toBe(0.12);
    expect(result.recentSaleNative).toBe(0.1);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://api-mainnet.magiceden.dev/v2/tokens/CompressedAsset111111111111111111111111111",
      "https://api-mainnet.magiceden.dev/v2/tokens/CompressedAsset111111111111111111111111111/listings",
      "https://api-mainnet.magiceden.dev/v2/tokens/CompressedAsset111111111111111111111111111/activities",
    ]);
  });

  it("uses the keyless public API when no API key is configured", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({}), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getMagicEdenMarketData(compressed, null)).resolves.toMatchObject({
      status: "UNKNOWN",
      confidence: "UNKNOWN",
      providerMode: "KEYLESS",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ accept: "application/json" });
  });

  it("preserves unknown when the provider is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
    await expect(getMagicEdenMarketData(compressed, "secret")).resolves.toMatchObject({
      status: "PROVIDER_UNAVAILABLE",
      providerMode: "AUTHENTICATED",
    });
  });

  it("deduplicates assets and bounds work to four concurrent workers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await getMagicEdenMarketDataBatch([compressed, compressed], "secret");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
