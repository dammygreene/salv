# $SALV architecture (Phase 6)

This is the map of how $SALV's Devnet economy fits together — what each
module is responsible for, what guarantees it makes, and where the real
boundaries are between "this is live code that has been tested" and
"this is ready-to-run but has not been executed against a real network
from this environment." See `docs/phase-6-status.md` for the full
Phase 6 findings and status, `docs/salv-treasury.md` for the treasury
accounting/multisig model specifically, and
`docs/salv-devnet-checklist.md` for the exact remaining steps that need
a funded Devnet wallet. (`docs/phase-5-status.md` and
`docs/salv-devnet-claim-checklist.md` are kept as the historical record
of Phase 5's single-vault design, superseded by the treasury/reward-vault
split described below.)

**Phase 6 changed three load-bearing things from Phase 5, everywhere in
this document below assume the Phase 6 state unless marked "historical":**
1. Token program: legacy SPL Token → **Token-2022**, zero extensions
   (verified against StonkFun's current on-chain configs — see
   `docs/phase-6-status.md`).
2. Vault model: one distributor-owned hot-wallet vault → **three
   separate accounts** (treasury, reward vault, market holding), see
   §6-7 and `docs/salv-treasury.md`.
3. Treasury authority: none (implicit single key) → an explicit
   **3-of-3 multisig**, with the web app only ever able to *build*
   unsigned transactions for it, never sign or send one (§7a, §13).

## 1. Token spec — `src/lib/salv/tokenSpec.ts`, `docs/token-spec.md`

The single source of truth for name (`SALVAGE`), symbol (`SALV`), supply
(1,000,000,000, fixed, minted exactly once), decimals (9), and the only
two allocations that exist: Community rewards (300,000,000) and Market
(700,000,000). `assertNoHiddenAllocations()` is a standing, testable
assertion that these two numbers sum to the total and nothing else is
defined anywhere — there is no investor/strategic/marketing/ecosystem/
advisor bucket in this codebase, by construction, not just by convention.

## 2. Community treasury status — `src/lib/salv/vault.ts`

Read-only status (`getCommunityVaultStatus`, aliased as
`getCommunityTreasuryStatus`), computed purely from three append-only
ledgers — never a separately mutable counter that could drift:
- `allocatedToRewardsSalv` — sum of `CLAIMABLE` (not yet `CLAIMED`)
  `reward_claims` rows: a *reservation* against the cap, not a spend.
- `distributedSalv` — sum of `CLAIMED` `reward_claims` rows: actually
  sent on-chain, from the reward vault.
- `burnedSalv` — sum of confirmed rows in `treasury_burns` (§7c):
  permanently destroyed, never counted as distributed.

`remainingSalv = 300,000,000 − allocated − distributed − burned`.
Throws loudly (`CommunityVaultError`) if `allocated + distributed +
burned` were ever found to exceed the 300,000,000 SALV cap, which should
be mathematically impossible given the rounding rule in `claimAmount.ts`
and the fact that nothing can record a burn without a real confirmed
transaction signature, but is checked explicitly anyway as a last line
of defense. Exposed publicly, read-only, via `GET /api/salv/vault`.

## 3. Reward claim pipeline — `src/lib/salv/claims.ts`

The flow: an epoch closes → `createRewardSnapshotsForClosedEpoch`
(Phase 4) writes one **immutable** `reward_snapshots` row per wallet
(`epoch`, `wallet`, `points`, `totalPoints`, `rewardPool`, `allocation`)
→ `createClaimsForEpochSnapshots` computes each wallet's exact
base-unit allocation from that frozen snapshot (never from live,
possibly-changed points/epoch state) and writes a `CLAIMABLE`
`reward_claims` row → `attemptClaim` is the single entry point that
executes a real claim, going through an injected `ClaimExecutor` so the
orchestration logic (eligibility, idempotency, DB state transitions) is
fully unit-testable without any network access, while the real
implementation (`src/lib/solana/salv/claimExecutor.ts`) is what actually
runs against Devnet.

`getClaimView` is the one place that decides a wallet's displayable
status for an epoch (`NO_SNAPSHOT` / `CLAIMABLE` / `CLAIMED` / `FAILED`)
— both the API routes and the rewards page UI go through it, so there is
exactly one definition of what each status means.

## 4. Rounding — `src/lib/salv/claimAmount.ts`, `baseUnitAllocator.ts`

