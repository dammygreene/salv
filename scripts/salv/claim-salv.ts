/**
 * Phase 5 Section 10: the real Devnet claim script. This is the thing an
 * operator runs to actually execute a wallet's $SALV claim against a
 * live Devnet mint — it is NOT a simulation and does not fake anything;
 * if $SALV isn't deployed (SALV_* env vars unset) or the distributor
 * secret isn't configured, it refuses to run rather than pretending.
 *
 * This script is execution-blocked in this sandbox (no outbound network
 * access to any Solana RPC endpoint), exactly like Phase 4 Part A. It is
 * shipped ready-to-run for a developer with real Devnet access, and is
 * the backbone of docs/salv-devnet-claim-checklist.md's manual test.
 *
 * It talks to the SAME database the app uses (via DATABASE_URL / getDb())
 * and the SAME orchestration logic (src/lib/salv/claims.ts) the API
 * route (/api/salv/claims/[wallet]/claim) uses — this script exists so
 * that checklist step can be exercised from the command line before or
 * without the web UI, not as a second, divergent code path.
 *
 * Usage:
 *   npm run salv-claim -- <wallet-address> <epoch-number>
 *
 * Required env (see getSalvConfig()/getDistributorSecretKey()):
 *   SALV_MINT_ADDRESS, SALV_REWARD_VAULT, SALV_DISTRIBUTOR, SOLANA_RPC_URL,
 *   SALV_DISTRIBUTOR_SECRET_KEY, DATABASE_URL
 */
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getSalvConfig, getDistributorSecretKey } from "../../src/lib/salv/config";
import { TOKEN_DECIMALS } from "../../src/lib/salv/tokenSpec";
import { getDb } from "../../src/lib/server/db/client";
import { attemptClaim, getClaimView } from "../../src/lib/salv/claims";
import { createOnChainClaimExecutor } from "../../src/lib/solana/salv/claimExecutor";

async function main() {
  const [walletAddress, epochArg] = process.argv.slice(2);
  if (!walletAddress || !epochArg) {
    console.error("Usage: npm run salv-claim -- <wallet-address> <epoch-number>");
    process.exit(1);
  }
  const epochNumber = Number(epochArg);
  if (!Number.isInteger(epochNumber)) {
    console.error(`Epoch number must be an integer, got: ${epochArg}`);
    process.exit(1);
  }

  const config = getSalvConfig();
  if (!config.configured) {
    console.error(
      `$SALV is not configured in this environment (missing: ${config.missing.join(", ")}). ` +
        "Run scripts/salv/deploy-devnet-mint.ts first and set the env vars it prints."
    );
    process.exit(1);
  }

  const distributorSecretKey = getDistributorSecretKey();
  if (!distributorSecretKey) {
    console.error("SALV_DISTRIBUTOR_SECRET_KEY is not set. Refusing to claim without the distributor's signing key.");
    process.exit(1);
  }
  const distributor = Keypair.fromSecretKey(distributorSecretKey);
  if (distributor.publicKey.toBase58() !== config.distributorAddress) {
    console.error(
      `SALV_DISTRIBUTOR_SECRET_KEY does not match SALV_DISTRIBUTOR. ` +
        `Expected ${config.distributorAddress}, got ${distributor.publicKey.toBase58()}. Refusing to proceed.`
    );
    process.exit(1);
  }

  // Validate the claimant address is a real base58 public key before
  // touching the database or the network with it.
  try {
    new PublicKey(walletAddress);
  } catch {
    console.error(`"${walletAddress}" is not a valid Solana wallet address.`);
    process.exit(1);
  }

  const db = await getDb();

  console.log(`Checking claim status for ${walletAddress}, epoch ${epochNumber}...`);
  const before = await getClaimView(db, walletAddress, epochNumber);
  console.log("Current status:", before.status, before.status === "CLAIMABLE" ? `(${before.amountBaseUnits} base units)` : "");

  if (before.status === "CLAIMED") {
    console.log("Already claimed. Refusing to attempt again (this is the expected, correct behavior).");
    console.log("Claim record:", before.claim);
    process.exit(0);
  }
  if (before.status !== "CLAIMABLE") {
    console.error(`Nothing to claim: status is ${before.status}, not CLAIMABLE.`);
    process.exit(1);
  }

  const connection = new Connection(config.rpcUrl, "confirmed");
  const executor = createOnChainClaimExecutor({
    connection,
    distributor,
    network: config.network,
    mintAddress: config.mintAddress,
    decimals: TOKEN_DECIMALS,
    rewardVaultTokenAccount: config.rewardVaultAddress,
  });

  console.log("Submitting on-chain claim transaction (this sends a real Devnet transaction)...");
  const result = await attemptClaim(db, walletAddress, epochNumber, executor);

  if (result.outcome === "CLAIMED") {
    console.log("SUCCESS. Transaction signature:", result.claim.claimTransactionSignature);
    console.log("Claim receipt address:", result.claim.claimReceiptAddress);
    console.log(
      `Verify on https://explorer.solana.com/tx/${result.claim.claimTransactionSignature}?cluster=${
        config.network === "mainnet-beta" ? "mainnet" : config.network
      }`
    );
  } else if (result.outcome === "ALREADY_CLAIMED") {
    // Can happen on a race with another process between the check above
    // and the attempt below; attemptClaim's own compare-and-swap is what
    // actually prevents a double-pay here, not this script.
    console.log("ALREADY CLAIMED (caught by the database's claim-once guard). No transaction was sent.");
  } else if (result.outcome === "NOT_CLAIMABLE") {
    console.error("NOT CLAIMABLE:", result.reason);
    process.exit(1);
  } else if (result.outcome === "ZERO_AMOUNT") {
    console.error("This wallet's allocation for this epoch is exactly zero. Nothing to claim.");
    process.exit(1);
  } else {
    console.error("On-chain execution failed:", result.error);
    console.error("The claim has been marked FAILED (not CLAIMED) and can be retried.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
