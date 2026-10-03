export const runtime = "nodejs";

import { Connection, PublicKey } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";
import { getSalvConfig } from "@/lib/salv/config";
import { getSalvTreasuryMultisigConfig, SalvTreasuryMultisigConfigError } from "@/lib/salv/multisig";
import { TOKEN_DECIMALS, salvToBaseUnits } from "@/lib/salv/tokenSpec";
import {
  buildFundRewardVaultTransaction,
  buildTreasuryBurnTransaction,
  buildTreasuryTransferTransaction,
  serializeUnsignedTransaction,
} from "@/lib/solana/salv/treasuryProposals";
import { getDb } from "@/lib/server/db/client";
import { DevAuthError, assertDevAuthorized } from "@/lib/server/devAuth";
import { listTreasuryProposals, recordTreasuryProposal, TreasuryProposalError, TreasuryProposalType } from "@/lib/server/repositories/treasuryProposalRepo";

/**
 * Dev-only $SALV treasury proposal BUILDER (Phase 6).
 *
 * GET  -> lists every proposal ever BUILT (a public, read-only audit
 *         trail). There is no "executed" field anywhere in this
 *         response, because nothing in this codebase can execute one.
 * POST -> builds (constructs, serializes) a real, unsigned transaction
 *         that WOULD move or burn treasury $SALV, and records that it
 *         was built. It never signs or sends anything -- the response
 *         is an unsigned transaction the 3-of-3 treasury multisig
 *         members must independently sign and submit themselves,
 *         out-of-band, using their own wallets/tooling. This route has
 *         no private key for the treasury or any of its 3 members and
 *         cannot acquire one through any input it accepts.
 *
 * This is the one and only kind of "treasury-adjacent" POST route this
 * application exposes, and it deliberately CANNOT bypass the 3-of-3
 * requirement: the multisig's own on-chain account enforces that
 * threshold independently of anything this server does or says.
 */
export async function GET(req: NextRequest) {
  try {
    assertDevAuthorized(req);
  } catch (err) {
    if (err instanceof DevAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const db = await getDb();
  const proposals = await listTreasuryProposals(db);
  return NextResponse.json({
    proposals: proposals.map((p) => ({ ...p, amountBaseUnits: p.amountBaseUnits.toString() })),
  });
}

export async function POST(req: NextRequest) {
  try {
    assertDevAuthorized(req);
  } catch (err) {
    if (err instanceof DevAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const salvConfig = getSalvConfig();
  if (!salvConfig.configured) {
    return NextResponse.json({ error: "$SALV is not configured (no deployment wired in yet) -- nothing to build a proposal against." }, { status: 409 });
  }
  if (!salvConfig.treasuryAddress) {
    return NextResponse.json({ error: "SALV_TREASURY_ADDRESS is not set -- cannot build a treasury proposal without a known treasury account." }, { status: 409 });
  }

  let multisigConfig;
  try {
    multisigConfig = getSalvTreasuryMultisigConfig();
  } catch (err) {
    if (err instanceof SalvTreasuryMultisigConfigError) return NextResponse.json({ error: err.message }, { status: 500 });
    throw err;
  }
  if (!multisigConfig.configured) {
    return NextResponse.json(
      { error: `Treasury multisig is not configured (missing: ${multisigConfig.missing.join(", ")}) -- cannot build a proposal.` },
      { status: 409 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { proposalType, amountSalv, destinationAddress, memo, feePayer } = (body ?? {}) as {
    proposalType?: TreasuryProposalType;
    amountSalv?: number;
    destinationAddress?: string;
    memo?: string;
    feePayer?: string;
  };

  if (proposalType !== "FUND_REWARD_VAULT" && proposalType !== "BURN" && proposalType !== "TRANSFER") {
    return NextResponse.json({ error: "proposalType must be one of FUND_REWARD_VAULT, BURN, TRANSFER." }, { status: 400 });
  }
  if (typeof amountSalv !== "number" || amountSalv <= 0) {
    return NextResponse.json({ error: "amountSalv must be a positive number." }, { status: 400 });
  }
  if (proposalType === "TRANSFER" && !destinationAddress) {
    return NextResponse.json({ error: "destinationAddress is required for a TRANSFER proposal." }, { status: 400 });
  }

  try {
    const connection = new Connection(salvConfig.rpcUrl, "confirmed");
    const { blockhash } = await connection.getLatestBlockhash("confirmed");

    const mint = new PublicKey(salvConfig.mintAddress);
    const treasuryTokenAccount = new PublicKey(salvConfig.treasuryAddress);
    const treasuryMultisig = new PublicKey(multisigConfig.multisigAddress);
    const members = multisigConfig.memberPublicKeys.map((k) => new PublicKey(k)) as [PublicKey, PublicKey, PublicKey];
    const amountBaseUnits = salvToBaseUnits(amountSalv);
    const feePayerKey = new PublicKey(feePayer ?? multisigConfig.memberPublicKeys[0]);

    const base = {
      feePayer: feePayerKey,
      recentBlockhash: blockhash,
      treasuryMultisig,
      multisigMembers: members,
      mint,
      decimals: TOKEN_DECIMALS,
    };

    let transaction;
    let resolvedDestination: string;
    if (proposalType === "FUND_REWARD_VAULT") {
      resolvedDestination = salvConfig.rewardVaultAddress;
      transaction = buildFundRewardVaultTransaction({
        ...base,
        treasuryTokenAccount,
        rewardVaultTokenAccount: new PublicKey(salvConfig.rewardVaultAddress),
        amountBaseUnits,
      });
    } else if (proposalType === "BURN") {
      resolvedDestination = salvConfig.treasuryAddress;
      transaction = buildTreasuryBurnTransaction({ ...base, treasuryTokenAccount, amountBaseUnits });
    } else {
      resolvedDestination = destinationAddress!;
      transaction = buildTreasuryTransferTransaction({
        ...base,
        treasuryTokenAccount,
        destinationTokenAccount: new PublicKey(destinationAddress!),
        amountBaseUnits,
      });
    }

    const serialized = serializeUnsignedTransaction(transaction);

    const db = await getDb();
    const proposal = await recordTreasuryProposal(db, {
      proposalType,
      amountBaseUnits,
      destinationAddress: resolvedDestination,
      memo,
      unsignedTransactionBase64: serialized,
      createdBy: "dev-admin",
    });

    return NextResponse.json(
      {
        proposal: { ...proposal, amountBaseUnits: proposal.amountBaseUnits.toString() },
        unsignedTransactionBase64: serialized,
        note: "This transaction is UNSIGNED and has not been submitted. It requires all 3 treasury multisig members to sign out-of-band before it can be sent.",
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof TreasuryProposalError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
