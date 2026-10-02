import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ParsedTransactionWithMeta } from "@solana/web3.js";
import { Db } from "./db/types";
import { createTestDb, resetTestDb } from "./db/testDb";
import { verifyAndRecordSalvage } from "./verifyAndRecordSalvage";
import { createEpoch, activateEpoch, getActiveEpoch } from "./repositories/epochRepo";
import { getWalletStats, getWalletPointsForEpoch } from "./repositories/pointsRepo";
import { ensureWallet } from "./repositories/walletRepo";

// Same crafted-transaction technique as verifySalvageTransaction.test.ts,
// but driving the full verify -> record -> points pipeline against a
// real (PGlite) Postgres instance instead of only the pure function.

function wallet(n: number): string {
  return `Wallet${n}11111111111111111111111111111${n}`;
}

function tokenAccount(n: number): string {
  return `TokenAcct${n}1111111111111111111111111111${n}`;
}

const SIGNATURE_PREFIX = "sig";
function signature(n: number): string {
  return (SIGNATURE_PREFIX + n).padEnd(64, "1");
}

function makeCloseTx(opts: {
  wallet: string;
  tokenAccount: string;
  owner?: string;
  err?: unknown;
  preLamports?: number;
  postLamports?: number;
  slot?: number;
  skipClose?: boolean;
}): ParsedTransactionWithMeta {
  const owner = opts.owner ?? opts.wallet;
  const pre = opts.preLamports ?? 2_039_280;
  const post = opts.postLamports ?? 0;
  const closeIx = opts.skipClose
    ? null
    : {
        program: "spl-token",
        programId: {} as never,
        parsed: {
          type: "closeAccount",
          info: { account: opts.tokenAccount, destination: opts.wallet, owner },
        },
      };

  return {
    slot: opts.slot ?? 42,
    transaction: {
      message: {
        accountKeys: [opts.wallet, opts.tokenAccount] as never,
        instructions: (closeIx ? [closeIx] : []) as never,
      },
      signatures: [],
    },
    meta: {
      err: opts.err ?? null,
      preBalances: [5_000_000, pre],
      postBalances: [5_000_000 + (pre - post), post],
      innerInstructions: [],
      logMessages: [],
      fee: 5000,
    },
  } as unknown as ParsedTransactionWithMeta;
}