`computeClaimAmountBaseUnits` floors every wallet's share
(`floor(rewardPool * points / totalPoints)` in base units), which
guarantees the sum of all allocations for an epoch can never exceed that
epoch's own reward pool. Any leftover dust from flooring is simply never
allocated to anyone — it stays in the vault, unclaimed, forever (its
explicitly documented destination). No code path anywhere mints a single
extra base unit to "round up" a claim.

## 5. Claim idempotency — DB *and* on-chain

Two independent layers, deliberately, because the spec requires it:

1. **Database**: `reward_claims` has a unique `reward_snapshot_id` and a
   status state machine (`CLAIMABLE → CLAIMED`, or `→ FAILED → CLAIMABLE`
   again for a retry). `markClaimClaimed`'s UPDATE is a compare-and-swap
   (`WHERE status = 'CLAIMABLE'`) so two concurrent requests for the same
   claim can't both "win."
2. **On-chain** (`src/lib/solana/salv/claimReceipt.ts` +
   `claimExecutor.ts`): every claim's transaction also creates a
   deterministic account via `SystemProgram.createAccountWithSeed`,
   seeded from `sha256("salv-claim:<network>:<epoch>:<wallet>")`. If that
   exact claim was ever submitted before — even via a code path this
   server's own database doesn't know succeeded — the instruction fails
   and the whole transaction is rejected by the validator. This is the
   literal implementation of "a database record alone is not sufficient
   for the final production mechanism."

## 6. On-chain execution — `src/lib/solana/salv/claimExecutor.ts`

Builds one atomic transaction: (1) the claim-receipt account above, (2)
an idempotent associated-token-account creation for the claimant, (3) a
`transferChecked` from the **reward vault's** token account to that ATA
(Token-2022 program). All three succeed together or the whole
transaction is rejected — there is no way for a receipt to exist without
the transfer also having happened, or vice versa.

**Role separation (Phase 6)**: the reward vault is a distinct,
distributor-controlled account, *not* the treasury itself. It starts at
balance 0 on deployment and is only ever topped up by a multisig-signed
"fund reward vault" transaction (§7a) — a deliberate, bounded, auditable
transfer the three treasury members approve ahead of time, e.g. "release
the next 5M SALV for epoch 12's rewards." This is why the claim route can
execute without a human in the loop per claim (the spec's existing
"one-time on-chain claim" flow is preserved unmodified) while still
satisfying "no API route may have unilateral treasury authority": the
distributor key can only ever move whatever the multisig has already
chosen to put in the reward vault, never anything beyond it, and never
anything from the treasury account directly. See `docs/salv-treasury.md`
for the full reasoning and the exact invariant this relies on.

## 7. Devnet deployment — `scripts/salv/deploy-devnet-mint.ts`

Creates the mint (**Token-2022**, 9 decimals, zero extensions), mints the
full 1B supply exactly once, and splits it three ways:
- **Treasury** (300,000,000 SALV) → the `--treasury-multisig` address
  passed on the CLI (must already exist — see §7b). The script refuses
  to run without this argument; there is no fallback to a non-multisig
  address.
- **Reward vault** (0 SALV at deploy time) → a distributor-controlled ATA,
  left empty on purpose (§6). It is only ever funded later via a
  multisig-approved transaction.
- **Market allocation** (700,000,000 SALV) → a separate generated
  keypair, written to a gitignored file.

Writes `deployments/devnet-salv-manifest.json` (mint address, token
program, decimals, both authorities' current state, treasury address,
reward-vault address, distributor address, market-holding address) and
records the same data in the `token_deployments` DB table via
`tokenDeploymentRepo.ts`. **Never hard-codes a private key**: the
deployer's keypair is loaded from a file path passed on the CLI.

Mint and freeze authorities are deliberately **not revoked** by this
script — every production setup step must be complete and verified
first, and the final launch architecture (§9) may still need them. The
manifest records both authorities' addresses so that decision is always
visible, not silently implicit.

**Not yet run against a real Devnet from this environment** — see
`docs/salv-devnet-checklist.md` for the exact remaining steps.

## 7a. Treasury proposal builders — `src/lib/solana/salv/treasuryProposals.ts`

