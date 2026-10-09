import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/walletAddress", () => ({
  validateCombinedWalletSubmission: vi.fn(() => ({
    valid: true,
    submission: { solanaWallet: "wallet", robinhoodWallet: null },
  })),
}));
vi.mock("@/lib/solana/scanner/scan", () => ({
  scanWallet: vi.fn().mockResolvedValue({
    assets: [],
    accountsTotal: 252,
    accountsProcessed: 252,
    accountsRemaining: 0,
    truncated: false,
    summary: { empty: 0, nonEmpty: 252, fungible: 252, nftShaped: 0 },
    programStatus: { splToken: "available", token2022: "available" },
  }),
}));
vi.mock("@/lib/server/assetEnrichment", () => ({
  enrichSolanaAssets: vi.fn().mockResolvedValue({
    status: "AVAILABLE",
    assets: [],
  }),
}));
vi.mock("@/lib/server/robinhoodScanner", () => ({
  scanRobinhoodWallet: vi.fn().mockResolvedValue({
    submitted: false,
    state: "NOT_LINKED",
    nativeBalanceWei: null,
    chainId: 4663,
  }),
}));
vi.mock("@/lib/server/db/client", () => ({
  DatabaseConfigurationError: class DatabaseConfigurationError extends Error {},
  getDb: vi.fn().mockResolvedValue({ query: vi.fn(), transaction: vi.fn() }),
}));
vi.mock("@/lib/server/repositories/epochRepo", () => ({
  listEpochs: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/server/repositories/rewardLedgerRepo", () => ({
  upsertRewardLedgerEntry: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/culler/claims", () => ({
  getClaimView: vi.fn(),
}));

describe("POST /api/culler/scan", () => {
  it("preserves the scanner result shape through the route", async () => {
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost/api/culler/scan", {
      method: "POST",
      body: JSON.stringify({ solanaWallet: "wallet" }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.scan.solana).toMatchObject({
      succeeded: true,
      accountsTotal: 252,
      accountsProcessed: 252,
      truncated: false,
    });
    expect(body.enrichment).toEqual({ status: "AVAILABLE" });
    expect(body.csvRecorded).toBe(true);
  });
});
