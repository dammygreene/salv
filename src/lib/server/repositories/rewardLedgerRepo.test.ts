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

const SOLANA_A = "SolanaWalletAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1";
const SOLANA_B = "SolanaWalletBBBBBBBBBBBBBBBBBBBBBBBBBBBBB2";
const ROBINHOOD_1 = "0x1111111111111111111111111111111111aaaa";
const ROBINHOOD_2 = "0x2222222222222222222222222222222222bbbb";

describe("rewardLedgerRepo (Phase 8: Solana-primary combined submission)", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30_000);

  beforeEach(async () => {
    await resetTestDb(db);
  });

  it("creates a new row on first scan (Solana only)", async () => {
    const entry = await upsertRewardLedgerEntry(db, {
      solanaWallet: SOLANA_A,
      robinhoodWallet: null,
      epochNumber: 1,
      salvAllocatedBaseUnits: 1_000_000_000n,
      status: "ALLOCATED",
      scanId: crypto.randomUUID(),
    });
    expect(entry.solanaWallet).toBe(SOLANA_A);
    expect(entry.robinhoodWallet).toBeNull();
    expect(entry.epochNumber).toBe(1);
    expect(entry.salvAllocatedBaseUnits).toBe(1_000_000_000n);
    expect(entry.status).toBe("ALLOCATED");

    expect(await listRewardLedgerEntries(db)).toHaveLength(1);
  });

  it("creates a new row for a combined Solana + Robinhood submission -- still exactly ONE row", async () => {
    const entry = await upsertRewardLedgerEntry(db, {
      solanaWallet: SOLANA_A,
      robinhoodWallet: ROBINHOOD_1,
      epochNumber: 1,
      salvAllocatedBaseUnits: 1_000_000_000n,
      status: "ALLOCATED",
      scanId: crypto.randomUUID(),
    });
    expect(entry.solanaWallet).toBe(SOLANA_A);
    expect(entry.robinhoodWallet).toBe(ROBINHOOD_1);

    const all = await listRewardLedgerEntries(db);
    expect(all).toHaveLength(1); // one combined submission, not two reward identities
  });

  it("rejects a solanaWallet that is empty/whitespace-only", async () => {
    await expect(
      upsertRewardLedgerEntry(db, {
        solanaWallet: "   ",
        robinhoodWallet: null,
        epochNumber: 1,
        salvAllocatedBaseUnits: 0n,
        status: "ALLOCATED",
        scanId: crypto.randomUUID(),
      })
    ).rejects.toBeInstanceOf(RewardLedgerError);
  });

  it("rescanning the same Solana wallet + epoch updates the existing row instead of creating a duplicate", async () => {
    const first = await upsertRewardLedgerEntry(db, {
      solanaWallet: SOLANA_A,
      robinhoodWallet: ROBINHOOD_1,
      epochNumber: 1,
      salvAllocatedBaseUnits: 1_000_000_000n,
      status: "ALLOCATED",
      scanId: crypto.randomUUID(),
    });
    const second = await upsertRewardLedgerEntry(db, {
      solanaWallet: SOLANA_A,
      robinhoodWallet: ROBINHOOD_1,
      epochNumber: 1,
      salvAllocatedBaseUnits: 2_500_000_000n,
      status: "CLAIMED",
      scanId: crypto.randomUUID(),
    });

    expect(second.id).toBe(first.id); // same row, not a new one
    expect(second.salvAllocatedBaseUnits).toBe(2_500_000_000n);
    expect(second.status).toBe("CLAIMED");
    expect(await listRewardLedgerEntries(db)).toHaveLength(1);
  });

  it("rescanning the same Solana wallet + epoch with a DIFFERENT Robinhood address replaces the linked address deterministically (latest submission wins)", async () => {
    await upsertRewardLedgerEntry(db, {
      solanaWallet: SOLANA_A,
      robinhoodWallet: ROBINHOOD_1,
      epochNumber: 1,
      salvAllocatedBaseUnits: 1_000_000_000n,
      status: "ALLOCATED",
      scanId: crypto.randomUUID(),
    });
    const updated = await upsertRewardLedgerEntry(db, {
      solanaWallet: SOLANA_A,
      robinhoodWallet: ROBINHOOD_2,
      epochNumber: 1,
      salvAllocatedBaseUnits: 1_000_000_000n,
      status: "ALLOCATED",
      scanId: crypto.randomUUID(),
    });

    expect(updated.robinhoodWallet).toBe(ROBINHOOD_2); // replaced, not merged/appended
    const all = await listRewardLedgerEntries(db);
    expect(all).toHaveLength(1); // never two competing Robinhood links for one Solana wallet + epoch
  });

  it("rescanning the same Solana wallet + epoch with NO Robinhood address clears the previously linked one", async () => {
    await upsertRewardLedgerEntry(db, {
      solanaWallet: SOLANA_A,
      robinhoodWallet: ROBINHOOD_1,
      epochNumber: 1,
      salvAllocatedBaseUnits: 1_000_000_000n,
      status: "ALLOCATED",
      scanId: crypto.randomUUID(),
    });
    const updated = await upsertRewardLedgerEntry(db, {
      solanaWallet: SOLANA_A,
      robinhoodWallet: null,
      epochNumber: 1,
      salvAllocatedBaseUnits: 1_000_000_000n,
      status: "ALLOCATED",
      scanId: crypto.randomUUID(),
    });

    expect(updated.robinhoodWallet).toBeNull();
    expect(await listRewardLedgerEntries(db)).toHaveLength(1);
  });

  it("the same Solana wallet in a NEW epoch creates a second, separate row", async () => {
    await upsertRewardLedgerEntry(db, {
      solanaWallet: SOLANA_A,
      robinhoodWallet: ROBINHOOD_1,
      epochNumber: 1,
      salvAllocatedBaseUnits: 1_000_000_000n,
      status: "ALLOCATED",
      scanId: crypto.randomUUID(),
    });
    await upsertRewardLedgerEntry(db, {
      solanaWallet: SOLANA_A,
      robinhoodWallet: ROBINHOOD_1,
      epochNumber: 2,
      salvAllocatedBaseUnits: 500_000_000n,
      status: "ALLOCATED",
      scanId: crypto.randomUUID(),
    });

    const all = await listRewardLedgerEntries(db);
    expect(all).toHaveLength(2);
    expect(new Set(all.map((e) => e.epochNumber))).toEqual(new Set([1, 2]));
  });

  it("a wallet with no resolvable epoch still gets exactly one NO_EPOCH row, not one per scan", async () => {
    await upsertRewardLedgerEntry(db, {
      solanaWallet: SOLANA_A,
      robinhoodWallet: null,
      epochNumber: null,
      salvAllocatedBaseUnits: 0n,
      status: "NO_EPOCH",
      scanId: crypto.randomUUID(),
    });
    await upsertRewardLedgerEntry(db, {
      solanaWallet: SOLANA_A,
      robinhoodWallet: null,
      epochNumber: null,
      salvAllocatedBaseUnits: 0n,
      status: "NO_EPOCH",
      scanId: crypto.randomUUID(),
    });

    expect(await listRewardLedgerEntries(db)).toHaveLength(1);
  });

  it("concurrent upserts for two different Solana wallets never clobber each other", async () => {
    const [a, b] = await Promise.all([
      upsertRewardLedgerEntry(db, {
        solanaWallet: SOLANA_A,
        robinhoodWallet: null,
        epochNumber: 1,
        salvAllocatedBaseUnits: 1_000_000_000n,
        status: "ALLOCATED",
        scanId: crypto.randomUUID(),
      }),
      upsertRewardLedgerEntry(db, {
        solanaWallet: SOLANA_B,
        robinhoodWallet: ROBINHOOD_2,
        epochNumber: 1,
        salvAllocatedBaseUnits: 9_000_000_000n,
        status: "ALLOCATED",
        scanId: crypto.randomUUID(),
      }),
    ]);

    expect(a.solanaWallet).toBe(SOLANA_A);
    expect(b.solanaWallet).toBe(SOLANA_B);

    const rowA = await getRewardLedgerEntry(db, SOLANA_A, 1);
    const rowB = await getRewardLedgerEntry(db, SOLANA_B, 1);
    expect(rowA?.salvAllocatedBaseUnits).toBe(1_000_000_000n);
    expect(rowB?.salvAllocatedBaseUnits).toBe(9_000_000_000n);
    expect(await listRewardLedgerEntries(db)).toHaveLength(2);
  });

  it("repeated concurrent upserts for the SAME Solana wallet + epoch serialize to a single consistent row -- never two competing allocations for one wallet+epoch", async () => {
    const attempts = Array.from({ length: 5 }, (_, i) =>
      upsertRewardLedgerEntry(db, {
        solanaWallet: SOLANA_A,
        robinhoodWallet: i % 2 === 0 ? ROBINHOOD_1 : ROBINHOOD_2,
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

  it("rejects a negative allocation", async () => {
    await expect(
      upsertRewardLedgerEntry(db, {
        solanaWallet: SOLANA_A,
        robinhoodWallet: null,
        epochNumber: 1,
        salvAllocatedBaseUnits: -1n,
        status: "ALLOCATED",
        scanId: crypto.randomUUID(),
      })
    ).rejects.toBeInstanceOf(RewardLedgerError);
  });

  describe("serializeRewardLedgerToCsv", () => {
    it("produces the exact required header and column order", async () => {
      await upsertRewardLedgerEntry(db, {
        solanaWallet: SOLANA_A,
        robinhoodWallet: ROBINHOOD_1,
        epochNumber: 12,
        salvAllocatedBaseUnits: 1_250_000_000_000n, // 1250.00 SALV
        status: "ALLOCATED",
        scanId: crypto.randomUUID(),
      });
      const csv = serializeRewardLedgerToCsv(await listRewardLedgerEntries(db));
      const lines = csv.trim().split("\n");
      expect(lines[0]).toBe("solana_wallet,robinhood_wallet,epoch_id,salv_allocated,scanned_at,status");
      expect(lines[1]).toMatch(
        new RegExp(`^${SOLANA_A},${ROBINHOOD_1},12,1250\\.000000000,\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z,ALLOCATED$`)
      );
    });

    it("renders an empty robinhood_wallet field (not a placeholder string) when none is linked", async () => {
      await upsertRewardLedgerEntry(db, {
        solanaWallet: SOLANA_A,
        robinhoodWallet: null,
        epochNumber: 1,
        salvAllocatedBaseUnits: 0n,
        status: "NO_SNAPSHOT",
        scanId: crypto.randomUUID(),
      });
      const csv = serializeRewardLedgerToCsv(await listRewardLedgerEntries(db));
      const lines = csv.trim().split("\n");
      expect(lines[1]).toBe(`${SOLANA_A},,1,0.000000000,${lines[1].split(",")[4]},NO_SNAPSHOT`);
    });

    it("never includes any secret-shaped field (no keys, seeds, signatures, RPC urls)", async () => {
      await upsertRewardLedgerEntry(db, {
        solanaWallet: SOLANA_A,
        robinhoodWallet: ROBINHOOD_1,
        epochNumber: null,
        salvAllocatedBaseUnits: 0n,
        status: "NO_EPOCH",
        scanId: crypto.randomUUID(),
      });
      const csv = serializeRewardLedgerToCsv(await listRewardLedgerEntries(db));
      expect(csv.toLowerCase()).not.toMatch(/secret|private.?key|seed|rpc|signature/);
    });

    it("renders an empty ledger as just the header", () => {
      expect(serializeRewardLedgerToCsv([])).toBe("solana_wallet,robinhood_wallet,epoch_id,salv_allocated,scanned_at,status\n");
    });
  });
});