Pure, build-only functions: `buildFundRewardVaultTransaction`,
`buildTreasuryBurnTransaction`, `buildTreasuryTransferTransaction`. Each takes the
treasury's multisig address, a destination, an amount, and a recent
blockhash, and returns a fully-formed, **unsigned** `Transaction` object
(serialized as base64 for CLI/API output). None of these functions ever
import a `Keypair`, a secret key, or call `.sign()`/`sendTransaction()` —
there is no code path in this module capable of moving a single token.
Getting the transaction signed by all three treasury members (and
actually submitting it) is an out-of-band, manual, multisig-specific step
performed outside this application entirely (e.g. with the native
`@solana/spl-token` multisig signing flow, or a Squads V4 UI if the
project migrates to it later — see §7b).

Exposed two ways:
- `scripts/salv/build-fund-reward-vault-proposal.ts` — a CLI that loads
  the deployment manifest + treasury member env vars, fetches a live
  blockhash, builds the transaction, and prints it. Never signs or sends.
- `POST /api/dev/salv/treasury/proposals` — the same capability as a
  dev-gated API route, for recording a proposal in the DB audit trail
  (§13).

## 7b. Multisig — `scripts/salv/create-devnet-multisig.ts`

Creates a real native `@solana/spl-token` **Multisig** account on Devnet
with `m = 3` and exactly 3 signer public keys (the three treasury
members) — `createMultisig` rejects any other threshold value passed to
this script at the source level, so a 2-of-3 (or any non-3-of-3)
configuration cannot be produced by this tool. No secret key for any of
the three members is ever read, stored, or transmitted by this script or
anything in the web app — only their public keys (`SALV_TREASURY_MEMBER_1
/_2/_3` env vars, or passed as CLI args), which are not secrets.

**Why the native SPL Multisig and not Squads**: Squads V4
(`@sqds/multisig`, program `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf`)
was verified current (2.1.4 on npm, actively maintained, 37+ dependents)
and remains a reasonable future option — but it is a materially larger
integration (an on-chain proposal/vault PDA model, its own SDK, its own
account rent) for a requirement ("exactly 3-of-3, no single-key
authority, buildable-but-not-executable from the app") that the
already-installed `@solana/spl-token` dependency satisfies directly with
zero new dependencies. This is recorded as a decision, not an oversight;
if the project's needs grow (e.g. wanting on-chain proposal state, time
locks, or a multisig UI), Squads V4 is the documented next option to
evaluate.

**Not yet run against a real Devnet from this environment** — see
`docs/salv-devnet-checklist.md`.

## 7c. Burns — `src/lib/server/repositories/treasuryBurnRepo.ts`, `POST /api/dev/salv/treasury/burn`

