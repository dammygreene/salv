export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { validateCombinedWalletSubmission } from "@/lib/walletAddress";
import { DatabaseConfigurationError, getDb } from "@/lib/server/db/client";
import { listEpochs } from "@/lib/server/repositories/epochRepo";
import { getClaimView, ClaimViewStatus } from "@/lib/culler/claims";
import { getWalletPointsForEpoch } from "@/lib/server/repositories/pointsRepo";
import { ensureWallet } from "@/lib/server/repositories/walletRepo";
import { getRewardLedgerEntry, upsertRewardLedgerEntry, RewardLedgerStatus } from "@/lib/server/repositories/rewardLedgerRepo";
import { baseUnitsToCullerDecimalString } from "@/lib/culler/tokenSpec";
import { scanWallet } from "@/lib/solana/scanner/scan";
import { scanRobinhoodWallet } from "@/lib/server/robinhoodScanner";
import { enrichSolanaAssets, EnrichmentResult } from "@/lib/server/assetEnrichment";
import type { Asset } from "@/lib/types";
import { calculateScanAllocation } from "@/lib/cull/allocationPolicy";
import { upsertScanAllocation } from "@/lib/server/repositories/scanAllocationRepo";
import { calculateFixedAllocationBaseUnits, FIXED_ALLOCATION_POLICY_VERSION } from "@/lib/cull/fixedAllocation";

function summarizeEligibility(assets: Asset[]) {
  return {
    eligible: assets.filter((asset) => asset.eligibility === "ELIGIBLE").length,
    candidates: assets.filter((asset) => asset.eligibility === "CANDIDATE").length,
    notEligible: assets.filter((asset) => asset.eligibility === "NOT_ELIGIBLE").length,
    unknown: assets.filter((asset) =>
      asset.valueClassification === "FUNGIBLE_UNKNOWN_VALUE" || asset.valueClassification === "NFT_UNKNOWN_VALUE"
    ).length,
    valuable: assets.filter(
      (asset) => asset.valueClassification === "FUNGIBLE_VALUABLE" || asset.valueClassification === "NFT_VALUABLE"
    ).length,
    noLiquidity: assets.filter((asset) => asset.valueClassification === "FUNGIBLE_NO_LIQUIDITY").length,
    empty: assets.filter((asset) => asset.valueClassification === "EMPTY_ACCOUNT").length,
  };
}

