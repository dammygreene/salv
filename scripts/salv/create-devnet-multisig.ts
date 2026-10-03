/**
 * Creates the real, on-chain, 3-of-3 SPL Token `Multisig` account that
 * will become $SALV's community treasury authority (Phase 6).
 *
 * This script requires a reachable Devnet RPC endpoint and a funded
 * Devnet keypair, neither of which this sandbox has -- the same
 * constraint documented for Phase 4 Part A and the existing
 * deploy-devnet-mint.ts script. It must be run by a human with real
 * Devnet access, BEFORE deploy-devnet-mint.ts (that script requires the
 * resulting multisig address as an argument -- see its own usage).
 *
 * What this creates: a `Multisig` account under the SPL Token program
 * (Token-2022, matching $SALV's own mint -- see docs/token-spec.md).
 * This is a real, currently-supported, zero-extra-dependency feature of
 * the base Token Program itself (`@solana/spl-token`'s `createMultisig`)
 * -- not a third-party multisig SDK. See docs/salv-treasury.md for why
 * this was chosen over installing a Squads SDK for this phase.
 *
 * The three member public keys are read from the command line -- this
 * script NEVER reads, generates, or stores a private key for any of the
 * three members. Each team member keeps control of their own keypair;
 * only their PUBLIC key is ever given to this script or to the app's
 * environment configuration (see src/lib/salv/multisig.ts).
 *
 * Usage:
 *   npx tsx scripts/salv/create-devnet-multisig.ts \
 *     <path-to-funder-keypair.json> \
 *     <member1-pubkey> <member2-pubkey> <member3-pubkey>
 *
 * The funder pays the one-time rent for the Multisig account and is NOT
 * one of its members unless you also pass its own public key as one of
 * the three member arguments.
 *
 * Environment:
 *   SOLANA_RPC_URL   Devnet RPC endpoint (defaults to the public
 *                    https://api.devnet.solana.com).
 */
import { readFileSync } from "fs";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { createMultisig, getMultisig, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { assertIsThreeOfThree, SALV_TREASURY_THRESHOLD } from "../../src/lib/salv/multisig";

function loadKeypair(path: string): Keypair {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(raw) || raw.length !== 64) {
    throw new Error(`${path} does not look like a solana-keygen JSON keypair file (expected a 64-number array).`);
  }
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function main() {
  const [funderPath, member1, member2, member3] = process.argv.slice(2);
  if (!funderPath || !member1 || !member2 || !member3) {
    console.error(
      "Usage: npx tsx scripts/salv/create-devnet-multisig.ts <path-to-funder-keypair.json> <member1-pubkey> <member2-pubkey> <member3-pubkey>"
    );
    process.exit(1);
  }

  const memberKeys = [new PublicKey(member1), new PublicKey(member2), new PublicKey(member3)];
  const uniqueMembers = new Set(memberKeys.map((k) => k.toBase58()));
  if (uniqueMembers.size !== 3) {
    throw new Error("The 3 member public keys must be distinct -- $SALV's treasury multisig requires 3 different people, not 1 key counted 3 times.");
  }

  const rpcUrl = process.env.SOLANA_RPC_URL?.trim() || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const funder = loadKeypair(funderPath);

  const balance = await connection.getBalance(funder.publicKey);
  console.log(`Funder: ${funder.publicKey.toBase58()} (${balance / LAMPORTS_PER_SOL} SOL)`);
  if (balance < 0.01 * LAMPORTS_PER_SOL) {
    console.warn("Warning: funder has very little SOL. Airdrop more before continuing: solana airdrop 1 <address> --url devnet");
  }

  console.log(`Creating a ${SALV_TREASURY_THRESHOLD}-of-3 SPL Token (Token-2022) Multisig account...`);
  console.log(`Members:\n  1. ${memberKeys[0].toBase58()}\n  2. ${memberKeys[1].toBase58()}\n  3. ${memberKeys[2].toBase58()}`);

  const multisigAddress = await createMultisig(
    connection,
    funder,
    memberKeys,
    SALV_TREASURY_THRESHOLD,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  // Real on-chain verification, not an assumption: read the account back
  // and confirm it actually has 3 signers and a 3-of-3 threshold before
  // reporting success.
  const onChain = await getMultisig(connection, multisigAddress, "confirmed", TOKEN_2022_PROGRAM_ID);
  assertIsThreeOfThree(onChain.n, onChain.m);

  console.log(`\nTreasury multisig created: ${multisigAddress.toBase58()}`);
  console.log("Verified on-chain: 3 signers, 3-of-3 threshold.");
  console.log("\nNext steps:");
  console.log("  1. Set these environment variables (public keys only -- never a private key):");
  console.log(`     SALV_TREASURY_MULTISIG_ADDRESS=${multisigAddress.toBase58()}`);
  console.log(`     SALV_TREASURY_MEMBER_1=${memberKeys[0].toBase58()}`);
  console.log(`     SALV_TREASURY_MEMBER_2=${memberKeys[1].toBase58()}`);
  console.log(`     SALV_TREASURY_MEMBER_3=${memberKeys[2].toBase58()}`);
  console.log("  2. Pass this multisig address to deploy-devnet-mint.ts's --treasury-multisig argument.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
