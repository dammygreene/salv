import "server-only";
import { CullActionType } from "@/lib/cull/registry";
import { Db } from "../db/types";
import { countDistinctWalletsForMintAction, findActionByWalletTokenAccountAction } from "../repositories/cullRepo";

export interface AntiFarmContext {
  walletId: string;
  tokenAccount: string;
  action: CullActionType;
  mint: string | null;
}

export interface AntiFarmResult {
  allowed: boolean;
  reason?: string;
}

const CROSS_WALLET_MINT_REUSE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** If this many distinct wallets have already been paid for culleraging the
 * same mint within the window, further payouts for that mint are
 * withheld (the underlying on-chain action can still succeed and is
 * still recorded — this only withholds points). This is a blunt,
 * explicitly-a-heuristic guard, not a sybil-detection system. */
const CROSS_WALLET_MINT_REUSE_THRESHOLD = 25;

/**
 * Server-side anti-farming gate, consulted after chain verification but
 * before points are calculated/awarded. V1 implements two concrete rules
 * and documents (without yet building) the rest, so stronger rules can
 * be layered in later without touching the points pipeline itself:
 *
 *  IMPLEMENTED:
 *   1. Same wallet + same token account + same action, ever before
 *      (closes the "close, reopen the same ATA, close again" infinite
 *      points loop). Backed by a real DB unique constraint, not just
 *      this check.
 *   2. Same mint paid out to an unusually large number of distinct
 *      wallets in a short window (soft heuristic against a single actor
 *      spreading the same spam/dust mint across many wallets).
 *
 *  NOT YET IMPLEMENTED (architecture only):
 *   - Self-created assets (mint authority === the culleraging wallet).
 *   - Repeated circular transfers (needs multi-hop transaction graph
 *     analysis across the wallet's full history).
 *   - Suspiciously new spam assets (needs mint creation slot + a
 *     maintained spam/age heuristic).
 *   - Broader sybil/wallet-clustering detection.
 */
export async function evaluateAntiFarmRisk(db: Db, ctx: AntiFarmContext): Promise<AntiFarmResult> {
  const priorOwn = await findActionByWalletTokenAccountAction(db, ctx.walletId, ctx.tokenAccount, ctx.action);
  if (priorOwn) {
    return {
      allowed: false,
      reason: "This wallet already recorded this action for this exact account before; no repeat points are awarded.",
    };
  }

  if (ctx.mint) {
    const since = new Date(Date.now() - CROSS_WALLET_MINT_REUSE_WINDOW_MS).toISOString();
    const distinctWallets = await countDistinctWalletsForMintAction(db, ctx.mint, ctx.action, since);
    if (distinctWallets >= CROSS_WALLET_MINT_REUSE_THRESHOLD) {
      return {
        allowed: false,
        reason: `This mint has already been culld by ${distinctWallets} different wallets in the last 24h; withholding points as a precaution.`,
      };
    }
  }

  return { allowed: true };
}
