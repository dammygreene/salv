import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Db } from "../db/types";
import { createTestDb, resetTestDb } from "../db/testDb";
import {
  getRewardLedgerEntry,
  listRewardLedgerEntries,
  RewardLedgerError,
  serializeRewardLedgerToCsv,
  upsertRewardLedgerEntry,
} from "./rewardLedgerRepo";

const WALLET_A = "WalletAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1";
const WALLET_B = "WalletBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB2";

describe("rewardLedgerRepo", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30_000);

  beforeEach(async () => {
    await resetTestDb(db);
  });

  it("creates a new row on first scan", async () => {
    const entry = await upsertRewardLedgerEntry(db, {
      walletAddress: WALLET_A,
      network: "solana",
      epochNumber: 1,
      salvAllocatedBaseUnits: 1_000_000_000n,
      status: "ALLOCATED",
      scanId: "ea5f9101-efdf-463e-a127-c6fb021c8f6a",
    });
    expect(entry.walletAddress).toBe(WALLET_A);
    expect(entry.epochNumber).toBe(1);
    expect(entry.salvAllocatedBaseUnits).toBe(1_000_000_000n);
    expect(entry.status).toBe("ALLOCATED");

    const all = await listRewardLedgerEntries(db);
    expect(all).toHaveLength(1);
  });

  it("rescanning the same wallet+epoch updates the existing row instead of creating a duplicate", async () => {
    const first = await upsertRewardLedgerEntry(db, {
      walletAddress: WALLET_A,
      network: "solana",
      epochNumber: 1,
      salvAllocatedBaseUnits: 1_000_000_000n,
      status: "ALLOCATED",
      scanId: "ea5f9101-efdf-463e-a127-c6fb021c8f6a",
    });
    const second = await upsertRewardLedgerEntry(db, {
      walletAddress: WALLET_A,
      network: "solana",
      epochNumber: 1,
      salvAllocatedBaseUnits: 2_500_000_000n,
      status: "CLAIMED",
      scanId: "862730f9-4da5-4d22-a8d7-74a0ef23d4bc",
    });

    expect(second.id).toBe(first.id); // same row, not a new one
    expect(second.salvAllocatedBaseUnits).toBe(2_500_000_000n);
    expect(second.status).toBe("CLAIMED");

    const all = await listRewardLedgerEntries(db);
    expect(all).toHaveLength(1);
  });

  it("the same wallet in a new epoch creates a second, separate row", async () => {
    await upsertRewardLedgerEntry(db, {
      walletAddress: WALLET_A,
      network: "solana",
      epochNumber: 1,
      salvAllocatedBaseUnits: 1_000_000_000n,
      status: "ALLOCATED",
      scanId: "ea5f9101-efdf-463e-a127-c6fb021c8f6a",
    });
    await upsertRewardLedgerEntry(db, {
      walletAddress: WALLET_A,
      network: "solana",
      epochNumber: 2,
      salvAllocatedBaseUnits: 500_000_000n,
      status: "ALLOCATED",
      scanId: "862730f9-4da5-4d22-a8d7-74a0ef23d4bc",
    });

    const all = await listRewardLedgerEntries(db);
    expect(all).toHaveLength(2);
    expect(new Set(all.map((e) => e.epochNumber))).toEqual(new Set([1, 2]));
  });

  it("a wallet with no resolvable epoch still gets exactly one NO_EPOCH row, not one per scan", async () => {
    await upsertRewardLedgerEntry(db, {
      walletAddress: WALLET_A,
      network: "solana",
      epochNumber: null,
      salvAllocatedBaseUnits: 0n,
      status: "NO_EPOCH",
      scanId: "ea5f9101-efdf-463e-a127-c6fb021c8f6a",
    });
    await upsertRewardLedgerEntry(db, {
      walletAddress: WALLET_A,
      network: "solana",
      epochNumber: null,
      salvAllocatedBaseUnits: 0n,
      status: "NO_EPOCH",
      scanId: "862730f9-4da5-4d22-a8d7-74a0ef23d4bc",
    });

    const all = await listRewardLedgerEntries(db);
    expect(all).toHaveLength(1);
  });

  it("concurrent upserts for two different wallets never clobber each other", async () => {
    const [a, b] = await Promise.all([
      upsertRewardLedgerEntry(db, {
        walletAddress: WALLET_A,
        network: "solana",
        epochNumber: 1,
        salvAllocatedBaseUnits: 1_000_000_000n,
        status: "ALLOCATED",
        scanId: "2f94ac16-433c-47ec-b9e8-4c66a9476266",
      }),
      upsertRewardLedgerEntry(db, {
        walletAddress: WALLET_B,
        network: "solana",
        epochNumber: 1,
        salvAllocatedBaseUnits: 9_000_000_000n,
        status: "ALLOCATED",
        scanId: "e79f7e5a-00aa-4d7c-8282-404a630e4471",
      }),
    ]);

    expect(a.walletAddress).toBe(WALLET_A);
    expect(b.walletAddress).toBe(WALLET_B);

    const rowA = await getRewardLedgerEntry(db, WALLET_A, "solana", 1);
    const rowB = await getRewardLedgerEntry(db, WALLET_B, "solana", 1);
    expect(rowA?.salvAllocatedBaseUnits).toBe(1_000_000_000n);
    expect(rowB?.salvAllocatedBaseUnits).toBe(9_000_000_000n);

    const all = await listRewardLedgerEntries(db);
    expect(all).toHaveLength(2);
  });

  it("repeated concurrent upserts for the SAME wallet+epoch serialize to a single consistent row, not a lost update or a duplicate", async () => {
    const attempts = Array.from({ length: 5 }, (_, i) =>
      upsertRewardLedgerEntry(db, {
        walletAddress: WALLET_A,
        network: "solana",
        epochNumber: 1,
        salvAllocatedBaseUnits: BigInt(i + 1) * 1_000_000_000n,
        status: "ALLOCATED",
        scanId: crypto.randomUUID(),
      })
    );
    await Promise.all(attempts);

    const all = await listRewardLedgerEntries(db);
    expect(all).toHaveLength(1); // never duplicated despite 5 concurrent writers
  });

  it("an EVM wallet is tracked independently of a Solana wallet with the same address text would be (different network column)", async () => {
    await upsertRewardLedgerEntry(db, {
      walletAddress: WALLET_A,
      network: "solana",
      epochNumber: 1,
      salvAllocatedBaseUnits: 1_000_000_000n,
      status: "ALLOCATED",
      scanId: "ea5f9101-efdf-463e-a127-c6fb021c8f6a",
    });
    await upsertRewardLedgerEntry(db, {
      walletAddress: WALLET_A,
      network: "evm",
      epochNumber: null,
      salvAllocatedBaseUnits: 0n,
      status: "NOT_APPLICABLE",
      scanId: "862730f9-4da5-4d22-a8d7-74a0ef23d4bc",
    });

    const all = await listRewardLedgerEntries(db);
    expect(all).toHaveLength(2);
  });

  it("rejects a negative allocation", async () => {
    await expect(
      upsertRewardLedgerEntry(db, {
        walletAddress: WALLET_A,
        network: "solana",
        epochNumber: 1,
        salvAllocatedBaseUnits: -1n,
        status: "ALLOCATED",
        scanId: "ea5f9101-efdf-463e-a127-c6fb021c8f6a",
      })
    ).rejects.toBeInstanceOf(RewardLedgerError);
  });

  describe("serializeRewardLedgerToCsv", () => {
    it("produces the exact required header and column order", async () => {
      await upsertRewardLedgerEntry(db, {
        walletAddress: WALLET_A,
        network: "solana",
        epochNumber: 12,
        salvAllocatedBaseUnits: 1_250_000_000_000n, // 1250.00 SALV
        status: "ALLOCATED",
        scanId: "ea5f9101-efdf-463e-a127-c6fb021c8f6a",
      });
      const csv = serializeRewardLedgerToCsv(await listRewardLedgerEntries(db));
      const lines = csv.trim().split("\n");
      expect(lines[0]).toBe("wallet_address,network,salv_allocated,epoch_id,scanned_at,status");
      // scanned_at must be real ISO-8601 (e.g. 2026-10-06T03:12:42.000Z),
      // never a Date's locale-dependent toString() output.
      expect(lines[1]).toMatch(
        new RegExp(`^${WALLET_A},solana,1250\\.000000000,12,\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z,ALLOCATED$`)
      );
    });

    it("never includes any secret-shaped field (no keys, seeds, signatures, RPC urls)", async () => {
      await upsertRewardLedgerEntry(db, {
        walletAddress: WALLET_A,
        network: "evm",
        epochNumber: null,
        salvAllocatedBaseUnits: 0n,
        status: "NOT_APPLICABLE",
        scanId: "ea5f9101-efdf-463e-a127-c6fb021c8f6a",
      });
      const csv = serializeRewardLedgerToCsv(await listRewardLedgerEntries(db));
      expect(csv.toLowerCase()).not.toMatch(/secret|private.?key|seed|rpc|signature/);
    });

    it("renders an empty ledger as just the header", () => {
      expect(serializeRewardLedgerToCsv([])).toBe("wallet_address,network,salv_allocated,epoch_id,scanned_at,status\n");
    });
  });
});