There is no code path anywhere in this application that can execute a
burn. A burn must be built as a multisig proposal (§7a's
`buildTreasuryBurnTransaction`), signed by all three treasury members outside
this app, and submitted to the network entirely outside this app. Once
that real, already-confirmed transaction exists, its signature can be
*recorded* (not re-executed) via `POST /api/dev/salv/treasury/burn`,
which requires the real `transactionSignature` and writes one row to the
append-only `treasury_burns` table. `getCommunityVaultStatus` (§2) then
reflects it as `burnedSalv`, which is deliberately tracked as its own
bucket — never folded into `distributedSalv` ("a burn must never be
represented as distributed rewards") and never used to raise the 300M
cap itself (a burn can only ever make `remainingSalv` *smaller*, by
definition, never the cap larger).

## 8. Token program choice

**Token-2022**, 9 decimals, zero extensions — no transfer tax, no
permanent delegate, no transfer hooks, no confidential transfers, no
freeze mechanics beyond the default (unused) freeze authority. This is a
Phase 6 correction of Phase 5's original choice: Phase 5 assumed the
legacy SPL Token program based on StonkFun's flagship token; live
verification this phase (`docs/phase-6-status.md`, `docs/token-spec.md`)
found that StonkFun's actual current on-chain launch configs — both the
"standard launch" and "reward launch" configs — mint Token-2022, not
legacy SPL Token. $SALV now matches that, while still adding zero
extensions so none of StonkFun's "reward launch" transfer-fee behavior
(1-3% Token-2022 transfer fee) leaks into $SALV, which must have no
transfer tax. See the adapter below for the live-launch-time check.

## 9. StonkFun configuration adapter — `src/lib/salv/stonkfunAdapter.ts`

Does not launch anything. Compares an **observed** launch configuration
(what a real query against StonkFun would return) against an
**expected** one (`config/stonkfun-expected-launch-config.json`, reviewed
by a human) and fails closed — returns a rejection, never a "looks close
enough" pass — the moment any field differs: launch type, quote asset,
pool fee, creator fee (never hard-coded anywhere), creator payout wallet,
token standard, curve allocation, graduation behavior, claim mechanism.

## 10. Role separation — fee wallet, treasury, reward vault, deployer, market holding

Five distinct addresses exist in this system and are never merged:
1. **Fee wallet** (`src/lib/salv/feeWallet.ts`, `feeWalletRepo.ts`) — an
   append-only ledger (`fee_wallet_events`, keyed by transaction
   signature so replays are no-ops) tracking protocol/creator fee
   inflows and outflows. `getFeeWalletStatus` derives balance purely
   from the ledger (`totalReceived - claimed`), with an explicit guard
   against ever recording an outflow larger than the current balance.
2. **Community treasury** (§2, §7b) — the 3-of-3 multisig address, holds
   up to 300,000,000 SALV.
3. **Reward vault** (§6) — a distributor-controlled, zero-balance-at-
   deploy account that the treasury tops up on purpose; this is what
   claims actually spend from.
4. **Deployer/admin wallet** — whichever keypair pays rent and runs
   `deploy-devnet-mint.ts`/`create-devnet-multisig.ts`; never retains
   any token authority after deployment beyond whatever the manifest
   explicitly records (§7).
5. **Market-holding wallet** — a separate generated keypair holding the
   700,000,000 SALV market allocation; not part of the treasury's 300M
   accounting at all.

There is no code path anywhere in this codebase that moves a balance
between any two of these five — each has its own ledger/account and its
own repository module, and nothing imports across them to compute a
combined or substituted balance.

## 11. Buyback (dry-run only) — `src/lib/salv/buyback.ts`

`planBuyback` is pure and synchronous: given an explicit `BuybackPolicy`
(max spend, min output, slippage limit, expected mint/destination/quote
asset/network) and the current observed numbers, it either plans a swap
or rejects it with a specific reason. A hard 90% treasury-reserve ceiling
(`MAX_TREASURY_SPEND_RATIO`) applies on top of whatever `maxSpend` the
policy configures, regardless of how that policy is set — "never
automatically spend the entire treasury balance" is enforced in code,
not left to policy discipline alone. There is no code path in this
module (or anything it calls) that sends a transaction; verify
mint/destination/quote/route, simulate, enforce slippage/max spend,
record, verify final received is the explicit gate any future real
execution must pass through, and none of that execution exists yet.
**Phase 6 invariant**: a buyback's output is never treated as newly
created treasury supply — nothing in `buyback.ts`, `vault.ts`, or
`treasuryBurnRepo.ts` adds a buyback's proceeds to `allocationSalv` (the
300M cap is a fixed constant, never incremented by anything) or to any
other treasury balance field; if a buyback is ever actually executed in
the future, its SALV-denominated output would need to flow back in as an
explicit burn (§7c) or an explicit multisig-approved transfer, each
fully accounted for on its own terms, never silently folded in.

## 12. Runtime configuration — `src/lib/salv/config.ts`

