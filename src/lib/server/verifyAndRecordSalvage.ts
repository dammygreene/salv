import "server-only";
import { isActionEnabled, SalvageActionType } from "@/lib/salvage/registry";
import { calculateSalvagePoints } from "@/lib/salvage/points";
import { SalvageEvent } from "@/lib/types";
import { buildIdempotencyKey } from "@/lib/solana/idempotency";
import { evaluateAntiFarmRisk } from "./antifarm/checks";
import { Db } from "./db/types";
import { ensureAsset, recordClassification } from "./repositories/assetRepo";
import { getActiveEpoch } from "./repositories/epochRepo";
import { awardPoints } from "./repositories/pointsRepo";
import {
  ensureSalvageEvent,
  findActionByIdempotencyKey,
  findActionByWalletTokenAccountAction,
  insertSalvageAction,
  SalvageActionRecord,
  setSalvageEventStatus,
} from "./repositories/salvageRepo";
import { ensureWallet } from "./repositories/walletRepo";
import { TransactionFetcher, verifySalvageTransaction } from "./verifySalvageTransaction";

export interface SalvageActionRequest {
  type: SalvageActionType;
  tokenAccount: string;
  mint: string | null;
  programId: string | null;
  expectedRecoveryLamports: number;
}

export interface VerifyAndRecordInput {
  wallet: string;
  signature: string;
  actions: SalvageActionRequest[];
}

function toSalvageEvent(record: SalvageActionRecord): SalvageEvent {
  return {
    eventId: record.id,
    idempotencyKey: record.idempotencyKey,
    wallet: record.walletId,
    signature: "", // filled in by caller, which has the wallet-level signature in scope
    slot: 0,
    action: record.action,
    chain: "solana",
    timestamp: record.verifiedAt ?? record.createdAt,
    tokenAccount: record.tokenAccount,
    mint: record.mint,
    programId: record.programId,
    expectedRecoveryLamports: record.expectedRecoveryLamports,
    actualRecoveryLamports: record.actualRecoveryLamports,
    status: record.status,
    reason: record.reason ?? undefined,
    points: record.points,
  };
}

/**
 * The full verified-contribution pipeline for one submitted transaction:
 *
 *   on-chain verification -> salvage_action record -> anti-farm gate ->
 *   deterministic points -> points_ledger entry (only for a brand-new,
 *   verified, non-farmed, registry-enabled action)
 *
 * Every step after "on-chain verification" is backed by a real database
 * constraint (unique idempotency key, unique wallet+account+action,
 * unique points-per-action), so this function can be called any number
 * of times for the same transaction — on retry, on page refresh, from a
 * malicious duplicate request — and only ever produces the same result,
 * never new points.
 */
export async function verifyAndRecordSalvage(
  db: Db,
  input: VerifyAndRecordInput,
  fetchTransaction: TransactionFetcher,
  walletAddress = input.wallet
): Promise<SalvageEvent[]> {
  const wallet = await ensureWallet(db, walletAddress);
  const event = await ensureSalvageEvent(db, { walletId: wallet.id, signature: input.signature });

  const idempotencyKeys = input.actions.map((a) => buildIdempotencyKey(input.signature, a.type, a.tokenAccount));
  const existingByIdempotency = await Promise.all(idempotencyKeys.map((key) => findActionByIdempotencyKey(db, key)));

  if (existingByIdempotency.every((a): a is SalvageActionRecord => a !== null)) {
    return existingByIdempotency.map((a) => ({
      ...toSalvageEvent(a!),
      signature: input.signature,
      wallet: walletAddress,
      slot: event.slot ?? 0,
    }));
  }

  const outcome = await verifySalvageTransaction(
    {
      wallet: walletAddress,
      signature: input.signature,
      actions: input.actions.map((a) => ({
        type: a.type,
        tokenAccount: a.tokenAccount,
        expectedRecoveryLamports: a.expectedRecoveryLamports,
      })),
    },
    fetchTransaction
  );

  await setSalvageEventStatus(db, event.id, outcome.ok ? "VERIFIED" : "FAILED", outcome.slot);
  const effectiveSlot = outcome.slot ?? event.slot ?? 0;

  const results: SalvageEvent[] = [];
  for (let i = 0; i < input.actions.length; i++) {
    const action = input.actions[i];
    const idempotencyKey = idempotencyKeys[i];

    if (existingByIdempotency[i]) {
      results.push({ ...toSalvageEvent(existingByIdempotency[i]!), signature: input.signature, wallet: walletAddress, slot: effectiveSlot });
      continue;
    }

    // Defense in depth: a wallet can only ever earn once from a specific
    // (token account, action) pair. If that already happened under a
    // different signature, don't insert a second row at all — just
    // surface the original record as the truth for this slot.
    const priorSameTarget = await findActionByWalletTokenAccountAction(db, wallet.id, action.tokenAccount, action.type);
    if (priorSameTarget) {
      results.push({ ...toSalvageEvent(priorSameTarget), signature: input.signature, wallet: walletAddress, slot: effectiveSlot });
      continue;
    }

    const verifyResult = outcome.results[i];
    const verified = Boolean(verifyResult?.verified);

    let assetId: string | null = null;
    if (verified && action.mint) {
      const asset = await ensureAsset(db, { mint: action.mint, kind: "TOKEN" });
      assetId = asset.id;
      await recordClassification(db, { assetId: asset.id, classification: "EMPTY_TOKEN_ACCOUNT", source: "verify-api" });
    }

    let points = 0;
    let reason = verifyResult?.reason ?? outcome.reason ?? "Not verified.";

    if (verified) {
      if (!isActionEnabled(action.type)) {
        reason = `${action.type} is not yet enabled in the SALVAGE REGISTRY. The on-chain transaction is recorded, but no points are awarded.`;
      } else {
        const antiFarm = await evaluateAntiFarmRisk(db, {
          walletId: wallet.id,
          tokenAccount: action.tokenAccount,
          action: action.type,
          mint: action.mint,
        });
        if (!antiFarm.allowed) {
          reason = antiFarm.reason ?? "Withheld by anti-farming rules.";
        } else {
          points = calculateSalvagePoints({
            action: action.type,
            actualRecoveryLamports: verifyResult?.actualRecoveryLamports ?? 0,
          });
          reason = verifyResult?.reason ?? reason;
        }
      }
    }

    const { action: inserted, created } = await insertSalvageAction(db, {
      salvageEventId: event.id,
      walletId: wallet.id,
      assetId,
      tokenAccount: action.tokenAccount,
      programId: action.programId,
      mint: action.mint,
      classification: verified ? "EMPTY_TOKEN_ACCOUNT" : null,
      action: action.type,
      idempotencyKey,
      expectedRecoveryLamports: action.expectedRecoveryLamports,
      actualRecoveryLamports: verifyResult?.actualRecoveryLamports ?? null,
      status: verified ? "VERIFIED" : "FAILED",
      reason,
      points,
    });

    if (created && inserted.status === "VERIFIED" && inserted.points > 0) {
      const activeEpoch = await getActiveEpoch(db);
      await awardPoints(db, {
        walletId: wallet.id,
        salvageActionId: inserted.id,
        points: inserted.points,
        reason: inserted.reason ?? "Verified salvage.",
        epochId: activeEpoch?.id ?? null,
      });
    }

    results.push({ ...toSalvageEvent(inserted), signature: input.signature, wallet: walletAddress, slot: effectiveSlot });
  }

  return results;
}