describe("verifyAndRecordSalvage (full pipeline against a real Postgres/PGlite instance)", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30_000);

  beforeEach(async () => {
    await resetTestDb(db);
  });

  afterAll(async () => {
    // PGlite has no explicit close needed for in-memory instances used only in tests.
  });

  it("awards deterministic points for a verified CLOSE_EMPTY_TOKEN_ACCOUNT action", async () => {
    const w = wallet(1);
    const ta = tokenAccount(1);
    const sig = signature(1);
    const tx = makeCloseTx({ wallet: w, tokenAccount: ta, preLamports: 2_039_280 });

    const events = await verifyAndRecordSalvage(
      db,
      { wallet: w, signature: sig, actions: [{ type: "CLOSE_EMPTY_TOKEN_ACCOUNT", tokenAccount: ta, mint: null, programId: null, expectedRecoveryLamports: 2_039_280 }] },
      async () => tx
    );

    expect(events).toHaveLength(1);
    expect(events[0].status).toBe("VERIFIED");
    expect(events[0].points).toBe(100); // base points only; 2,039,280 lamports is below every bonus tier
    expect(events[0].actualRecoveryLamports).toBe(2_039_280);

    const walletRecord = await ensureWallet(db, w);
    const stats = await getWalletStats(db, walletRecord.id);
    expect(stats.points).toBe(100);
    expect(stats.verifiedEvents).toBe(1);
    expect(stats.assetsSalvaged).toBe(1);
  });

  it("awards nothing for a failed (on-chain error) transaction", async () => {
    const w = wallet(2);
    const ta = tokenAccount(2);
    const sig = signature(2);
    const tx = makeCloseTx({ wallet: w, tokenAccount: ta, err: { InstructionError: [0, "Custom"] } });

    const events = await verifyAndRecordSalvage(
      db,
      { wallet: w, signature: sig, actions: [{ type: "CLOSE_EMPTY_TOKEN_ACCOUNT", tokenAccount: ta, mint: null, programId: null, expectedRecoveryLamports: 2_039_280 }] },
      async () => tx
    );

    expect(events[0].status).toBe("FAILED");
    expect(events[0].points).toBe(0);

    const walletRecord = await ensureWallet(db, w);
    const stats = await getWalletStats(db, walletRecord.id);
    expect(stats.points).toBe(0);
    expect(stats.verifiedEvents).toBe(0);
  });

  it("never double-awards when the same verified transaction is submitted for verification twice (duplicate API request)", async () => {
    const w = wallet(3);
    const ta = tokenAccount(3);
    const sig = signature(3);
    const tx = makeCloseTx({ wallet: w, tokenAccount: ta });
    const request = {
      wallet: w,
      signature: sig,
      actions: [{ type: "CLOSE_EMPTY_TOKEN_ACCOUNT" as const, tokenAccount: ta, mint: null, programId: null, expectedRecoveryLamports: 2_039_280 }],
    };

    const first = await verifyAndRecordSalvage(db, request, async () => tx);
    const second = await verifyAndRecordSalvage(db, request, async () => tx);

    expect(first[0].eventId).toBe(second[0].eventId);
    expect(first[0].points).toBe(second[0].points);

    const walletRecord = await ensureWallet(db, w);
    const stats = await getWalletStats(db, walletRecord.id);
    expect(stats.points).toBe(100); // not 200
    expect(stats.verifiedEvents).toBe(1);
  });

  it("never double-awards when the same wallet closes the same account again under a brand-new signature (replay defense)", async () => {
    const w = wallet(4);
    const ta = tokenAccount(4);
    const tx1 = makeCloseTx({ wallet: w, tokenAccount: ta });
    const tx2 = makeCloseTx({ wallet: w, tokenAccount: ta, slot: 99 });

    await verifyAndRecordSalvage(
      db,
      { wallet: w, signature: signature(40), actions: [{ type: "CLOSE_EMPTY_TOKEN_ACCOUNT", tokenAccount: ta, mint: null, programId: null, expectedRecoveryLamports: 2_039_280 }] },
      async () => tx1
    );
    const second = await verifyAndRecordSalvage(
      db,
      { wallet: w, signature: signature(41), actions: [{ type: "CLOSE_EMPTY_TOKEN_ACCOUNT", tokenAccount: ta, mint: null, programId: null, expectedRecoveryLamports: 2_039_280 }] },
      async () => tx2
    );

    expect(second[0].points).toBe(100); // the prior record is returned, not a fresh award
    const walletRecord = await ensureWallet(db, w);
    const stats = await getWalletStats(db, walletRecord.id);
    expect(stats.points).toBe(100);
  });

  it("grants recovery bonus tiers deterministically off actual recovered lamports, never a value proportional to SOL", async () => {
    const cases: Array<{ lamports: number; expectedPoints: number }> = [
      { lamports: 1_000_000, expectedPoints: 100 }, // below smallest tier
      { lamports: 10_000_000, expectedPoints: 120 }, // >= 0.01 SOL tier
      { lamports: 50_000_000, expectedPoints: 150 }, // >= 0.05 SOL tier
      { lamports: 100_000_000, expectedPoints: 200 }, // >= 0.1 SOL tier
    ];

    for (let i = 0; i < cases.length; i++) {
      const w = wallet(100 + i);
      const ta = tokenAccount(100 + i);
      const tx = makeCloseTx({ wallet: w, tokenAccount: ta, preLamports: cases[i].lamports });
      const events = await verifyAndRecordSalvage(
        db,
        { wallet: w, signature: signature(100 + i), actions: [{ type: "CLOSE_EMPTY_TOKEN_ACCOUNT", tokenAccount: ta, mint: null, programId: null, expectedRecoveryLamports: cases[i].lamports }] },
        async () => tx
      );
      expect(events[0].points).toBe(cases[i].expectedPoints);
    }
  });

  it("same mint salvaged by a small number of distinct wallets is unaffected by the cross-wallet reuse heuristic", async () => {
    const mint = "SharedMint1111111111111111111111111111111";
    for (const n of [5, 6]) {
      const w = wallet(n);
      const ta = tokenAccount(n);
      const tx = makeCloseTx({ wallet: w, tokenAccount: ta });
      const events = await verifyAndRecordSalvage(
        db,
        { wallet: w, signature: signature(n), actions: [{ type: "CLOSE_EMPTY_TOKEN_ACCOUNT", tokenAccount: ta, mint, programId: null, expectedRecoveryLamports: 2_039_280 }] },
        async () => tx
      );
      expect(events[0].status).toBe("VERIFIED");
      expect(events[0].points).toBeGreaterThan(0);
    }
  });

  it(
    "withholds points once a mint has been paid out to the cross-wallet reuse threshold, while still recording the verified action",
    async () => {
      const mint = "OverusedMint111111111111111111111111111111";
      const THRESHOLD = 25;
      // Fill up to (THRESHOLD) distinct wallets already paid for this mint.
      for (let n = 0; n < THRESHOLD; n++) {
        const w = wallet(200 + n);
        const ta = tokenAccount(200 + n);
        const tx = makeCloseTx({ wallet: w, tokenAccount: ta });
        await verifyAndRecordSalvage(
          db,
          { wallet: w, signature: signature(200 + n), actions: [{ type: "CLOSE_EMPTY_TOKEN_ACCOUNT", tokenAccount: ta, mint, programId: null, expectedRecoveryLamports: 2_039_280 }] },
          async () => tx
        );
      }

      // The next (26th) distinct wallet should be verified on-chain but withheld points.
      const w = wallet(999);
      const ta = tokenAccount(999);
      const tx = makeCloseTx({ wallet: w, tokenAccount: ta });
      const events = await verifyAndRecordSalvage(
        db,
        { wallet: w, signature: signature(999), actions: [{ type: "CLOSE_EMPTY_TOKEN_ACCOUNT", tokenAccount: ta, mint, programId: null, expectedRecoveryLamports: 2_039_280 }] },
        async () => tx
      );

      expect(events[0].status).toBe("VERIFIED"); // the on-chain action itself still succeeded/was recorded
      expect(events[0].points).toBe(0); // but no points, per the anti-farming heuristic
      expect(events[0].reason).toMatch(/different wallets/i);
    },
    20_000
  );

  it(
    "documents (does not yet block) a wallet salvaging an asset it minted itself — a known, intentional gap per the anti-farming architecture notes",
    async () => {
      // There is no mint-authority check yet (see antifarm/checks.ts's
      // "NOT YET IMPLEMENTED" list). This test exists to make that gap
      // explicit and falsify itself the moment someone adds the check
      // without updating this test, rather than silently assuming safety.
      const w = wallet(300);
      const ta = tokenAccount(300);
      const selfMint = "SelfCreatedMint111111111111111111111111111";
      const tx = makeCloseTx({ wallet: w, tokenAccount: ta });
      const events = await verifyAndRecordSalvage(
        db,
        { wallet: w, signature: signature(300), actions: [{ type: "CLOSE_EMPTY_TOKEN_ACCOUNT", tokenAccount: ta, mint: selfMint, programId: null, expectedRecoveryLamports: 2_039_280 }] },
        async () => tx
      );
      expect(events[0].status).toBe("VERIFIED");
      expect(events[0].points).toBeGreaterThan(0);
    }
  );

  it("a wallet with no activity has zero points and zero verified events", async () => {
    const w = wallet(500);
    const walletRecord = await ensureWallet(db, w);
    const stats = await getWalletStats(db, walletRecord.id);
    expect(stats).toEqual({ points: 0, verifiedEvents: 0, assetsSalvaged: 0, actualRecoveryLamports: 0 });
  });

  it("attributes points to the currently ACTIVE epoch, and epoch points remain fixed to that epoch after it closes", async () => {
    const epoch1 = await createEpoch(db, {
      number: 1,
      startsAt: new Date(Date.now() - 1000).toISOString(),
      endsAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
      rewardPoolPoints: 1_000_000,
    });
    await activateEpoch(db, epoch1.id);

    const w = wallet(6);
    const ta = tokenAccount(6);
    const tx = makeCloseTx({ wallet: w, tokenAccount: ta });
    await verifyAndRecordSalvage(
      db,
      { wallet: w, signature: signature(6), actions: [{ type: "CLOSE_EMPTY_TOKEN_ACCOUNT", tokenAccount: ta, mint: null, programId: null, expectedRecoveryLamports: 2_039_280 }] },
      async () => tx
    );

    const walletRecord = await ensureWallet(db, w);
    const epoch1Points = await getWalletPointsForEpoch(db, walletRecord.id, epoch1.id);
    expect(epoch1Points).toBe(100);

    // Open and activate epoch 2 (this also closes epoch 1).
    const epoch2 = await createEpoch(db, {
      number: 2,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
      rewardPoolPoints: 1_000_000,
    });
    await activateEpoch(db, epoch2.id);
    expect((await getActiveEpoch(db))?.id).toBe(epoch2.id);

    // Epoch 1's historical points must not move or change retroactively.
    const epoch1PointsAfterClose = await getWalletPointsForEpoch(db, walletRecord.id, epoch1.id);
    expect(epoch1PointsAfterClose).toBe(100);

    // A new verified action now accrues to epoch 2, not epoch 1.
    const ta2 = tokenAccount(7);
    const tx2 = makeCloseTx({ wallet: w, tokenAccount: ta2 });
    await verifyAndRecordSalvage(
      db,
      { wallet: w, signature: signature(7), actions: [{ type: "CLOSE_EMPTY_TOKEN_ACCOUNT", tokenAccount: ta2, mint: null, programId: null, expectedRecoveryLamports: 2_039_280 }] },
      async () => tx2
    );
    const epoch2Points = await getWalletPointsForEpoch(db, walletRecord.id, epoch2.id);
    expect(epoch2Points).toBe(100);
    expect(await getWalletPointsForEpoch(db, walletRecord.id, epoch1.id)).toBe(100);
  });

  it("awards points with no active epoch at all (epoch_id is simply null; nothing breaks)", async () => {
    expect(await getActiveEpoch(db)).toBeNull();
    const w = wallet(8);
    const ta = tokenAccount(8);
    const tx = makeCloseTx({ wallet: w, tokenAccount: ta });
    const events = await verifyAndRecordSalvage(
      db,
      { wallet: w, signature: signature(8), actions: [{ type: "CLOSE_EMPTY_TOKEN_ACCOUNT", tokenAccount: ta, mint: null, programId: null, expectedRecoveryLamports: 2_039_280 }] },
      async () => tx
    );
    expect(events[0].points).toBe(100);
  });
});
