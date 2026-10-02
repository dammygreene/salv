export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { Connection, Keypair } from "@solana/web3.js";
import { isValidSolanaAddress } from "@/lib/solana/base58";
import { getDb } from "@/lib/server/db/client";
import { attemptClaim } from "@/lib/salv/claims";
import { getDistributorSecretKey, getSalvConfig } from "@/lib/salv/config";
import { TOKEN_DECIMALS } from "@/lib/salv/tokenSpec";
import { createOnChainClaimExecutor } from "@/lib/solana/salv/claimExecutor";

/**
 * POST /api/salv/claims/:wallet/claim  { epoch: number }
 *
 * Executes a real on-chain $SALV claim (Phase 5 Sections 5/7/10) for one
 * wallet's one epoch. Never fakes success: this only ever reports
 * CLAIMED after src/lib/solana/salv/claimExecutor.ts has actually built,
 * sent, and had confirmed a real Devnet transaction (idempotency is
 * additionally enforced on-chain by the deterministic claim-receipt
 * account, independent of this route's own database check).
 *
 * If $SALV isn't deployed/configured in this environment yet (the normal
 * state for most of this phase — see docs/salv-devnet-claim-checklist.md),
 * this returns 409 "NOT LIVE" rather than silently pretending to
 * succeed, and never touches the database's claim state in that case.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await context.params;
  if (!wallet || !isValidSolanaAddress(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const { epoch } = (body ?? {}) as { epoch?: number };
  if (typeof epoch !== "number" || !Number.isInteger(epoch)) {
    return NextResponse.json({ error: "epoch must be an integer." }, { status: 400 });
  }

  const config = getSalvConfig();
  if (!config.configured) {
    return NextResponse.json(
      { error: "NOT_LIVE", message: `$SALV is not deployed in this environment yet (missing: ${config.missing.join(", ")}).` },
      { status: 409 }
    );
  }

  let distributorSecretKey: Uint8Array | null;
  try {
    distributorSecretKey = getDistributorSecretKey();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid distributor secret key." }, { status: 500 });
  }
  if (!distributorSecretKey) {
    return NextResponse.json({ error: "NOT_LIVE", message: "SALV_DISTRIBUTOR_SECRET_KEY is not configured on the server." }, { status: 409 });
  }

  const distributor = Keypair.fromSecretKey(distributorSecretKey);
  const connection = new Connection(config.rpcUrl, "confirmed");
  const executor = createOnChainClaimExecutor({
    connection,
    distributor,
    network: config.network,
    mintAddress: config.mintAddress,
    decimals: TOKEN_DECIMALS,
    rewardVaultTokenAccount: config.rewardVaultAddress,
  });

  const db = await getDb();
  const result = await attemptClaim(db, wallet, epoch, executor);

  switch (result.outcome) {
    case "CLAIMED":
      return NextResponse.json({
        outcome: "CLAIMED",
        transactionSignature: result.claim.claimTransactionSignature,
        claimReceiptAddress: result.claim.claimReceiptAddress,
        amountBaseUnits: result.claim.amountBaseUnits.toString(),
      });
    case "ALREADY_CLAIMED":
      return NextResponse.json(
        {
          outcome: "ALREADY_CLAIMED",
          message: "ALREADY CLAIMED",
          transactionSignature: result.claim?.claimTransactionSignature ?? null,
        },
        { status: 409 }
      );
    case "NOT_CLAIMABLE":
      return NextResponse.json({ outcome: "NOT_CLAIMABLE", message: result.reason }, { status: 404 });
    case "ZERO_AMOUNT":
      return NextResponse.json({ outcome: "ZERO_AMOUNT", message: "This wallet's allocation for this epoch is zero." }, { status: 409 });
    case "EXECUTION_FAILED":
      return NextResponse.json({ outcome: "EXECUTION_FAILED", message: result.error }, { status: 502 });
  }
}
