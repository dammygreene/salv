/**
 * Deploys the real $SALV Devnet mint, with Phase 6's role-separated
 * account architecture.
 *
 * This script requires a reachable Devnet RPC endpoint and a funded
 * Devnet keypair, neither of which this sandbox has — the same
 * constraint documented for Phase 4 Part A. It must be run by a human
 * with real Devnet access (see docs/salv-devnet-checklist.md), not by
 * this agent. It also requires a treasury multisig to already exist —
 * run scripts/salv/create-devnet-multisig.ts first.
 *
 * Phase 6 role separation (never merged into one address):
 *   - Community treasury: a token account owned by the 3-of-3 SPL
 *     Token Multisig account (created by create-devnet-multisig.ts).
 *     Receives exactly 300,000,000 SALV at deployment and nothing else,
 *     ever, from this script. Only the multisig's 3 members can move
 *     funds out of it (see src/lib/solana/salv/treasuryProposals.ts).
 *   - Reward Distribution Vault: a plain token account owned by the
 *     distributor keypair (the same keypair as the deployer, for this
 *     Devnet rehearsal — see docs/salv-treasury.md for why that's an
 *     acceptable Devnet simplification but the treasury itself must
 *     not be). This is what src/lib/solana/salv/claimExecutor.ts
 *     actually spends from for day-to-day automatic claim payouts.
 *     This script leaves it at ZERO balance — the treasury must
 *     explicitly fund it later via a real multisig-approved transfer
 *     (scripts/salv/build-fund-reward-vault-proposal.ts) before any
 *     real claim can be paid out. This is the mechanism behind "the
 *     treasury must be able to reserve future reward allocations
 *     without immediately distributing them."
 *   - Market holding: unchanged from Phase 5 — a separate keypair,
 *     receives exactly 700,000,000 SALV.
 *   - Deployer/admin wallet: pays for and signs every instruction in
 *     this script. Never the treasury's authority.
 *
 * What this script does, exactly once per run:
 *  1. Creates a brand-new Token-2022 mint (9 decimals, zero extensions
 *     — see docs/token-spec.md for why Token-2022, not legacy SPL
 *     Token, is the current correct choice).
 *  2. Mints the entire 1,000,000,000 SALV supply, in one instruction,
 *     to a temporary holding account controlled by the deployer.
 *  3. Transfers exactly 300,000,000 SALV to the community treasury
 *     (owned by the 3-of-3 multisig) and exactly 700,000,000 SALV to
 *     the market holding account. The Reward Distribution Vault is
 *     created but left EMPTY.
 *  4. Asserts the temporary holding account is now at 0 — 100% of
 *     supply must be accounted for in exactly the two funded buckets.
 *  5. Writes deployments/devnet-salv-manifest.json with every public
 *     address and the current authority state. Mint and freeze
 *     authorities are deliberately NOT revoked by this script (see
 *     docs/token-spec.md's "Authorities" section) — only revoke once
 *     the final verified launch architecture requires it.
 *
 * Never hard-codes a private key. The deployer keypair is loaded from a
 * local JSON file path, never committed to the repo.
 *
 * Usage:
 *   npx tsx scripts/salv/deploy-devnet-mint.ts <path-to-deployer-keypair.json> --treasury-multisig <multisig-address>
 *
 * Environment:
 *   SOLANA_RPC_URL   Devnet RPC endpoint (defaults to the public
 *                    https://api.devnet.solana.com, which is
 *                    rate-limited — fine for a one-off deployment).
 */
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, transfer, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import {
  COMMUNITY_ALLOCATION_BASE_UNITS,
  MARKET_ALLOCATION_BASE_UNITS,
  TOKEN_DECIMALS,
  TOKEN_PROGRAM_ID_BASE58,
  TOTAL_SUPPLY_BASE_UNITS,
} from "../../src/lib/salv/tokenSpec";
import { getDb } from "../../src/lib/server/db/client";
import { recordTokenDeployment } from "../../src/lib/server/repositories/tokenDeploymentRepo";

function loadKeypair(path: string): Keypair {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(raw) || raw.length !== 64) {
    throw new Error(`${path} does not look like a solana-keygen JSON keypair file (expected a 64-number array).`);
  }
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function parseArgs(argv: string[]): { keypairPath: string; treasuryMultisig: string } {
  const keypairPath = argv[0];
  const flagIndex = argv.indexOf("--treasury-multisig");
  const treasuryMultisig = flagIndex >= 0 ? argv[flagIndex + 1] : undefined;

  if (!keypairPath || !treasuryMultisig) {
    throw new Error(
      "Usage: npx tsx scripts/salv/deploy-devnet-mint.ts <path-to-deployer-keypair.json> --treasury-multisig <multisig-address>\n\n" +
        "--treasury-multisig is REQUIRED and has no default. $SALV's community treasury must be a real, already-created " +
        "3-of-3 multisig address (see scripts/salv/create-devnet-multisig.ts) -- this script refuses to fall back to the " +
        "deployer's own wallet, which would recreate the exact single-hot-wallet-as-treasury anti-pattern Phase 6 exists " +
        "to remove."
    );
  }
  return { keypairPath, treasuryMultisig };
}

