# $CULLER real Devnet claim checklist (Phase 5, Section 10)

**Status: OPEN / UNTESTED.** Nobody has executed this checklist with a
real $CULLER Devnet deployment and a real wallet yet, in this sandbox or
anywhere else. Nothing in this document, `docs/culler-architecture.md`,
`docs/phase-5-status.md`, or the UI should be read as "the $CULLER Devnet
claim flow works" — it is only a reproducible procedure for a human (or a
future session with real outbound network access) to actually verify it.
This sandbox has no outbound network access to any Solana RPC endpoint,
so both the deploy step and the claim step are explicitly deferred to a
developer running these scripts somewhere that has real Devnet access.
This is a separate test from `docs/devnet-e2e-checklist.md` (Phase 4 Part
A, which is about the cull *recovery* transaction) — this one is about
the $CULLER *claim* transaction, and is independently OPEN/UNTESTED. No
mock/simulated substitute for either checklist exists anywhere in this
codebase.

## Why this can't be done from this sandbox

- No real browser or wallet extension here, and no outbound network
  access to `api.devnet.solana.com` or any other Solana RPC endpoint.
- `scripts/culler/deploy-devnet-mint.ts` and `scripts/culler/claim-culler.ts`
  are both real, ready-to-run, and have been type-checked and reviewed
  here — but neither has actually been executed against a live cluster,
  because that execution requires exactly the network access this
  sandbox doesn't have.

## 1. Deploy the Devnet mint

```
solana-keygen new --outfile deployer-keypair.json   # if you don't have one
solana airdrop 2 $(solana-keygen pubkey deployer-keypair.json) --url devnet

SOLANA_RPC_URL=https://api.devnet.solana.com \
  npm run culler-deploy-devnet -- ./deployer-keypair.json
```

This creates the mint, mints the full 1,000,000,000 supply exactly once,
transfers the 700,000,000 market allocation to a generated holding
keypair (saved to `deployments/devnet-market-holding-keypair.json`,
gitignored), asserts the remaining vault balance is exactly 300,000,000
CULLER, and writes `deployments/devnet-culler-manifest.json`. It prints the
exact env vars to set next — copy them into `.env.local`:

```
CULLER_MINT_ADDRESS=<printed>
CULLER_REWARD_VAULT=<printed>
CULLER_DISTRIBUTOR=<printed>
CULLER_DISTRIBUTOR_SECRET_KEY=<printed — the deployer's own secret key, since it doubles as the distributor on Devnet>
CULLER_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
```

Restart `npm run dev` (or redeploy) after setting these.

## 2. Confirm the vault is visible

```
curl http://localhost:3000/api/culler/vault
```

Expect `configured: true`, `network: "devnet"`, `allocationCuller:
300000000`, `distributedCuller: 0`, `remainingCuller: 300000000`.

## 3. Produce a real verified cull event and points

Follow `docs/devnet-e2e-checklist.md` steps 1–4 with a real Devnet
wallet to get at least one verified cull event and some points for
that wallet. (This can reuse the same wallet/epoch as that checklist, or
a fresh one — either way, Phase 4 Part A's own checklist must still be
run and recorded independently; this step is not a substitute for it.)

## 4. Run an epoch through to a snapshot and claim rows

```
curl -X POST -H "x-dev-admin-secret: $DEV_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"number":<N>,"startsAt":"<iso>","endsAt":"<iso>","rewardPoolPoints":1000000}' \
  http://localhost:3000/api/dev/epochs

curl -X POST -H "x-dev-admin-secret: $DEV_ADMIN_SECRET" \
  http://localhost:3000/api/dev/epochs/<epochId>/activate

# ... wallet earns points via a real verified cull in this epoch ...

curl -X POST -H "x-dev-admin-secret: $DEV_ADMIN_SECRET" \
  http://localhost:3000/api/dev/epochs/<epochId>/close

curl -X POST -H "x-dev-admin-secret: $DEV_ADMIN_SECRET" \
  http://localhost:3000/api/dev/epochs/<epochId>/snapshot

curl -X POST -H "x-dev-admin-secret: $DEV_ADMIN_SECRET" \
  http://localhost:3000/api/dev/epochs/<epochId>/culler-claims
```

Confirm `GET /api/culler/claims/<wallet>?epoch=<N>` now reports
`status: "CLAIMABLE"` with a non-zero `amountCuller`.

## 5. Claim it for real

Either via the rewards page UI (connect the same wallet, the `$CULLER
reward` card should show `CLAIMABLE` and a `CLAIM CULLER` button), or via
the CLI:

```
npm run culler-claim -- <wallet-address> <epoch-number>
```

This sends a real Devnet transaction (vault → claimant's CULLER ATA).

## 6. Verify it actually happened

1. Look up the printed transaction signature on
   `https://explorer.solana.com/tx/<sig>?cluster=devnet`. Confirm it
   succeeded and contains a real `transferChecked` instruction moving
   CULLER out of the reward vault token account.
2. `spl-token balance <mint> --owner <wallet> --url devnet` (or check the
   wallet extension) and confirm the claimant's real CULLER balance
   increased by exactly the claimed amount.
3. `GET /api/culler/vault` again and confirm `distributedCuller` increased
   by the same amount, and `remainingCuller` decreased by it.

## 7. Confirm the second claim fails

Attempt the exact same claim again (`npm run culler-claim -- <wallet>
<epoch>` or clicking the button again):

- The database layer should report `ALREADY_CLAIMED` without even
  attempting a second transaction.
- As a second, independent line of defense: if that database check were
  somehow bypassed, the on-chain claim-receipt account
  (`src/lib/solana/culler/claimReceipt.ts`) would already exist at its
  deterministic address, and the transaction's
  `createAccountWithSeed` instruction would fail on-chain — record which
  of the two layers actually caught it.

## TODO: record real results here once this checklist has been run

Replace every `<unfilled>` below with the actual value observed during a
real run. Do not fill these in with assumed, estimated, or synthetic
values — only values copied from a real Devnet transaction.

- Date run: `<unfilled>`
- Run by: `<unfilled>`
- Mint address: `<unfilled>`
- Reward vault address: `<unfilled>`
- Distributor address: `<unfilled>`
- Claimant wallet address: `<unfilled>`
- Epoch number: `<unfilled>`
- Claimed amount (CULLER): `<unfilled>`
- Claim transaction signature: `<unfilled>`
- Confirmed slot: `<unfilled>`
- Claimant's CULLER balance before / after: `<unfilled>` / `<unfilled>`
- Community vault `distributedCuller` before / after: `<unfilled>` /
  `<unfilled>`
- Second-claim attempt result (which layer caught it — DB or on-chain
  receipt): `<unfilled>`

## What "pass" looks like

Every item above completes with the described real result — not a
console error, not a fallback/demo value, not a value invented locally.
If any step produces something unexpected, that's a real bug to fix
before claiming Phase 5's Devnet claim flow works; this checklist
existing is not itself evidence that it does.
