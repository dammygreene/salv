import { afterEach, describe, expect, it, vi } from "vitest";
import { scanRobinhoodWallet } from "./robinhoodScanner";

const VALID_EVM = "0x1111111111111111111111111111111111111111";

afterEach(() => {
  delete process.env.ROBINHOOD_RPC_URL;
  delete process.env.ROBINHOOD_CHAIN_ID;
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
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: "0xde0b6b3a7640000" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await scanRobinhoodWallet(VALID_EVM);
    expect(result.state).toBe("AVAILABLE");
    expect(result.nativeBalanceWei).toBe("1000000000000000000");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).params).toEqual([VALID_EVM, "latest"]);
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
