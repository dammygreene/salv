import type { ParsedTransactionWithMeta } from "@solana/web3.js";
import { SalvageActionType } from "@/lib/salvage/registry";

export interface ClaimedCloseAction {
  /** Only CLOSE_EMPTY_TOKEN_ACCOUNT is actually checked against chain
   * data today (this function looks for a real closeAccount
   * instruction). The wider type is kept here so new action types can be
   * added to the registry without a signature change; anything other
   * than CLOSE_EMPTY_TOKEN_ACCOUNT will simply never find a matching
   * instruction and fail verification until real burn-verification logic
   * is added alongside its registry entry being enabled. */
  type: SalvageActionType;
  tokenAccount: string;
  expectedRecoveryLamports: number;
}

export interface VerifyRequest {
  wallet: string;
  signature: string;
  actions: ClaimedCloseAction[];
}

export interface VerifiedActionResult {
  tokenAccount: string;
  verified: boolean;
  actualRecoveryLamports: number;
  reason: string;
}

export interface VerificationOutcome {
  ok: boolean;
  slot: number | null;
  results: VerifiedActionResult[];
  reason?: string;
}

export type TransactionFetcher = (signature: string) => Promise<ParsedTransactionWithMeta | null>;

function accountKeysOf(tx: ParsedTransactionWithMeta): string[] {
  return tx.transaction.message.accountKeys.map((key) => {
    if (typeof key === "string") return key;
    const pubkey = (key as { pubkey?: { toBase58?: () => string } }).pubkey;
    if (pubkey?.toBase58) return pubkey.toBase58();
    const maybeKey = key as unknown as { toBase58?: () => string };
    if (typeof maybeKey.toBase58 === "function") {
      return maybeKey.toBase58();
    }
    return String(key);
  });
}

/**
 * The single source of truth for whether a claimed salvage action really
 * happened on chain. This is the ONLY place allowed to call something
 * "verified" — it never trusts the caller's classification, only the
 * signature. It independently re-derives:
 *  - that the transaction exists, is confirmed, and did not fail
 *  - that the fee payer is the wallet claiming the salvage
 *  - that a real closeAccount instruction (top-level or inner) for each
 *    claimed token account is actually present, owned by that wallet
 *  - the exact lamports recovered, from pre/post balances (never from
 *    anything the client sent)
 *  - that the account balance is actually zero afterwards
 *
 * `fetchTransaction` is injected so this can be fully unit tested against
 * crafted chain responses without a live RPC endpoint.
 */
export async function verifySalvageTransaction(
  request: VerifyRequest,
  fetchTransaction: TransactionFetcher
): Promise<VerificationOutcome> {
  if (!request.signature || request.signature.length < 32) {
    return { ok: false, slot: null, results: [], reason: "Invalid transaction signature." };
  }
  if (!request.actions.length) {
    return { ok: false, slot: null, results: [], reason: "No actions submitted." };
  }

  let tx: ParsedTransactionWithMeta | null;
  try {
    tx = await fetchTransaction(request.signature);
  } catch (err) {
    return {
      ok: false,
      slot: null,
      results: [],
      reason: `Could not fetch transaction from chain: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!tx) {
    return { ok: false, slot: null, results: [], reason: "Transaction not found or not yet confirmed." };
  }
  if (tx.meta?.err) {
    return { ok: false, slot: tx.slot, results: [], reason: "Transaction failed on-chain." };
  }

  const accountKeys = accountKeysOf(tx);
  const feePayer = accountKeys[0];
  if (feePayer !== request.wallet) {
    return { ok: false, slot: tx.slot, results: [], reason: "Transaction fee payer does not match the claimed wallet." };
  }

  const closedAccounts = new Map<string, { owner: string }>();
  const instructionSets = [
    tx.transaction.message.instructions,
    ...(tx.meta?.innerInstructions?.map((entry) => entry.instructions) ?? []),
  ];
  for (const set of instructionSets) {
    for (const ix of set) {
      if (
        "parsed" in ix &&
        ix.parsed &&
        (ix.program === "spl-token" || ix.program === "spl-token-2022") &&
        ix.parsed.type === "closeAccount"
      ) {
        const info = ix.parsed.info as { account: string; owner: string };
        closedAccounts.set(info.account, { owner: info.owner });
      }
    }
  }

  const results: VerifiedActionResult[] = request.actions.map((action) => {
    const closed = closedAccounts.get(action.tokenAccount);
    if (!closed) {
      return {
        tokenAccount: action.tokenAccount,
        verified: false,
        actualRecoveryLamports: 0,
        reason: "No closeAccount instruction for this account was found in the transaction.",
      };
    }
    if (closed.owner !== request.wallet) {
      return {
        tokenAccount: action.tokenAccount,
        verified: false,
        actualRecoveryLamports: 0,
        reason: "closeAccount owner does not match the claimed wallet.",
      };
    }

    const accountIndex = accountKeys.indexOf(action.tokenAccount);
    const pre = accountIndex >= 0 ? tx!.meta?.preBalances?.[accountIndex] ?? 0 : 0;
    const post = accountIndex >= 0 ? tx!.meta?.postBalances?.[accountIndex] ?? 0 : 0;
    const actualRecoveryLamports = Math.max(0, pre - post);

    if (accountIndex < 0) {
      return {
        tokenAccount: action.tokenAccount,
        verified: false,
        actualRecoveryLamports: 0,
        reason: "Account not present in transaction balance records.",
      };
    }

    if (post !== 0) {
      return {
        tokenAccount: action.tokenAccount,
        verified: false,
        actualRecoveryLamports,
        reason: "Account balance after the transaction is not zero; it may not actually be closed.",
      };
    }

    return {
      tokenAccount: action.tokenAccount,
      verified: true,
      actualRecoveryLamports,
      reason: "closeAccount instruction confirmed on-chain; account balance now zero.",
    };
  });

  const ok = results.every((r) => r.verified);
  return { ok, slot: tx.slot, results };
}
