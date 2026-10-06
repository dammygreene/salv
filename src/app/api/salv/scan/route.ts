export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { detectWalletAddress } from "@/lib/walletAddress";
import { getDb } from "@/lib/server/db/client";
import { listEpochs } from "@/lib/server/repositories/epochRepo";
import { getClaimView, ClaimViewStatus } from "@/lib/salv/claims";
import { ensureWallet } from "@/lib/server/repositories/walletRepo";
import { upsertRewardLedgerEntry, RewardLedgerStatus } from "@/lib/server/repositories/rewardLedgerRepo";
import { baseUnitsToSalvDecimalString } from "@/lib/salv/tokenSpec";
import { scanWallet, WalletScanError } from "@/lib/solana/scanner/scan";

/**
 * POST /api/salv/scan — the entire no-wallet-connect scan + reward-record
 * flow. Takes only a pasted address string; never requires (or accepts)
 * a connected wallet, a signature, or a private key.
 *
 * What this route does NOT do: it never trusts a client-supplied reward
 * amount (the request body only ever contains `wallet` — there is no
 * field for an amount at all), and it never invents an allocation — the
 * $SALV figure it returns and records always comes from
 * `getClaimView()`, the same authoritative reward-snapshot/claim system
 * `/api/salv/claims/:wallet` already uses, read fresh on every call.
 *
 * Three independent outcomes are reported, and the response deliberately
 * keeps them distinct rather than collapsing them into one boolean:
 *   - `scan.attempted`/`scan.succeeded` — whether a real Solana RPC scan
 *     of this wallet's token accounts ran and completed (Solana only;
 *     EVM wallets never attempt this). The $SALV allocation shown does
 *     NOT depend on the live scan succeeding — it comes from stored
 *     reward history, so an RPC hiccup never fabricates or blocks a
 *     reward figure.
 *   - `salvAllocated`/`status`/`epochId` — the authoritative reward
 *     figure for this wallet, computed fresh from the database.
 *   - `csvRecorded` — whether the ledger row was durably written. If
 *     this is `false`, the response still reports the real computed
 *     allocation, but is explicit that it was NOT persisted to the
 *     team's reward ledger -- never silently claims a recording that
 *     didn't happen.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { wallet } = (body ?? {}) as { wallet?: unknown };
  if (typeof wallet !== "string") {
    return NextResponse.json({ error: "wallet (string) is required." }, { status: 400 });
  }

  const detected = detectWalletAddress(wallet);
  if (!detected.valid || !detected.network) {
    return NextResponse.json(
      { error: "That does not look like a valid Solana or EVM (e.g. Robinhood Wallet) address." },
      { status: 400 }
    );
  }
  const { address, network } = detected;
  const scanId = crypto.randomUUID();

  // Step 1: the real, existing on-chain scan -- Solana only. Fully
  // independent of the reward lookup below: a scan failure here never
  // blocks or alters the reward figure, which is read from the database,
  // not from this live call.
  const scan: { attempted: boolean; succeeded: boolean; reason?: string } = { attempted: false, succeeded: false };
  if (network === "solana") {
    scan.attempted = true;
    try {
      await scanWallet(address);
      scan.succeeded = true;
    } catch (err) {
      scan.succeeded = false;
      scan.reason = err instanceof WalletScanError ? err.message : "Could not complete the live wallet scan.";
    }
  }

  // Step 2: the authoritative reward figure, read fresh from the
  // database (reward_snapshots / reward_claims via getClaimView) --
  // never from the live scan above, and never from anything the client
  // sent.
  let db;
  try {
    db = await getDb();
  } catch {
    return NextResponse.json(
      { error: "The reward database is temporarily unavailable. Please try again shortly." },
      { status: 503 }
    );
  }

  let salvAllocatedBaseUnits = 0n;
  let ledgerStatus: RewardLedgerStatus = "NOT_APPLICABLE";
  let epochNumber: number | null = null;

  try {
    if (network === "evm") {
      // The claims/snapshot/epoch system is Solana-only today -- an EVM
      // wallet has no reward history to look up. Still record the
      // wallet so the team can see it was scanned, with an honest,
      // explicit status rather than guessing or defaulting to ALLOCATED.
      await ensureWallet(db, address, "evm");
    } else {
      const epochs = await listEpochs(db);
      const latestClosed = epochs.find((e) => e.status === "CLOSED");
      epochNumber = latestClosed ? latestClosed.number : null;

      if (epochNumber === null) {
        ledgerStatus = "NO_EPOCH";
      } else {
        const view = await getClaimView(db, address, epochNumber);
        salvAllocatedBaseUnits = view.amountBaseUnits;
        ledgerStatus = mapClaimViewStatus(view.status);
      }
    }
  } catch {
    return NextResponse.json(
      { error: "Could not compute this wallet's reward allocation right now. Please try again shortly." },
      { status: 503 }
    );
  }

  // Step 3: durably record the result in the team's reward ledger. A
  // failure here is surfaced as `csvRecorded: false` -- it never
  // downgrades the (already successfully computed) scan/allocation
  // response above into a full failure, and it never pretends the
  // write succeeded.
  let csvRecorded = false;
  let recordError: string | undefined;
  try {
    await upsertRewardLedgerEntry(db, {
      walletAddress: address,
      network,
      epochNumber,
      salvAllocatedBaseUnits,
      status: ledgerStatus,
      scanId,
    });
    csvRecorded = true;
  } catch (err) {
    recordError = err instanceof Error ? err.message : "Could not record this scan in the reward ledger.";
  }

  return NextResponse.json({
    wallet: address,
    network,
    scan,
    salvAllocated: baseUnitsToSalvDecimalString(salvAllocatedBaseUnits),
    status: ledgerStatus,
    // Human-facing epoch NUMBER (matches /api/salv/claims/:wallet's
    // `epoch` field) -- NOT the internal database epoch uuid.
    epochId: epochNumber,
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
