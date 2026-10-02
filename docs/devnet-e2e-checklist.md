# Devnet manual end-to-end checklist (NOT YET EXECUTED)

**Status: written, not run.** Nobody has executed this checklist with a
real wallet yet, in this sandbox or anywhere else. Nothing in this
document should be read as "the Devnet flow works" — it is only a
reproducible procedure for a human (or a future session with a real
browser + a funded Devnet wallet) to actually verify it. This sandbox has
no Phantom/Solflare extension and no browser UI to click through, so this
step is explicitly deferred to the developer running the app locally or
on a deployed preview.

## Why this can't be done from this sandbox

- There is no real browser with a wallet extension installed here — only
  a headless tool sandbox. Wallet-adapter's `sendTransaction` requires an
  actual extension popup and a human clicking "Approve".
- The sandbox's outbound network is restricted to a few hosts (npm
  registry, this agent's own tool backends). A live call to
  `api.devnet.solana.com` or any RPC provider cannot be made from here to
  pre-validate this doc end-to-end.

Everything below is the exact procedure to run somewhere that *can* do
both of those things (a developer's own machine, or a deployed preview
opened in a real browser).

## 1. Configure the app for Devnet

In `.env.local` (or the deployment's env config):

```
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_RPC_URL=https://api.devnet.solana.com
DATABASE_URL=                 # leave unset to use the embedded PGlite dev DB, or point at a real Postgres
DEV_ADMIN_SECRET=some-local-only-secret
```

Using the public `api.devnet.solana.com` endpoint is fine for light manual
testing; it is rate-limited, so don't hammer it.

Restart `npm run dev` after changing env vars.

## 2. Get a funded Devnet wallet with at least one genuinely empty token account

1. Install Phantom or Solflare, and switch the extension's network to
   **Devnet** (both support this in their settings).
2. Airdrop yourself Devnet SOL: `solana airdrop 2 <your-address> --url devnet`
   (requires the Solana CLI) or use a Devnet faucet website.
3. Create at least one SPL token account on Devnet and then empty it, so
   SALVAGE's scanner has something real to find:
   - `spl-token create-token --url devnet` (creates a new mint you control)
   - `spl-token create-account <MINT> --url devnet` (creates your ATA)
   - Do **not** mint any tokens into it, or mint then transfer/burn them
     back out to zero — the goal is a token account with balance 0 that
     is still open (and thus has reclaimable rent).

## 3. Connect wallet → scan

1. Open the app, go to `/scan`.
2. Click "Connect wallet", approve the Phantom/Solflare popup.
3. Confirm the wallet is actually on Devnet in the extension (mismatched
   networks will make the RPC calls return nothing for your Devnet
   account).
4. Run a scan. Confirm the empty token account from step 2 appears,
   classified `EMPTY_TOKEN_ACCOUNT` / disposition `RECOVERABLE`, with the
   correct expected recovery (rent lamports) shown.

## 4. Select → review → sign

1. Select that asset, open the review modal.
2. Confirm the modal's "Network" row reads **Solana Devnet** (this
   requires `NEXT_PUBLIC_SOLANA_NETWORK=devnet` to actually be picked up
   — if it still says mainnet-beta, the env var wasn't applied; check for
   a stale `.next` build cache).
3. Click confirm. Approve the real transaction signature prompt in the
   wallet extension.
4. Wait for on-chain confirmation (the UI moves through
   BUILDING → AWAITING_SIGNATURE → CONFIRMING → VERIFYING).

## 5. Confirm the account is actually gone

1. In a block explorer set to Devnet (e.g. explorer.solana.com with the
   Devnet cluster selected), look up the transaction signature shown in
   the app. Confirm it succeeded and contains a real `closeAccount`
   instruction for your token account.
2. Confirm the token account no longer appears in `spl-token accounts
   --url devnet` for your wallet.

## 6. Confirm Proof of Salvage + points

1. The app should show the salvage as Confirmed, with the real recovered
   SOL amount (your actual rent, not an estimate) and a point value.
2. Hit `GET /api/salvage/events/<your-wallet-address>` directly (e.g. via
   curl or the browser) and confirm it returns exactly one VERIFIED event
   for that transaction signature, with the right token account and
   points.
3. Hit `GET /api/rewards/<your-wallet-address>` and confirm `points`,
   `verifiedEvents`, `assetsSalvaged`, and `actualRecovery` all reflect
   this one action.
4. Re-submit the exact same signature to `/api/salvage/verify` again
   (e.g. replay the request your browser sent, or re-click confirm if the
   UI allows it) and confirm:
   - `/api/rewards/<wallet>` still reports the *same* points (no double
     count).
   - `/api/salvage/events/<wallet>` still reports exactly one event, not
     two.

## 7. (Optional) Exercise an epoch

1. `POST /api/dev/epochs` with header `x-dev-admin-secret: <your
   DEV_ADMIN_SECRET>` and body
   `{"number":1,"startsAt":"<iso>","endsAt":"<iso>","rewardPoolPoints":1000000}`.
2. `POST /api/dev/epochs/<id>/activate` with the same header.
3. Repeat step 4 (a new salvage) and confirm `/api/rewards/<wallet>` now
   shows a non-null `currentEpoch`, a non-zero `epochPoints`, and some
   `estimatedReward` (clearly a simulation, not a real $SALV balance).

## What "pass" looks like

Every item above completes with the described real result — not a
console error, not a fallback/demo value, not a value invented locally in
the browser. If any step produces something unexpected, that's a real bug
to fix before claiming Phase 3's Devnet flow works; this checklist
existing is not itself evidence that it does.
