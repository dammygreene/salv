/**
 * Builds (never signs, never sends) a real, unsigned transaction that
 * would move $SALV from the community treasury into the operational
 * Reward Distribution Vault, and prints it (base64) for the 3-of-3
 * multisig members to review and co-sign out-of-band (Phase 6).
 *
 * This script is intentionally incapable of moving any funds: it has no
 * private key for the treasury multisig or any of its 3 members. It
 * only reads the deployment manifest (or explicit CLI overrides) and
 * calls src/lib/solana/salv/treasuryProposals.ts's build-only helper.
 *
 * Usage:
 *   npx tsx scripts/salv/build-fund-reward-vault-proposal.ts <amountSalv> [--fee-payer <pubkey>]
 *
 * Reads deployments/devnet-salv-manifest.json for the mint, treasury,
 * treasury authority, and reward vault addresses, and
 * SALV_TREASURY_MEMBER_1/2/3 (public keys only) for the multisig
 * members. Requires a reachable RPC endpoint only to fetch a recent
 * blockhash -- never to sign or submit anything.
 *
 * Output: a base64-encoded unsigned transaction. Hand this to each of
 * the 3 treasury multisig members so they can inspect, sign (with their
 * own wallet/tooling), and only then submit it -- this script never
 * does either of those things itself. Optionally records the proposal
 * in the treasury_proposals audit table if DATABASE_URL is set.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { Connection, PublicKey } from "@solana/web3.js";
import { salvToBaseUnits, TOKEN_DECIMALS } from "../../src/lib/salv/tokenSpec";
import { buildFundRewardVaultTransaction, serializeUnsignedTransaction } from "../../src/lib/solana/salv/treasuryProposals";
import { getDb } from "../../src/lib/server/db/client";
import { recordTreasuryProposal } from "../../src/lib/server/repositories/treasuryProposalRepo";

interface Manifest {
  mintAddress: string;
  treasuryAddress: string;
  treasuryAuthority: string;
  rewardVaultAddress: string;
}

function loadManifest(): Manifest {
  const path = join(process.cwd(), "deployments", "devnet-salv-manifest.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

async function main() {
  const amountSalvArg = process.argv[2];
  if (!amountSalvArg) {
    console.error("Usage: npx tsx scripts/salv/build-fund-reward-vault-proposal.ts <amountSalv> [--fee-payer <pubkey>]");
    process.exit(1);
    return;
  }
  const amountSalv = Number(amountSalvArg);
  if (!Number.isFinite(amountSalv) || amountSalv <= 0) {
    throw new Error(`<amountSalv> must be a positive number, got "${amountSalvArg}".`);
  }

  const manifest = loadManifest();
  const member1 = process.env.SALV_TREASURY_MEMBER_1?.trim();
  const member2 = process.env.SALV_TREASURY_MEMBER_2?.trim();
  const member3 = process.env.SALV_TREASURY_MEMBER_3?.trim();
  if (!member1 || !member2 || !member3) {
    throw new Error("SALV_TREASURY_MEMBER_1/2/3 (public keys only) must be set -- see src/lib/salv/multisig.ts.");
  }

  const feePayerFlagIndex = process.argv.indexOf("--fee-payer");
  const feePayer = feePayerFlagIndex >= 0 ? process.argv[feePayerFlagIndex + 1] : member1; // any funded account works; member1 is a convenient default

  const rpcUrl = process.env.SOLANA_RPC_URL?.trim() || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  const amountBaseUnits = salvToBaseUnits(amountSalv);

  const transaction = buildFundRewardVaultTransaction({
    feePayer: new PublicKey(feePayer),
    recentBlockhash: blockhash,
    treasuryMultisig: new PublicKey(manifest.treasuryAuthority),
    multisigMembers: [new PublicKey(member1), new PublicKey(member2), new PublicKey(member3)],
    mint: new PublicKey(manifest.mintAddress),
    decimals: TOKEN_DECIMALS,
    treasuryTokenAccount: new PublicKey(manifest.treasuryAddress),
    rewardVaultTokenAccount: new PublicKey(manifest.rewardVaultAddress),
    amountBaseUnits,
  });

  const serialized = serializeUnsignedTransaction(transaction);

  console.log(`\nUNSIGNED transaction -- funds ${amountSalv} SALV from the treasury into the Reward Distribution Vault.`);
  console.log("This has NOT been signed or sent. Hand it to all 3 treasury multisig members to sign out-of-band:\n");
  console.log(serialized);

  if (process.env.DATABASE_URL?.trim()) {
    const db = await getDb();
    await recordTreasuryProposal(db, {
      proposalType: "FUND_REWARD_VAULT",
      amountBaseUnits,
      destinationAddress: manifest.rewardVaultAddress,
      memo: `Fund reward vault with ${amountSalv} SALV from treasury ${manifest.treasuryAddress}`,
      unsignedTransactionBase64: serialized,
      createdBy: "scripts/salv/build-fund-reward-vault-proposal.ts",
    });
    console.log("\nRecorded this proposal in the treasury_proposals audit table (this records that it was BUILT, not that it executed).");
  } else {
    console.warn("\nDATABASE_URL is not set -- this proposal was not recorded in the treasury_proposals audit table.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
