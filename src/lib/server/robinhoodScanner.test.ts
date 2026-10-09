import { afterEach, describe, expect, it, vi } from "vitest";
import { scanRobinhoodWallet } from "./robinhoodScanner";
import { calculateScanAllocation } from "../cull/allocationPolicy";

const VALID_EVM = "0x1111111111111111111111111111111111111111";

afterEach(() => {
  delete process.env.ROBINHOOD_RPC_URL;
  delete process.env.ROBINHOOD_CHAIN_ID;
  delete process.env.ROBINHOOD_INDEXER_URL;
  delete process.env.ROBINHOOD_INDEXER_API_KEY;
  vi.unstubAllGlobals();
});

describe("scanRobinhoodWallet", () => {
  it("rejects an invalid EVM address", async () => {
    await expect(scanRobinhoodWallet("not-an-address")).rejects.toThrow("valid Robinhood wallet");
  });

  it("reports an optional wallet as unavailable when RPC is missing", async () => {
    const result = await scanRobinhoodWallet(VALID_EVM);
    expect(result.state).toBe("UNAVAILABLE");
    expect(result.nativeBalanceWei).toBeNull();
    expect(result.chainId).toBe(4663);
  });

  it("reads the real native balance only after confirming chain ID 4663", async () => {
    process.env.ROBINHOOD_RPC_URL = "https://provider.example/robinhood";
    process.env.ROBINHOOD_CHAIN_ID = "4663";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: "0x1237" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: "0xde0b6b3a7640000" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], next_page_params: null }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await scanRobinhoodWallet(VALID_EVM);
    expect(result.state).toBe("AVAILABLE");
    expect(result.nativeBalanceWei).toBe("1000000000000000000");
    expect(result.assetCounts).toEqual({ native: 1, erc20: 0, erc721: 0, erc1155: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).params).toEqual([VALID_EVM, "latest"]);
  });

  it("discovers ERC-20 and NFT holdings through the indexed provider", async () => {
    process.env.ROBINHOOD_RPC_URL = "https://provider.example/robinhood";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: "0x1237" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: "0x0" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [
          { token: { address: "0x2222222222222222222222222222222222222222", name: "Token", symbol: "TOK", decimals: 18 }, value: "12" },
          { token: { address: "0x3333333333333333333333333333333333333333", name: "NFT", symbol: "NFT", type: "ERC-721" }, token_id: "7", value: "1" },
        ],
        next_page_params: null,
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await scanRobinhoodWallet(VALID_EVM);
    expect(result.state).toBe("AVAILABLE");
    expect(result.discovery).toBe("COMPLETE");
    expect(result.assetCounts).toEqual({ native: 0, erc20: 1, erc721: 1, erc1155: 0 });
    expect(result.assets.map((asset) => [asset.kind, asset.network])).toEqual([["TOKEN", "robinhood"], ["NFT", "robinhood"]]);
    expect(calculateScanAllocation(result.assets).points).toBe(10);
    expect(calculateScanAllocation([]).points).toBe(0);
  });

  it("sends the indexed-provider API key server-side when configured", async () => {
    process.env.ROBINHOOD_RPC_URL = "https://provider.example/robinhood";
    process.env.ROBINHOOD_INDEXER_API_KEY = "test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: "0x1237" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: "0x0" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], next_page_params: null }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await scanRobinhoodWallet(VALID_EVM);
    expect(fetchMock.mock.calls[2][1].headers).toEqual({ "x-api-key": "test-key" });
  });

  it("reports provider failures instead of treating them as an empty wallet", async () => {
    process.env.ROBINHOOD_RPC_URL = "https://provider.example/robinhood";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await scanRobinhoodWallet(VALID_EVM);
    expect(result.state).toBe("UNAVAILABLE");
    expect(result.discovery).toBe("UNAVAILABLE");
    expect(result.assets).toEqual([]);
    expect(result.reason).toContain("could not be reached");
  });

  it("keeps Robinhood unavailable when the configured RPC reports another chain", async () => {
    process.env.ROBINHOOD_RPC_URL = "https://provider.example/robinhood";
    process.env.ROBINHOOD_CHAIN_ID = "4663";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: "0x1" }), { status: 200 })));

    const result = await scanRobinhoodWallet(VALID_EVM);
    expect(result.state).toBe("UNAVAILABLE");
    expect(result.reason).toContain("expected 4663");
  });

  it("returns not linked without contacting the RPC", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await scanRobinhoodWallet(null);
    expect(result.state).toBe("NOT_LINKED");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