async function main() {
  let args: { keypairPath: string; treasuryMultisig: string };
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
    return;
  }

  const treasuryMultisig = new PublicKey(args.treasuryMultisig);

  const rpcUrl = process.env.SOLANA_RPC_URL?.trim() || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  const deployer = loadKeypair(args.keypairPath);
  console.log(`Deployer / distributor / admin wallet: ${deployer.publicKey.toBase58()}`);
  console.log(`Community treasury (3-of-3 multisig, separate from the deployer): ${treasuryMultisig.toBase58()}`);

  const balance = await connection.getBalance(deployer.publicKey);
  console.log(`Deployer balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  if (balance < 0.5 * LAMPORTS_PER_SOL) {
    console.warn("Warning: deployer has less than 0.5 SOL. Airdrop more before continuing: solana airdrop 2 <address> --url devnet");
  }

  console.log(`Creating mint (${TOKEN_DECIMALS} decimals, Token-2022 program, zero extensions)...`);
  const mint = await createMint(
    connection,
    deployer,
    deployer.publicKey,
    deployer.publicKey,
    TOKEN_DECIMALS,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID
  );
  console.log(`Mint created: ${mint.toBase58()}`);

  const holding = await getOrCreateAssociatedTokenAccount(connection, deployer, mint, deployer.publicKey, false, undefined, undefined, TOKEN_2022_PROGRAM_ID);
  console.log(`Minting the entire fixed supply (${TOTAL_SUPPLY_BASE_UNITS} base units) once...`);
  await mintTo(connection, deployer, mint, holding.address, deployer, TOTAL_SUPPLY_BASE_UNITS, [], undefined, TOKEN_2022_PROGRAM_ID);

  // Market holding account: a fresh keypair, distinct from the
  // distributor and the treasury, since market-allocated supply should
  // not sit in either of those accounts.
  const marketHoldingKeyPath = join(process.cwd(), "deployments", "devnet-market-holding-keypair.json");
  const marketHolding = existsSync(marketHoldingKeyPath) ? loadKeypair(marketHoldingKeyPath) : Keypair.generate();
  if (!existsSync(marketHoldingKeyPath)) {
    writeFileSync(marketHoldingKeyPath, JSON.stringify(Array.from(marketHolding.secretKey)));
    console.log(`Generated a new market holding keypair -> ${marketHoldingKeyPath} (DO NOT COMMIT THIS FILE).`);
  }
  const marketAta = await getOrCreateAssociatedTokenAccount(
    connection,
    deployer,
    mint,
    marketHolding.publicKey,
    false,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  // Community treasury: a token account owned by the 3-of-3 multisig
  // account itself (NOT by the deployer, NOT by the distributor, NOT by
  // any single person's keypair). Only a quorum of the multisig's 3
  // members can ever move funds out of this account.
  const treasuryAta = await getOrCreateAssociatedTokenAccount(
    connection,
    deployer,
    mint,
    treasuryMultisig,
    false,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  // Reward Distribution Vault: the distributor's own ATA -- the small,
  // operational account the real claim executor actually spends from.
  // Created here but deliberately left at ZERO balance; the treasury
  // must fund it later via a real multisig-approved transfer (Phase 6:
  // "the treasury must be able to reserve future reward allocations
  // without immediately distributing them").
  const rewardVaultAta = await getOrCreateAssociatedTokenAccount(
    connection,
    deployer,
    mint,
    deployer.publicKey,
    false,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  console.log(`Transferring ${MARKET_ALLOCATION_BASE_UNITS} base units to the market holding account...`);
  await transfer(connection, deployer, holding.address, marketAta.address, deployer, MARKET_ALLOCATION_BASE_UNITS, [], undefined, TOKEN_2022_PROGRAM_ID);

  console.log(`Transferring ${COMMUNITY_ALLOCATION_BASE_UNITS} base units to the community treasury (multisig-owned)...`);
  await transfer(connection, deployer, holding.address, treasuryAta.address, deployer, COMMUNITY_ALLOCATION_BASE_UNITS, [], undefined, TOKEN_2022_PROGRAM_ID);

  const finalHoldingBalance = (await connection.getTokenAccountBalance(holding.address)).value.amount;
  console.log(`Remaining in the temporary holding account: ${finalHoldingBalance} (must be exactly 0 -- every unit accounted for)`);
  if (BigInt(finalHoldingBalance) !== 0n) {
    throw new Error(
      `Supply accounting mismatch: expected exactly 0 base units left in the temporary holding account, found ${finalHoldingBalance}.`
    );
  }

  const rewardVaultBalance = (await connection.getTokenAccountBalance(rewardVaultAta.address)).value.amount;
  if (BigInt(rewardVaultBalance) !== 0n) {
    throw new Error(`Expected the Reward Distribution Vault to start at 0 base units, found ${rewardVaultBalance}.`);
  }

  const manifest = {
    network: "devnet",
    mintAddress: mint.toBase58(),
    tokenProgram: `Token-2022 (${TOKEN_PROGRAM_ID_BASE58}), zero extensions -- see docs/token-spec.md`,
    decimals: TOKEN_DECIMALS,
    mintAuthority: deployer.publicKey.toBase58(),
    freezeAuthority: deployer.publicKey.toBase58(),
    treasuryAddress: treasuryAta.address.toBase58(),
    treasuryAuthority: treasuryMultisig.toBase58(),
    rewardVaultAddress: rewardVaultAta.address.toBase58(),
    distributorAddress: deployer.publicKey.toBase58(),
    marketHoldingAddress: marketAta.address.toBase58(),
    deployedAt: new Date().toISOString(),
    notes:
      "Devnet rehearsal deployment (Phase 6 role-separated architecture). Mint and freeze authorities are intentionally " +
      "NOT revoked yet (see docs/token-spec.md's 'Authorities' section). The community treasury token account is owned " +
      "by a 3-of-3 SPL Token Multisig account, NOT by the deployer -- only its 3 members can move funds out of it. The " +
      "Reward Distribution Vault starts at 0 balance; it must be funded from the treasury via a real multisig-approved " +
      "transfer before any claim can be paid out (see src/lib/solana/salv/treasuryProposals.ts).",
  };

  const manifestPath = join(process.cwd(), "deployments", "devnet-salv-manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\nWrote deployment manifest -> ${manifestPath}`);

  // Also record this deployment as a durable, public audit trail in the
  // app's own database -- distinct from the SALV_* env vars (Section
  // 16), which are the app's *runtime* configuration and can be rotated
  // later without losing this history. Requires a real DATABASE_URL;
  // skipped (with a clear warning, not a silent no-op) if unset.
  if (process.env.DATABASE_URL?.trim()) {
    const db = await getDb();
    await recordTokenDeployment(db, {
      network: "devnet",
      mintAddress: manifest.mintAddress,
      tokenProgram: manifest.tokenProgram,
      decimals: manifest.decimals,
      mintAuthority: manifest.mintAuthority,
      freezeAuthority: manifest.freezeAuthority,
      rewardVaultAddress: manifest.rewardVaultAddress,
      distributorAddress: manifest.distributorAddress,
      marketHoldingAddress: manifest.marketHoldingAddress,
      treasuryAddress: manifest.treasuryAddress,
      notes: manifest.notes,
    });
    console.log("Recorded this deployment in the token_deployments table.");
  } else {
    console.warn(
      "DATABASE_URL is not set -- skipped recording this deployment in the token_deployments table. " +
        "The manifest file above is the only durable record in that case; set DATABASE_URL and re-run " +
        "(safe: this upserts on (network, mint_address)) to also record it in the app's database."
    );
  }

  console.log("\nNext steps:");
  console.log("  1. Set these environment variables before running the app:");
  console.log(`     SALV_MINT_ADDRESS=${manifest.mintAddress}`);
  console.log(`     SALV_REWARD_VAULT=${manifest.rewardVaultAddress}`);
  console.log(`     SALV_DISTRIBUTOR=${manifest.distributorAddress}`);
  console.log(`     SALV_TREASURY_ADDRESS=${manifest.treasuryAddress}`);
  console.log(`     SALV_NETWORK=devnet`);
  console.log(`     SOLANA_RPC_URL=${rpcUrl}`);
  console.log(`     SALV_DISTRIBUTOR_SECRET_KEY=<contents of ${args.keypairPath}> (keep this secret; never commit it)`);
  console.log("  2. The Reward Distribution Vault is EMPTY. Before any real claim can be paid out, the treasury's 3");
  console.log("     multisig members must sign and submit a real funding transfer -- see");
  console.log("     src/lib/solana/salv/treasuryProposals.ts's buildFundRewardVaultTransaction().");
  console.log("  3. Follow docs/salv-devnet-checklist.md for the full end-to-end Devnet procedure.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