`getSalvConfig()` reads the public configuration (`SALV_MINT_ADDRESS`,
`SALV_REWARD_VAULT`, `SALV_DISTRIBUTOR`, `SALV_TREASURY_ADDRESS`,
`SOLANA_RPC_URL`, plus optional `SALV_NETWORK`/`SALV_FEE_WALLET`) and
never throws just because $SALV isn't deployed yet — it returns
`{configured: false}` so every API route and the UI can render "NOT
LIVE" instead of crashing. `server-only`, never `NEXT_PUBLIC_*`.
`getDistributorSecretKey()` is a separate function (so nothing that only
needs the public config ever touches the secret), returns `null` if
unset, but throws on a malformed value rather than silently ignoring it.
**There is no `getTreasurySecretKey()` or equivalent anywhere in this
codebase** — the treasury has no single secret key for the app to hold
in the first place; `SALV_TREASURY_ADDRESS` is public on-chain
information (the multisig account's own address), safe to read and to
return from an API response, same as a mint address.

## 13. API surface

Public (read-only, or build-a-proposal-but-never-execute):
- `GET /api/salv/vault` — community treasury status: current SALV
  supply inputs, `allocationSalv` (300M cap), `allocatedToRewardsSalv`,
  `distributedSalv`, `burnedSalv`, `remainingSalv`, `treasuryAddress`.
  Fully read-only; cannot move any funds.
- `GET /api/salv/claims/:wallet[?epoch=N]` — one wallet's claim standing
  (defaults to the most recently closed epoch). Read-only.
- `POST /api/salv/claims/:wallet/claim` — executes a real on-chain claim
  **from the reward vault** (§6), never from the treasury multisig
  account directly; amount is capped by the wallet's immutable snapshot,
  which is itself capped by the 300M accounting invariant (§2).

Dev-gated (same `x-dev-admin-secret` convention as the existing
`/api/dev/epochs*` routes — fails closed if `DEV_ADMIN_SECRET` is unset):
- `POST /api/dev/epochs/:id/salv-claims` — creates `CLAIMABLE` rows
  (accounting reservations) for a closed epoch's snapshots. Never
  transfers a token.
- `GET`/`POST /api/dev/salv/fee-wallet` — fee ledger status / record an
  observed fee event. Entirely separate ledger from the treasury (§10).
- `GET`/`POST /api/dev/salv/buyback/dry-run` — list/plan dry-run
  buybacks. Never sends a transaction (§11).
- `GET`/`POST /api/dev/salv/treasury/proposals` (Phase 6, new) — list
  recorded proposals / **build** (never sign or send) an unsigned
  fund-reward-vault, burn, or transfer transaction via §7a's builders.
  Fails closed (409) if `$SALV`/treasury/multisig configuration is
  incomplete.
- `GET`/`POST /api/dev/salv/treasury/burn` (Phase 6, new) — list
  recorded burns / **record** (never execute) an already-confirmed,
  already-multisig-approved burn transaction, identified by its real
  on-chain `transactionSignature`.
- `GET /api/dev/salv/rewards/export` (Phase 7, new) — downloads the full
  reward allocation ledger as CSV. Same dev-admin gate; read-only. See
  §15 and `docs/salv-reward-ledger.md`.

Public, no wallet connection required (Phase 7, refined in Phase 8):
- `POST /api/salv/scan` — combined Solana(required)+Robinhood(optional)
  scan + reward-ledger record. See §15/§16.

**No route in either list can sign or submit a treasury-moving
transaction.** The only route that moves real tokens at all is the claim
route, and it can only ever move tokens already present in the reward
vault, never from the treasury account (§6).

## 14. UI

`src/app/rewards/page.tsx` (Cyber Chrome Y2K design unchanged, extended
minimally) renders:
- A single state-aware `$SALV reward` card, unchanged from Phase 5:
  `NOT LIVE` (nothing deployed), `DEVNET` (deployed, nothing claimable
  for this wallet right now), `CLAIMABLE` (real snapshot-based amount +
  a `CLAIM SALV` button), `CLAIMED` (shows the real transaction
  signature). It never shows a bare "SIMULATED" number without one of
  those four explicit labels, and never implies a live mainnet balance
  while connected to Devnet.
- A new "Community treasury" section (Phase 6), sourced live from
  `GET /api/salv/vault`: current SALV supply, treasury cap, rewards
  allocated, rewards claimed, burned, and treasury remaining. States the
  required language verbatim — "Community treasury: up to 300M SALV"
  and "Controlled by a 3-of-3 team multisig" — and explicitly notes the
  cap is not permanently locked. Exposes no secret key, no member
  identity beyond public addresses, and no other sensitive operational
  configuration.

## 15. No-wallet-connect scan + reward ledger (Phase 7, refined in Phase 8)

Phase 7 removed wallet-adapter *connection* from the primary user flow
entirely. Users never connect Phantom/Solflare/Backpack/etc. to preview a
wallet, scan it, or see $SALV standing — they paste a public address.
Phase 8 (§16) then refined *which* addresses that paste flow accepts and
how they relate to each other; this section describes the parts that are
unchanged since Phase 7.

- **Signing is untouched, just relocated.** Actually executing a
  recovery transaction still genuinely requires a real signature from
  the wallet that holds the funds — that has not changed and cannot
  change. What moved is *where* that one unavoidable wallet-adapter
  "connect" control lives: `src/components/review-modal.tsx`, shown only
  at the moment a transaction is about to be signed, never on the
  primary paste/scan screen. `src/lib/app-state.tsx`'s `canSign` is now
  additionally gated on the connected extension's public key matching
  the address currently being previewed, since `walletAddress` can now
  be set independently of any extension connection.
- `GET /api/dev/salv/rewards/export`: serializes the ledger table to CSV,
  gated by the same `assertDevAuthorized`/`DEV_ADMIN_SECRET` convention
  as every other dev-admin route in §13. Never public, read-only, and
  structurally incapable of exposing a secret (the table itself has no
  key/seed/signature/RPC-credential columns). Current CSV column order:
  see §16.

## 16. Solana-primary combined Solana+Robinhood submission (Phase 8)

**SALV is a Solana token: every SALV reward submission requires a Solana
wallet.** Robinhood is optional and can be attached to the same
submission. Submitting both addresses performs one scan and produces one
reward allocation — the Solana wallet is the primary (and only) reward
identity; Robinhood is never a second identity and never a second
allocation. Full design, CSV schema, replacement-policy rationale, and
status enum: `docs/salv-reward-ledger.md`. Summary:

- **Input**: `validateCombinedWalletSubmission()` in
  `src/lib/walletAddress.ts` — the single function both
  `POST /api/salv/scan` and both UI pages (`/scan`, `/rewards`) call, so
  they can never disagree about what a valid submission looks like.
  Solana is required and validated with the existing, unchanged
  `isValidSolanaAddress`; Robinhood is optional, but if present at all
  must pass `isValidEvmAddress` (`0x` + 40 hex chars — the same shape
  used by Robinhood Wallet and every standard EVM chain). A Robinhood
  address submitted with **no** Solana address is always rejected — there
  is no code path that can produce a "Robinhood only" success. Both
  fields are trimmed and length-capped (128 chars) before validation.
- **`POST /api/salv/scan`** (`src/app/api/salv/scan/route.ts`): takes
  `{ solanaWallet, robinhoodWallet? }` (replaces Phase 7's `{ wallet }`
  shape entirely — no backward-compat shim, since there are no external
  callers). It (a) always runs the real, existing read-only Solana RPC
  scan (`scanWallet()`, unchanged from Phase 1-6) against the Solana
  wallet, (b) if a Robinhood wallet was submitted, records it as a linked
  wallet (bookkeeping only, via `ensureWallet`) and marks its scan state
  as `NOT_IMPLEMENTED` — **never fakes** a Robinhood scan result — (c)
  independently computes the authoritative $SALV allocation via
  `getClaimView()` — the same reward-snapshot/claim system
  `/api/salv/claims/:wallet` already uses — computed **solely from the
  Solana wallet**, never from Robinhood and never from anything the
  client sent, and (d) upserts exactly **one** ledger row keyed on
  `(solanaWallet, epoch)`. The response keeps scan/reward/record signals
  explicitly separate: `scan.{solana,robinhood}` (independent scan
  outcomes), `reward.{salvAllocated,status,epochId}` (the one
  authoritative figure), `csvRecorded` (whether the ledger write
  succeeded).
- **Reward ledger** (`reward_ledger_entries` table, altered in place by
  migration `0006` on top of Phase 7's `0005` — never a duplicate table,
  following the repo's existing precedent of altering earlier tables in
  later migrations (`0002`, `0004`);
  `src/lib/server/repositories/rewardLedgerRepo.ts`): one row per
  `(solana_wallet, epoch)`. Robinhood is a plain nullable column on that
  row, never a uniqueness key. **Robinhood replacement policy**: the
  latest submitted Robinhood address (or its absence) fully replaces
  whatever was linked before for that Solana wallet + epoch on every
  upsert — never an additive merge, never two competing Robinhood links
  for one Solana wallet + epoch. A rescan of the same Solana wallet+epoch
  **updates** that row (`INSERT ... ON CONFLICT (solana_wallet,
  epoch_key) DO UPDATE`); a new epoch for the same Solana wallet creates
  a new row. Still a plain Postgres table in the same database as every
  other repository in this app — not Vercel Blob (never configured in
  this project) and never a write to the local filesystem.
- **CSV column order** (`GET /api/dev/salv/rewards/export`):
  `solana_wallet,robinhood_wallet,epoch_id,salv_allocated,scanned_at,status`
  — `robinhood_wallet` is blank when none is linked, never a placeholder.
- **Robinhood asset scanning is NOT implemented.** The address is stored
  as an optional linked address but does not create a second reward, and
  the UI/API never claim it works — every response marks it explicitly
  as `NOT_IMPLEMENTED` (submitted) or `NOT_LINKED` (not submitted).