function summarizeDigitalAssets(assets: Asset[]) {
  const dasOnly = assets.filter((asset) => asset.metadata?.source === "quicknode-das" && !asset.tokenAccount);
  return {
    total: dasOnly.length,
    nft: dasOnly.filter((asset) => asset.metadata?.assetType === "NFT").length,
    compressedNft: dasOnly.filter((asset) => asset.metadata?.assetType === "COMPRESSED_NFT").length,
    fungible: dasOnly.filter((asset) => asset.metadata?.assetType === "FUNGIBLE").length,
    other: dasOnly.filter((asset) => asset.metadata?.assetType === "OTHER").length,
    unknown: dasOnly.filter((asset) => !asset.metadata?.assetType || asset.metadata.assetType === "UNKNOWN").length,
  };
}

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
 * has no field for one. Fixed-allocation epochs use their immutable
 * CULLER-per-point conversion. Legacy epochs remain historical and do not
 * create new allocations. This route only records accounting data.
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
    console.error("[culler/scan] Solana scan failed", err);
    solanaScan.reason = "Could not complete the live wallet scan.";
  }

  const robinhoodScan = await scanRobinhoodWallet(robinhoodWallet);
  console.info("[culler/scan] combined asset diagnostics", {
    solanaAssets: enrichedAssets?.assets.length ?? 0,
    robinhoodAssets: robinhoodScan.assets?.length ?? 0,
    robinhoodAssetCounts: robinhoodScan.assetCounts,
    robinhoodDiscovery: robinhoodScan.discovery,
  });

  let db;
  try {
    db = await getDb();
  } catch (error) {
    if (error instanceof DatabaseConfigurationError) {
      return NextResponse.json(
        { error: "Server database configuration is invalid. Set DATABASE_URL to a reachable PostgreSQL database." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "The reward database is temporarily unavailable. Please try again shortly." }, { status: 503 });
  }

  // Step 2: compute the authoritative record-only allocation from database
  // state. Active epochs use live scan-allocation totals; closed epochs use
  // immutable snapshots. No claim or token-transfer operation occurs here.
  let cullerAllocatedBaseUnits = 0n;
  let ledgerStatus: RewardLedgerStatus = "NO_EPOCH";
  let allocationState: "YOUR CULLER ALLOCATION" | "CURRENT ALLOCATION" | "FINAL ALLOCATION" | "NO ALLOCATION" = "NO ALLOCATION";
  let epochNumber: number | null = null;
  let conversionRate: string | null = null;
  let allocationPolicyVersion = "legacy-disabled-v1";
  let legacyActiveEpoch = false;
  let scanAllocation: { points: number; contributions: ReturnType<typeof calculateScanAllocation>["contributions"] } = { points: 0, contributions: [] };

  try {
    if (robinhoodWallet) {
      // Bookkeeping only -- recording that this address was submitted
      // alongside the Solana wallet. Never read back for reward
      // computation, never given its own ledger row.
      await ensureWallet(db, robinhoodWallet, "evm");
    }

    const epochs = await listEpochs(db);
    const activeEpoch = epochs.find((e) => e.status === "ACTIVE");
    legacyActiveEpoch = activeEpoch?.conversionRate === null;
    if (activeEpoch && enrichedAssets?.status === "AVAILABLE") {
      allocationPolicyVersion = activeEpoch.conversionRate === null ? "legacy-disabled-v1" : FIXED_ALLOCATION_POLICY_VERSION;
      const solanaWalletRecord = await ensureWallet(db, solanaWallet, "solana");
      scanAllocation = calculateScanAllocation(
        [...enrichedAssets.assets, ...(robinhoodScan.assets ?? [])],
        activeEpoch.allocationPolicy
      );
      console.info("[culler/scan] combined allocation diagnostics", {
        points: scanAllocation.points,
        contributions: scanAllocation.contributions.length,
        robinhoodContributions: scanAllocation.contributions.filter((item) => item.assetId.startsWith("robinhood:")).length,
      });
      if (activeEpoch.conversionRate !== null) {
        const fixedAmount = calculateFixedAllocationBaseUnits(scanAllocation.points, activeEpoch.conversionRate);
        await upsertScanAllocation(db, {
          walletId: solanaWalletRecord.id,
          epochId: activeEpoch.id,
          points: scanAllocation.points,
          evidence: scanAllocation.contributions,
          cullerAllocatedBaseUnits: fixedAmount,
          conversionRate: activeEpoch.conversionRate,
          allocationPolicyVersion: FIXED_ALLOCATION_POLICY_VERSION,
        });
      }
    }
    if (activeEpoch) {
      allocationState = activeEpoch.conversionRate === null ? "NO ALLOCATION" : "YOUR CULLER ALLOCATION";
      epochNumber = activeEpoch.number;
      conversionRate = activeEpoch.conversionRate?.toString() ?? null;
      const wallet = await ensureWallet(db, solanaWallet, "solana");
      if (activeEpoch.conversionRate !== null) {
        const walletPoints = await getWalletPointsForEpoch(db, wallet.id, activeEpoch.id);
        cullerAllocatedBaseUnits = calculateFixedAllocationBaseUnits(walletPoints, activeEpoch.conversionRate);
        ledgerStatus = cullerAllocatedBaseUnits > 0n ? "ALLOCATED" : "NO_SNAPSHOT";
      } else {
        cullerAllocatedBaseUnits = 0n;
        ledgerStatus = "NO_SNAPSHOT";
      }
    } else {
      const latestClosed = epochs.find((e) => e.status === "CLOSED");
      epochNumber = latestClosed ? latestClosed.number : null;
      if (latestClosed) allocationState = "FINAL ALLOCATION";
    }

    if (epochNumber === null) {
      ledgerStatus = "NO_EPOCH";
    } else if (!activeEpoch) {
      const view = await getClaimView(db, solanaWallet, epochNumber);
      cullerAllocatedBaseUnits = view.amountBaseUnits;
      ledgerStatus = mapClaimViewStatus(view.status);
    }
  } catch (error) {
    console.error("[culler/scan] Allocation computation failed", error);
    return NextResponse.json(
      { error: "Could not compute this wallet's reward allocation.", code: "ALLOCATION_COMPUTATION_FAILED" },
      { status: 500 }
    );
  }

  // Step 3: durably record ONE allocation row, keyed on
  // (solanaWallet, epoch) alone.
  let csvRecorded = false;
  let recordError: string | undefined;
  try {
    const existingLedger = epochNumber === null ? null : await getRewardLedgerEntry(db, solanaWallet, epochNumber);
    if (!(legacyActiveEpoch && existingLedger)) {
      await upsertRewardLedgerEntry(db, {
      solanaWallet,
      robinhoodWallet,
      epochNumber,
      cullerAllocatedBaseUnits,
      points: scanAllocation.points,
      conversionRate: conversionRate === null ? null : BigInt(conversionRate),
      status: ledgerStatus,
      scanId,
      });
    }
    csvRecorded = true;
  } catch (err) {
    recordError = err instanceof Error ? err.message : "Could not record this scan in the reward ledger.";
  }

  if (!csvRecorded) {
    console.error("[culler/scan] Allocation ledger write failed", recordError);
    return NextResponse.json(
      { error: "The scan completed, but its allocation could not be recorded.", code: "ALLOCATION_RECORD_FAILED", scanId },
      { status: 503 }
    );
  }

  const response = NextResponse.json({
    solanaWallet,
    robinhoodWallet,
    scan: { solana: solanaScan, robinhood: robinhoodScan },
    assets: [...(enrichedAssets?.assets ?? []), ...(robinhoodScan.assets ?? [])],
    eligibility: summarizeEligibility([...(enrichedAssets?.assets ?? []), ...(robinhoodScan.assets ?? [])]),
    digitalAssets: summarizeDigitalAssets(enrichedAssets?.assets ?? []),
    enrichment: enrichedAssets
      ? { status: enrichedAssets.status, ...(enrichedAssets.reason ? { reason: enrichedAssets.reason } : {}) }
      : { status: "UNAVAILABLE", reason: "Solana scan did not complete." },
    allocation: scanAllocation,
    reward: {
      cullerAllocated: baseUnitsToCullerDecimalString(cullerAllocatedBaseUnits),
      status: ledgerStatus,
      // Human-facing epoch number, not the internal database epoch UUID.
      epochId: epochNumber,
      allocationState,
      points: scanAllocation.points,
      conversionRate,
      allocationPolicyVersion,
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
