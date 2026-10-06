export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { isValidSolanaAddress } from "@/lib/solana/base58";
import { CullActionType } from "@/lib/cull/registry";
import { getDb } from "@/lib/server/db/client";
import { fetchParsedTransactionFromChain } from "@/lib/server/rpc";
import { verifyAndRecordCull } from "@/lib/server/verifyAndRecordCull";

// BURN_VERIFIED_TOKEN / BURN_VERIFIED_NFT exist in the registry's type
// system (so repositories/points/etc. are ready for them) but have no
// real chain-verification logic yet (see verifyCullTransaction.ts) and
// are not `enabled` in the registry. Only accept what can actually be
// verified and awarded today.
const SUPPORTED_ACTIONS = new Set<CullActionType>(["CLOSE_EMPTY_TOKEN_ACCOUNT"]);

interface RawAction {
  type?: string;
  tokenAccount?: string;
  mint?: string | null;
  programId?: string | null;
  expectedRecoveryLamports?: number;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { wallet, signature, actions } = (body ?? {}) as {
    wallet?: string;
    signature?: string;
    actions?: RawAction[];
  };

  if (!wallet || typeof wallet !== "string" || !isValidSolanaAddress(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address." }, { status: 400 });
  }
  if (!signature || typeof signature !== "string" || signature.length < 32) {
    return NextResponse.json({ error: "Missing or invalid transaction signature." }, { status: 400 });
  }
  if (!Array.isArray(actions) || actions.length === 0) {
    return NextResponse.json({ error: "No actions submitted." }, { status: 400 });
  }

  const validActions = actions.filter(
    (a): a is Required<Pick<RawAction, "type" | "tokenAccount">> & RawAction =>
      typeof a.type === "string" &&
      SUPPORTED_ACTIONS.has(a.type as CullActionType) &&
      typeof a.tokenAccount === "string" &&
      isValidSolanaAddress(a.tokenAccount) &&
      typeof a.expectedRecoveryLamports === "number"
  );
  if (validActions.length !== actions.length) {
    return NextResponse.json({ error: "One or more actions are malformed or unsupported." }, { status: 400 });
  }

  const db = await getDb();
  const events = await verifyAndRecordCull(
    db,
    {
      wallet,
      signature,
      actions: validActions.map((a) => ({
        type: a.type as CullActionType,
        tokenAccount: a.tokenAccount!,
        mint: a.mint ?? null,
        programId: a.programId ?? null,
        expectedRecoveryLamports: a.expectedRecoveryLamports!,
      })),
    },
    fetchParsedTransactionFromChain
  );

  return NextResponse.json({ events }, { status: 200 });
}
