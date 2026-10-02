import { describe, expect, it } from "vitest";
import type { ParsedTransactionWithMeta } from "@solana/web3.js";
import { verifySalvageTransaction } from "./verifySalvageTransaction";

const WALLET = "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T";
const ATTACKER = "EviLWaLLet1111111111111111111111111111111";
const TOKEN_ACCOUNT = "TokenAccountAddress1111111111111111111111";
const VALID_SIGNATURE = "5".repeat(64);

interface FakeTxOptions {
  err?: unknown;
  accountKeys?: string[];
  closeAccount?: { account: string; owner: string; program?: "spl-token" | "spl-token-2022" } | null;
  closeInInner?: boolean;
  preBalances?: number[];
  postBalances?: number[];
  slot?: number;
}

function makeFakeTx(opts: FakeTxOptions = {}): ParsedTransactionWithMeta {
  const accountKeys = opts.accountKeys ?? [WALLET, TOKEN_ACCOUNT];
  const closeIx = opts.closeAccount
    ? {
        program: opts.closeAccount.program ?? "spl-token",
        programId: {} as never,
        parsed: {
          type: "closeAccount",
          info: { account: opts.closeAccount.account, destination: WALLET, owner: opts.closeAccount.owner },
        },
      }
    : null;

  return {
    slot: opts.slot ?? 123,
    transaction: {
      message: {
        accountKeys: accountKeys.map((k) => k as never),
        instructions: (opts.closeInInner || !closeIx ? [] : [closeIx]) as never,
      },
      signatures: [VALID_SIGNATURE],
    },
    meta: {
      err: opts.err ?? null,
      preBalances: opts.preBalances ?? [10_000_000, 2_039_280],
      postBalances: opts.postBalances ?? [12_039_280, 0],
      innerInstructions: (opts.closeInInner && closeIx ? [{ index: 0, instructions: [closeIx] }] : []) as never,
      logMessages: [],
      fee: 5000,
    },
  } as unknown as ParsedTransactionWithMeta;
}

const baseRequest = {
  wallet: WALLET,
  signature: VALID_SIGNATURE,
  actions: [{ type: "CLOSE_TOKEN_ACCOUNT" as const, tokenAccount: TOKEN_ACCOUNT, expectedRecoveryLamports: 2_039_280 }],
};

describe("verifySalvageTransaction", () => {
  it("rejects an invalid/too-short signature before ever calling the chain", async () => {
    const fetchTransaction = async () => {
      throw new Error("should not be called");
    };
    const outcome = await verifySalvageTransaction({ ...baseRequest, signature: "short" }, fetchTransaction);
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toMatch(/invalid/i);
  });

  it("rejects a request with no actions", async () => {
    const outcome = await verifySalvageTransaction({ ...baseRequest, actions: [] }, async () => null);
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toMatch(/no actions/i);
  });

  it("rejects when the transaction cannot be found (not confirmed yet / wrong signature)", async () => {
    const outcome = await verifySalvageTransaction(baseRequest, async () => null);
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toMatch(/not found/i);
  });

  it("rejects a transaction that failed on-chain", async () => {
    const tx = makeFakeTx({ err: { InstructionError: [0, "Custom"] } });
    const outcome = await verifySalvageTransaction(baseRequest, async () => tx);
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toMatch(/failed/i);
  });

  it("rejects when the fee payer does not match the claimed wallet (wallet spoofing defense)", async () => {
    const tx = makeFakeTx({ accountKeys: [ATTACKER, TOKEN_ACCOUNT], closeAccount: { account: TOKEN_ACCOUNT, owner: WALLET } });
    const outcome = await verifySalvageTransaction(baseRequest, async () => tx);
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toMatch(/fee payer/i);
  });

  it("rejects when no closeAccount instruction exists for the claimed account (already closed earlier, or never closed)", async () => {
    const tx = makeFakeTx({ closeAccount: null });
    const outcome = await verifySalvageTransaction(baseRequest, async () => tx);
    expect(outcome.ok).toBe(false);
    expect(outcome.results[0].verified).toBe(false);
    expect(outcome.results[0].reason).toMatch(/no closeaccount/i);
  });

  it("rejects when the closeAccount instruction's owner does not match the claimed wallet", async () => {
    const tx = makeFakeTx({ closeAccount: { account: TOKEN_ACCOUNT, owner: ATTACKER } });
    const outcome = await verifySalvageTransaction(baseRequest, async () => tx);
    expect(outcome.ok).toBe(false);
    expect(outcome.results[0].reason).toMatch(/owner/i);
  });

  it("rejects when the post-close balance is not actually zero", async () => {
    const tx = makeFakeTx({
      closeAccount: { account: TOKEN_ACCOUNT, owner: WALLET },
      postBalances: [12_039_280, 500], // still has lamports -- not really closed
    });
    const outcome = await verifySalvageTransaction(baseRequest, async () => tx);
    expect(outcome.ok).toBe(false);
    expect(outcome.results[0].reason).toMatch(/not zero/i);
  });

  it("verifies a real, successful closeAccount at the top level and reports exact recovered lamports", async () => {
    const tx = makeFakeTx({ closeAccount: { account: TOKEN_ACCOUNT, owner: WALLET } });
    const outcome = await verifySalvageTransaction(baseRequest, async () => tx);
    expect(outcome.ok).toBe(true);
    expect(outcome.results[0].verified).toBe(true);
    expect(outcome.results[0].actualRecoveryLamports).toBe(2_039_280);
    expect(outcome.slot).toBe(123);
  });

  it("also finds a closeAccount instruction nested in innerInstructions (CPI case) and supports Token-2022", async () => {
    const tx = makeFakeTx({
      closeAccount: { account: TOKEN_ACCOUNT, owner: WALLET, program: "spl-token-2022" },
      closeInInner: true,
    });
    const outcome = await verifySalvageTransaction(baseRequest, async () => tx);
    expect(outcome.ok).toBe(true);
    expect(outcome.results[0].verified).toBe(true);
  });

  it("propagates an RPC fetch failure as a clear non-ok outcome instead of throwing", async () => {
    const outcome = await verifySalvageTransaction(baseRequest, async () => {
      throw new Error("RPC timeout");
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toMatch(/rpc timeout/i);
  });
});
