# $SALV Phase 6 Devnet checklist — treasury + role-separated deployment

**Status: OPEN / UNTESTED.** Nothing in this document, in
`docs/salv-architecture.md`, or in `docs/phase-6-status.md` should be
read as "the Phase 6 treasury has been deployed to Devnet" — every
script referenced here is real, type-checked (`npx tsc --noEmit`),
lint-clean, and has unit test coverage for its pure logic, but **none of
them have been executed against a live Solana cluster from this
environment**, because this sandbox has no outbound network access to
any Solana RPC endpoint (the same constraint already documented in
`docs/devnet-e2e-checklist.md` for Phase 4 Part A and
`docs/salv-devnet-claim-checklist.md` for the Phase 5 claim flow). This
is a reproducible procedure for a human, or a future session with real
Devnet access, to actually run.

This supersedes `docs/salv-devnet-claim-checklist.md`'s deploy step
(step 1 there used the old single-vault Phase 5 script); the claim-side
steps in that document (steps 2+) are still accurate once the treasury
and reward vault described below exist.

## What you need before starting

- A funded Devnet keypair to act as deployer/admin (pays rent for every
  account created below; never retains treasury authority afterward).
- Three **separate** keypairs for the three treasury members. This
  checklist never asks for their secret keys — only their public keys
  (`solana-keygen pubkey <path>`), which is also all the running app
  ever needs (`SALV_TREASURY_MEMBER_1/2/3`).
- A reachable Devnet RPC endpoint (`https://api.devnet.solana.com` by
  default, overridable via `SOLANA_RPC_URL`).

## Step 1 — Create the 3-of-3 treasury multisig

```
solana-keygen new --outfile deployer-keypair.json        # if you don't already have one
solana airdrop 2 $(solana-keygen pubkey deployer-keypair.json) --url devnet

npx tsx scripts/salv/create-devnet-multisig.ts \
  ./deployer-keypair.json \
  <member1-pubkey> <member2-pubkey> <member3-pubkey>
```

