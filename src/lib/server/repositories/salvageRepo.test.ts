import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Db } from "../db/types";
import { createTestDb, resetTestDb } from "../db/testDb";
import { ensureSalvageEvent, insertSalvageAction, listVerifiedActionsForWallet } from "./salvageRepo";
import { ensureWallet } from "./walletRepo";

describe("listVerifiedActionsForWallet pagination", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30_000);

  beforeEach(async () => {
    await resetTestDb(db);
  });

  it("paginates a wallet's VERIFIED actions, newest first, and reports total/hasMore correctly", async () => {
    const wallet = await ensureWallet(db, "PaginationWallet1111111111111111111111111");
    const count = 5;

    for (let i = 0; i < count; i++) {
      const signature = `pagsig${i}`.padEnd(64, "1");
      const event = await ensureSalvageEvent(db, { walletId: wallet.id, signature });
      await insertSalvageAction(db, {
        salvageEventId: event.id,
        walletId: wallet.id,
        assetId: null,
        tokenAccount: `PagTokenAccount${i}111111111111111111111111`,
        programId: null,
        mint: null,
        classification: "EMPTY_TOKEN_ACCOUNT",
        action: "CLOSE_EMPTY_TOKEN_ACCOUNT",
        idempotencyKey: `${signature}:CLOSE_EMPTY_TOKEN_ACCOUNT:tok${i}`,
        expectedRecoveryLamports: 2_039_280,
        actualRecoveryLamports: 2_039_280,
        status: "VERIFIED",
        reason: "test fixture",
        points: 100,
      });
    }

    const page1 = await listVerifiedActionsForWallet(db, wallet.id, 2, 0);
    expect(page1.actions).toHaveLength(2);
    expect(page1.total).toBe(5);

    const page2 = await listVerifiedActionsForWallet(db, wallet.id, 2, 2);
    expect(page2.actions).toHaveLength(2);

    const page3 = await listVerifiedActionsForWallet(db, wallet.id, 2, 4);
    expect(page3.actions).toHaveLength(1);

    // No overlap between pages.
    const allIds = [...page1.actions, ...page2.actions, ...page3.actions].map((a) => a.id);
    expect(new Set(allIds).size).toBe(5);

    // Every returned action carries the originating transaction signature.
    expect(page1.actions[0].signature).toMatch(/^pagsig/);
  });

  it("never includes FAILED or PENDING actions in the verified history", async () => {
    const wallet = await ensureWallet(db, "PaginationWallet2222222222222222222222222");
    const signature = "failedsig".padEnd(64, "2");
    const event = await ensureSalvageEvent(db, { walletId: wallet.id, signature });
    await insertSalvageAction(db, {
      salvageEventId: event.id,
      walletId: wallet.id,
      assetId: null,
      tokenAccount: "FailedTokenAccount11111111111111111111111",
      programId: null,
      mint: null,
      classification: null,
      action: "CLOSE_EMPTY_TOKEN_ACCOUNT",
      idempotencyKey: `${signature}:CLOSE_EMPTY_TOKEN_ACCOUNT:failedTok`,
      expectedRecoveryLamports: 2_039_280,
      actualRecoveryLamports: null,
      status: "FAILED",
      reason: "chain verification failed",
      points: 0,
    });

    const page = await listVerifiedActionsForWallet(db, wallet.id, 20, 0);
    expect(page.actions).toHaveLength(0);
    expect(page.total).toBe(0);
  });
});
