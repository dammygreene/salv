export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { validateCombinedWalletSubmission } from "@/lib/walletAddress";
import { getDb } from "@/lib/server/db/client";
import { listEpochs } from "@/lib/server/repositories/epochRepo";
import { getClaimView, ClaimViewStatus } from "@/lib/culler/claims";
import { ensureWallet } from "@/lib/server/repositories/walletRepo";
import { upsertRewardLedgerEntry, RewardLedgerStatus } from "@/lib/server/repositories/rewardLedgerRepo";
import { baseUnitsToCullerDecimalString } from "@/lib/culler/tokenSpec";
import { scanWallet, WalletScanError } from "@/lib/solana/scanner/scan";

/**
 * POST /api/culler/scan — the combined, no-wallet-connect scan + reward-
 * record flow (Phase 8).
 *
 * **Solana is the sole reward identity.** A Solana wallet is REQUIRED on
 * every request; Robinhood is an OPTIONAL address that attaches as
 * metadata to that same submission. "Robinhood only" is always rejected
 * by `validateCombinedWalletSubmission` before any scan or DB work
 * happens — there is no code path anywhere in this handler that can
 * produce a reward allocation, a ledger row, or a scan result keyed on
 * Robinhood alone.
 *
 * One request => ONE combined scan => ONE reward calculation => ONE
 * ledger row (never two rows, never two allocations, even when both
 * addresses are submitted).
 *
 * Request body: `{ solanaWallet: string, robinhoodWallet?: string | null }`.
 * This replaces Phase 7's single `{ wallet }` shape entirely (no
 * external callers exist yet, so no backward-compat shim is kept).
 *
 * The client can never influence the reward amount — the request body
 * has no field for one, and the $CULLER figure returned/recorded always
 * comes fresh from `getClaimView()` (src/lib/culler/claims.ts), the same
 * authoritative reward-snapshot/claim system `/api/culler/claims/:wallet`
 * already uses, computed solely from `solanaWallet`.
 *
 * Robinhood/EVM asset scanning is NOT implemented. This route never
 * fakes it: when a Robinhood address is present, `scan.robinhood.state`
 * is always `"NOT_IMPLEMENTED"` and `submitted` is `true` — the address
 * is stored as a linked wallet (via `ensureWallet`, bookkeeping only) but
 * never contributes to the reward figure, and no "assets found" result
 * is ever synthesized for it. This is intentionally architected so real
 * Robinhood scanning can be added later (by filling in `scanRobinhood`-
 * shaped logic here) without changing the Solana-primary reward identity
 * model at all.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = body as { solanaWallet?: unknown; robinhoodWallet?: unknown };
  const validated = validateCombinedWalletSubmission({
    solanaWallet: parsed?.solanaWallet,
    robinhoodWallet: parsed?.robinhoodWallet,
  });
  if (!validated.valid) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const { solanaWallet, robinhoodWallet } = validated.submission;
  const scanId = crypto.randomUUID();

  // Step 1: the real, existing on-chain scan -- Solana only. A scan
  // failure here never blocks or alters the reward figure below, which
  // is read from the database, not from this live call.
  const solanaScan: { attempted: boolean; succeeded: boolean; reason?: string } = { attempted: true, succeeded: false };
  try {
    await scanWallet(solanaWallet);
    solanaScan.succeeded = true;
  } catch (err) {
    solanaScan.succeeded = false;
    solanaScan.reason = err instanceof WalletScanError ? err.message : "Could not complete the live wallet scan.";
  }

  // Robinhood/EVM scanning is not implemented. Never faked: this is
  // either "no Robinhood address was submitted" or "one was submitted,
  // but no scan was attempted/available for it" -- never a synthesized
  // success.
  const robinhoodScan = robinhoodWallet
    ? ({ submitted: true, state: "NOT_IMPLEMENTED" as const } as const)
    : ({ submitted: false, state: "NOT_LINKED" as const } as const);

  let db;
  try {
    db = await getDb();
  } catch {
    return NextResponse.json({ error: "The reward database is temporarily unavailable. Please try again shortly." }, { status: 503 });
  }

  // Step 2: the authoritative reward figure, read fresh from the
  // database (reward_snapshots / reward_claims via getClaimView) --
  // computed solely from the Solana wallet, never from Robinhood, never
  // from anything the client sent.
  let cullerAllocatedBaseUnits = 0n;
  let ledgerStatus: RewardLedgerStatus = "NO_EPOCH";
  let epochNumber: number | null = null;

  try {
    if (robinhoodWallet) {
      // Bookkeeping only -- recording that this address was submitted
      // alongside the Solana wallet. Never read back for reward
      // computation, never given its own ledger row.
      await ensureWallet(db, robinhoodWallet, "evm");
    }

    const epochs = await listEpochs(db);
    const latestClosed = epochs.find((e) => e.status === "CLOSED");
    epochNumber = latestClosed ? latestClosed.number : null;

    if (epochNumber === null) {
      ledgerStatus = "NO_EPOCH";
    } else {
      const view = await getClaimView(db, solanaWallet, epochNumber);
      cullerAllocatedBaseUnits = view.amountBaseUnits;
      ledgerStatus = mapClaimViewStatus(view.status);
    }
  } catch {
    return NextResponse.json(
      { error: "Could not compute this wallet's reward allocation right now. Please try again shortly." },
      { status: 503 }
    );
  }

  // Step 3: durably record ONE combined ledger row, keyed on
  // (solanaWallet, epoch) alone. A failure here is surfaced as
  // `csvRecorded: false` -- it never downgrades the (already
  // successfully computed) scan/allocation response above into a full
  // failure, and it never pretends the write succeeded.
  let csvRecorded = false;
  let recordError: string | undefined;
  try {
    await upsertRewardLedgerEntry(db, {
      solanaWallet,
      robinhoodWallet,
      epochNumber,
      cullerAllocatedBaseUnits,
      status: ledgerStatus,
      scanId,
    });
    csvRecorded = true;
  } catch (err) {
    recordError = err instanceof Error ? err.message : "Could not record this scan in the reward ledger.";
  }

  return NextResponse.json({
    solanaWallet,
    robinhoodWallet,
    scan: { solana: solanaScan, robinhood: robinhoodScan },
    reward: {
      cullerAllocated: baseUnitsToCullerDecimalString(cullerAllocatedBaseUnits),
      status: ledgerStatus,
      // Human-facing epoch NUMBER (matches /api/culler/claims/:wallet's
      // `epoch` field) -- NOT the internal database epoch uuid.
      epochId: epochNumber,
    },
    csvRecorded,
    ...(recordError ? { recordError } : {}),
    scanId,
  });
}

function mapClaimViewStatus(status: ClaimViewStatus): RewardLedgerStatus {
  switch (status) {
    case "NO_SNAPSHOT":
      return "NO_SNAPSHOT";
    case "CLAIMABLE":
      return "ALLOCATED";
    case "CLAIMED":
      return "CLAIMED";
    case "FAILED":
      return "FAILED";
    default:
      return "FAILED";
  }
}