This creates a real on-chain SPL Token `Multisig` account (Token-2022
program, matching $SALV's own mint) with exactly 3 signers and `m = 3` —
the script itself refuses (via `assertIsThreeOfThree`) to create anything
else. It prints the resulting multisig address. **Record this address —
it is the `--treasury-multisig` argument for step 2, and later the
`SALV_TREASURY_MULTISIG_ADDRESS` / `SALV_TREASURY_MEMBER_1/2/3` env vars
for any proposal-building step.**

Not yet run against a real Devnet from this environment.

## Step 2 — Deploy the Token-2022 mint and split the supply

```
npx tsx scripts/salv/deploy-devnet-mint.ts \
  ./deployer-keypair.json \
  --treasury-multisig <multisig-address-from-step-1>
```

This:
1. Creates the mint (Token-2022, 9 decimals, zero extensions).
2. Mints the entire fixed 1,000,000,000 SALV supply exactly once.
3. Transfers 700,000,000 SALV to a freshly generated market-holding
   keypair (written to `deployments/devnet-market-holding-keypair.json`,
   gitignored — **do not commit this file**).
4. Transfers 300,000,000 SALV to the treasury's own associated token
   account, owned by the multisig from step 1 (not by the deployer).
5. Leaves the reward distribution vault (a separate, distributor-owned
   account) at **0 SALV** — it is not pre-funded.
6. Asserts the temporary holding account is left at exactly 0 (every
   unit of supply accounted for) before proceeding.
7. Writes `deployments/devnet-salv-manifest.json` (mint address, token
   program, decimals, both mint/freeze authorities' current state,
   treasury address + authority, reward-vault address, distributor
   address, market-holding address) and records the same data in the
   `token_deployments` DB table if `DATABASE_URL` is set.
8. Prints the exact env vars to copy into `.env.local`:
   `SALV_MINT_ADDRESS`, `SALV_REWARD_VAULT`, `SALV_DISTRIBUTOR`,
   `SALV_TREASURY_ADDRESS`, `SALV_NETWORK=devnet`, `SOLANA_RPC_URL`, and
   `SALV_DISTRIBUTOR_SECRET_KEY` (the deployer's own secret key, which
   doubles as the reward-claim-signing distributor on Devnet — **never**
   the treasury's key, since the treasury has no single key).

Mint and freeze authorities are deliberately **not revoked** by this
script yet — see `docs/salv-architecture.md` §7 for why.

Not yet run against a real Devnet from this environment.

## Step 3 — Validate the deployment on-chain

Before trusting the manifest, independently confirm on-chain (e.g. via
`solana spl-token supply <mint>`, `solana spl-token account-info
<treasury-ata>`, `solana spl-token account-info <reward-vault-ata>`, and
`solana spl-token display <mint>` for authority state) that:
- Total supply is exactly 1,000,000,000 SALV (9 decimals).
- The treasury ATA's owner is the multisig account from step 1, not the
  deployer, and its balance is exactly 300,000,000 SALV.
- The reward vault's balance is exactly 0 SALV.
- The market-holding account's balance is exactly 700,000,000 SALV.
- The mint's decimals are 9 and its program is Token-2022
  (`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`).

Not yet performed — no deployment to validate yet.

## Step 4 — Fund the reward vault (first time, and every subsequent top-up)

```
SALV_TREASURY_MEMBER_1=<member1-pubkey> \
SALV_TREASURY_MEMBER_2=<member2-pubkey> \
SALV_TREASURY_MEMBER_3=<member3-pubkey> \
  npx tsx scripts/salv/build-fund-reward-vault-proposal.ts <amountSalv>
```

This builds (via `buildFundRewardVaultTransaction`) and prints a base64
**unsigned** transaction moving `<amountSalv>` SALV from the treasury to
the reward vault. It never signs or sends anything. Hand the printed
transaction to all three treasury members so each can inspect it and
sign with their own wallet/tooling (e.g. the Solana CLI's
multisig-aware signing flow, or a wallet that supports the SPL Token
`Multisig` account type) — only once all 3 signatures are present can the
transaction actually be submitted to the network, entirely outside this
application. Re-run this script with a new amount any time the treasury
decides to release another tranche of rewards; there is no limit on how
many times it can be run other than the 300M cap itself (enforced by
`getCommunityVaultStatus`, §2 of `docs/salv-architecture.md`).

Not yet run against a real Devnet from this environment (also requires
step 1/2 to already exist).

## Step 5 — Set the app's environment and verify the API

Once steps 1-4 are complete, set in `.env.local` (or the real deployment
environment): `SALV_MINT_ADDRESS`, `SALV_REWARD_VAULT`,
`SALV_DISTRIBUTOR`, `SALV_DISTRIBUTOR_SECRET_KEY`,
`SALV_TREASURY_ADDRESS`, `SALV_NETWORK=devnet`, `SOLANA_RPC_URL` (all
printed by step 2). `SALV_TREASURY_MEMBER_1/2/3` and
`SALV_TREASURY_MULTISIG_ADDRESS` are only needed by the proposal-building
scripts/routes (step 4, and `POST /api/dev/salv/treasury/proposals`), not
by the running app's claim path.

Then verify:
- `GET /api/salv/vault` reports `configured: true`, `network: "devnet"`,
  the real treasury/reward-vault addresses, and the real supply/
  allocation figures.
- The rewards page's "Community treasury" section renders the same
  figures and the required language ("Community treasury: up to 300M
  SALV", "Controlled by a 3-of-3 team multisig").
- Follow `docs/salv-devnet-claim-checklist.md`'s remaining steps (closing
  an epoch, creating a snapshot/claim row, and executing a real claim)
  to confirm a reward actually pays out from the now-funded reward
  vault.

Not yet performed — no real deployment exists yet in this environment to
verify against.

## Why none of this has been run here

This sandbox has no outbound network access to any Solana RPC endpoint
(confirmed by the same constraint documented for every prior Devnet
checklist in this repository). All five scripts above have been written,
type-checked, lint-checked, and (where their logic is pure — the
transaction-building functions in `treasuryProposals.ts`, the config
validation in `multisig.ts`) unit-tested without requiring network
access. Running them against a real cluster requires a developer (or a
future session) with genuine Devnet connectivity and the funded keypairs
described above.
