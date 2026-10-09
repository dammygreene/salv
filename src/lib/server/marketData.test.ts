import { afterEach, describe, expect, it, vi } from "vitest";
import { getBatchTokenPrices, getTokenMarketData, probeAmount } from "./marketData";

describe("market data evidence", () => {
  afterEach(() => vi.restoreAllMocks());

  it("builds a deterministic decimal-safe probe amount", () => {
    expect(probeAmount(6)).toBe("1000000");
    expect(probeAmount(0)).toBe("1");
    expect(probeAmount(19)).toBeNull();
  });

  it("preserves price-provider unavailability as an empty price result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("paid only", { status: 400 })));
    await expect(getBatchTokenPrices(["mint-a", "mint-a"])).resolves.toEqual(new Map());
  });

  it("maps a quote route to route evidence", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      routePlan: [{ swapInfo: { label: "Test AMM" } }],
      priceImpactPct: "0.12",
    }), { status: 200 })));
    const result = await getTokenMarketData("mint-a", 6);
    expect(result.routeStatus).toBe("ROUTE_AVAILABLE");
    expect(result.priceImpactBps).toBe(12);
  });

  it("maps an explicit no-route response without guessing from missing price", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("no route", { status: 400 })));
    const result = await getTokenMarketData("mint-a", 6);
    expect(result.routeStatus).toBe("NO_ROUTE");
    expect(result.status).toBe("NO_MARKET");
  });

  it("keeps timeouts and provider errors unknown", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    const result = await getTokenMarketData("mint-a", 6);
    expect(result.routeStatus).toBe("PROVIDER_UNAVAILABLE");
    expect(result.status).toBe("UNKNOWN");
  });
});
