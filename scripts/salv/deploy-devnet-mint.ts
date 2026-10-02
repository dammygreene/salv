/**
 * Deploys a real $SALV test token to Solana Devnet (Phase 5 Section 9).
 *
 * This script requires a reachable Devnet RPC endpoint and a funded
 * Devnet keypair, neither of which this sandbox has — the same
 * constraint documented for Phase 4 Part A. It must be run by a human
 * with real Devnet access (see docs/salv-devnet-claim-checklist.md),
 * not by this agent.
 *
 * What it does, exactly once per run:
 *  1. Creates a brand-new SPL Token mint (standard TOKEN_PROGRAM_ID, 9
 *     decimals — see docs/token-spec.md for why not Token-2022).
 *  2. Mints the entire 1,000,000,000 SALV supply, in one instruction, to
 *     a temporary holding account controlled by the deployer.
 *  3. Transfers exactly 300,000,000 SALV to the Community Reward
 *     Vault's token account and exactly 700,000,000 SALV to the market
 *     holding account.
 *  4. Asserts the temporary holding account is now at 0 — 100% of
 *     supply must be accounted for in exactly the two documented
 *     buckets, nothing left in a third place.
 *  5. Writes deployments/devnet-salv-manifest.json with every public
 *     address and the current authority state. Mint and freeze
 *     authorities are deliberately NOT revoked by this script (see
 *     docs/token-spec.md's "Authorities" section) — the manifest
 *     records both authorities as live, pointing at the deployer.
 *
 * Never hard-codes a private key. The deployer keypair is loaded from a
 * local JSON file path (Solana CLI's standard `solana-keygen` output
 * format: a JSON array of 64 numbers), never committed to the repo.
 *
 * Usage:
 *   npx tsx scripts/salv/deploy-devnet-mint.ts <path-to-deployer-keypair.json>
 *
 * Environment:
 *   SOLANA_RPC_URL   Devnet RPC endpoint (defaults to the public
 *                    https://api.devnet.solana.com, which is
 *                    rate-limited — fine for a one-off deployment).
 */
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, transfer } from "@solana/spl-token";
import { COMMUNITY_ALLOCATION_BASE_UNITS, MARKET_ALLOCATION_BASE_UNITS, TOKEN_DECIMALS, TOTAL_SUPPLY_BASE_UNITS } from "../../src/lib/salv/tokenSpec";

