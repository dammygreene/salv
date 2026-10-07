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
import { scanRobinhoodWallet } from "@/lib/server/robinhoodScanner";
import { enrichSolanaAssets, EnrichmentResult } from "@/lib/server/assetEnrichment";

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
 * Robinhood Chain scanning is independent and read-only. It can be
 * unavailable without preventing the Solana scan or allocation record.
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
  let enrichedAssets: EnrichmentResult | null = null;
  const solanaScan: {
    attempted: boolean;
    succeeded: boolean;
    reason?: string;
    programStatus?: { splToken: "available" | "unavailable"; token2022: "available" | "unavailable" };
    accountsTotal?: number;
    accountsProcessed?: number;
    accountsRemaining?: number;
    truncated?: boolean;
    summary?: { empty: number; nonEmpty: number; fungible: number; nftShaped: number };
  } = { attempted: true, succeeded: false };
  try {
    const result = await scanWallet(solanaWallet);
    enrichedAssets = await enrichSolanaAssets(solanaWallet, result.assets);
    solanaScan.succeeded = true;
    solanaScan.programStatus = result.programStatus;
    solanaScan.accountsTotal = result.accountsTotal;
    solanaScan.accountsProcessed = result.accountsProcessed;
    solanaScan.accountsRemaining = result.accountsRemaining;
    solanaScan.truncated = result.truncated;
    solanaScan.summary = result.summary;
  } catch (err) {
    solanaScan.succeeded = false;
    solanaScan.reason = err instanceof WalletScanError ? err.message : "Could not complete the live wallet scan.";
  }

  const robinhoodScan = await scanRobinhoodWallet(robinhoodWallet);

  let db;
  try {
    db = await getDb();
  } catch {
    return NextResponse.json({ error: "The reward database is temporarily unavailable. Please try again shortly." }, { status: 503 });
  }

  // Step 2: the authoritative reward figure, read fresh from the
  // database (reward snapshots via getClaimView) --
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

  const response = NextResponse.json({
    solanaWallet,
    robinhoodWallet,
    scan: { solana: solanaScan, robinhood: robinhoodScan },
    assets: enrichedAssets?.assets ?? [],
    enrichment: enrichedAssets
      ? { status: enrichedAssets.status, ...(enrichedAssets.reason ? { reason: enrichedAssets.reason } : {}) }
      : { status: "UNAVAILABLE", reason: "Solana scan did not complete." },
    reward: {
      cullerAllocated: baseUnitsToCullerDecimalString(cullerAllocatedBaseUnits),
      status: ledgerStatus,
      // Human-facing epoch number, not the internal database epoch UUID.
      epochId: epochNumber,
    },
    csvRecorded,
    ...(recordError ? { recordError } : {}),
    scanId,
  });
  response.cookies.set("culler_wallet", solanaWallet, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return response;
}

function mapClaimViewStatus(status: ClaimViewStatus): RewardLedgerStatus {
  switch (status) {
    case "NO_SNAPSHOT":
      return "NO_SNAPSHOT";
    case "CLAIMABLE":
      return "ALLOCATED";
    default:
      return "FAILED";
  }
}