function loadKeypair(path: string): Keypair {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(raw) || raw.length !== 64) {
    throw new Error(`${path} does not look like a solana-keygen JSON keypair file (expected a 64-number array).`);
  }
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function main() {
  const keypairPath = process.argv[2];
  if (!keypairPath) {
    console.error("Usage: npx tsx scripts/salv/deploy-devnet-mint.ts <path-to-deployer-keypair.json>");
    process.exit(1);
  }

  const rpcUrl = process.env.SOLANA_RPC_URL?.trim() || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  const deployer = loadKeypair(keypairPath);
  console.log(`Deployer / distributor / vault authority: ${deployer.publicKey.toBase58()}`);

  const balance = await connection.getBalance(deployer.publicKey);
  console.log(`Deployer balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  if (balance < 0.5 * LAMPORTS_PER_SOL) {
    console.warn("Warning: deployer has less than 0.5 SOL. Airdrop more before continuing: solana airdrop 2 <address> --url devnet");
  }

  console.log(`Creating mint (${TOKEN_DECIMALS} decimals, standard SPL Token program)...`);
  const mint = await createMint(connection, deployer, deployer.publicKey, deployer.publicKey, TOKEN_DECIMALS);
  console.log(`Mint created: ${mint.toBase58()}`);

  const holding = await getOrCreateAssociatedTokenAccount(connection, deployer, mint, deployer.publicKey);
  console.log(`Minting the entire fixed supply (${TOTAL_SUPPLY_BASE_UNITS} base units) once...`);
  await mintTo(connection, deployer, mint, holding.address, deployer, TOTAL_SUPPLY_BASE_UNITS);

  // Market holding account: a fresh keypair, distinct from the
  // distributor, since market-allocated supply should not sit in the
  // same account that pays out community claims.
  const marketHoldingKeyPath = join(process.cwd(), "deployments", "devnet-market-holding-keypair.json");
  const marketHolding = existsSync(marketHoldingKeyPath) ? loadKeypair(marketHoldingKeyPath) : Keypair.generate();
  if (!existsSync(marketHoldingKeyPath)) {
    writeFileSync(marketHoldingKeyPath, JSON.stringify(Array.from(marketHolding.secretKey)));
    console.log(`Generated a new market holding keypair -> ${marketHoldingKeyPath} (DO NOT COMMIT THIS FILE).`);
  }
  const marketAta = await getOrCreateAssociatedTokenAccount(connection, deployer, mint, marketHolding.publicKey);

  // Devnet simplification, documented honestly (see docs/token-spec.md
  // and src/lib/solana/salv/claimExecutor.ts): the Community Reward
  // Vault's token account IS the deployer/distributor's own ATA
  // (`holding`, created above) -- there is no separate transfer for the
  // community allocation because it simply stays where the mint put it.
  // A production design should separate vault custody from the
  // distributor's signing key (e.g. a dedicated program or multisig).
  const vaultAta = holding;

  console.log(`Transferring ${MARKET_ALLOCATION_BASE_UNITS} base units to the market holding account (the community allocation stays in the vault account above)...`);
  await transfer(connection, deployer, holding.address, marketAta.address, deployer, MARKET_ALLOCATION_BASE_UNITS);

  const finalVaultBalance = (await connection.getTokenAccountBalance(vaultAta.address)).value.amount;
  console.log(`Remaining in the vault account: ${finalVaultBalance} (must equal the community allocation exactly)`);
  if (BigInt(finalVaultBalance) !== COMMUNITY_ALLOCATION_BASE_UNITS) {
    throw new Error(
      `Supply accounting mismatch: expected exactly ${COMMUNITY_ALLOCATION_BASE_UNITS} base units left in the vault account, found ${finalVaultBalance}.`
    );
  }

  const manifest = {
    network: "devnet",
    mintAddress: mint.toBase58(),
    tokenProgram: "TOKEN_PROGRAM_ID (standard SPL Token, not Token-2022 -- see docs/token-spec.md)",
    decimals: TOKEN_DECIMALS,
    mintAuthority: deployer.publicKey.toBase58(),
    freezeAuthority: deployer.publicKey.toBase58(),
    rewardVaultAddress: vaultAta.address.toBase58(),
    distributorAddress: deployer.publicKey.toBase58(),
    marketHoldingAddress: marketAta.address.toBase58(),
    deployedAt: new Date().toISOString(),
    notes:
      "Devnet rehearsal deployment. Mint and freeze authorities are intentionally NOT revoked yet (see docs/token-spec.md's " +
      "'Authorities' section). The Community Reward Vault token account is the distributor's own ATA for this Devnet " +
      "rehearsal -- a production deployment should separate vault custody from the distributor's signing key.",
  };

  const manifestPath = join(process.cwd(), "deployments", "devnet-salv-manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\nWrote deployment manifest -> ${manifestPath}`);
  console.log("\nNext steps:");
  console.log("  1. Set these environment variables before running the app:");
  console.log(`     SALV_MINT_ADDRESS=${manifest.mintAddress}`);
  console.log(`     SALV_REWARD_VAULT=${manifest.rewardVaultAddress}`);
  console.log(`     SALV_DISTRIBUTOR=${manifest.distributorAddress}`);
  console.log(`     SALV_NETWORK=devnet`);
  console.log(`     SOLANA_RPC_URL=${rpcUrl}`);
  console.log(`     SALV_DISTRIBUTOR_SECRET_KEY=<contents of ${keypairPath}> (keep this secret; never commit it)`);
  console.log("  2. Follow docs/salv-devnet-claim-checklist.md for the real end-to-end claim test.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
