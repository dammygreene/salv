# $SALV architecture (Phase 5)

This is the map of how $SALV's Devnet economy fits together — what each
module is responsible for, what guarantees it makes, and where the real
boundaries are between "this is live code that has been tested" and
"this is ready-to-run but has not been executed against a real network
from this environment." See `docs/phase-5-status.md` for the
section-by-section status and `docs/salv-devnet-claim-checklist.md` for
the manual procedure to actually exercise this against Devnet.

## 1. Token spec — `src/lib/salv/tokenSpec.ts`, `docs/token-spec.md`

The single source of truth for name (`SALVAGE`), symbol (`SALV`), supply
(1,000,000,000, fixed, minted exactly once), decimals (9), and the only
two allocations that exist: Community rewards (300,000,000) and Market
(700,000,000). `assertNoHiddenAllocations()` is a standing, testable
assertion that these two numbers sum to the total and nothing else is
defined anywhere — there is no investor/strategic/marketing/ecosystem/
advisor bucket in this codebase, by construction, not just by convention.

## 2. Community Reward Vault — `src/lib/salv/vault.ts`

Read-only status (`getCommunityVaultStatus`), computed purely from the
`reward_claims` ledger's sum of CLAIMED rows — never a separately mutable
counter that could drift. Throws loudly (`CommunityVaultError`) if
distributed were ever found to exceed the 300M allocation, which should
be mathematically impossible given the rounding rule in `claimAmount.ts`,
but is checked explicitly anyway.

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
`transferChecked` from the vault's token account to that ATA. All three
succeed together or the whole transaction is rejected — there is no way
for a receipt to exist without the transfer also having happened, or vice
versa.

**Devnet simplification, documented honestly**: the vault's token
account is the distributor's own ATA (a single hot wallet), not a
separate program-owned or multisig-controlled account. Fine for
rehearsing the mechanism on Devnet; revisit before any mainnet
deployment (see `docs/token-spec.md`'s own authority notes).

## 7. Devnet deployment — `scripts/salv/deploy-devnet-mint.ts`

Creates the mint (standard SPL Token, 9 decimals), mints the full 1B
supply exactly once, splits it into the market allocation (transferred to
a separate generated keypair) and the community allocation (left in the
vault), and writes `deployments/devnet-salv-manifest.json` — the
deployment manifest required by Section 9 (mint address, token program,
decimals, both authorities' current state, vault address, distributor
address). **Never hard-codes a private key**: the deployer's keypair is
loaded from a file path passed on the CLI, and the generated
market-holding keypair is written to a gitignored file
(`deployments/devnet-market-holding-keypair.json`).

Mint and freeze authorities are deliberately **not revoked** by this
script — Section 2 requires every production setup step to be complete
and verified first. The manifest records both authorities' addresses so
that decision is always visible, not silently implicit.

## 8. Token program choice (Section 3)

Standard/original SPL Token program, 9 decimals, no extensions — no
transfer tax, no permanent delegate, no transfer hooks, no freeze
mechanics beyond the default (unused) freeze authority. See
`docs/token-spec.md` and the StonkFun research notes in
`docs/phase-5-status.md` for why: StonkFun's own flagship token and
documented standard launch path use the original SPL Token program via
Raydium LaunchLab, so there is no concrete product requirement pulling
$SALV toward Token-2022. This must still be re-verified live against
StonkFun's actual current configuration before any real launch — see the
adapter below.

## 9. StonkFun configuration adapter — `src/lib/salv/stonkfunAdapter.ts`

Does not launch anything. Compares an **observed** launch configuration
(what a real query against StonkFun would return) against an
**expected** one (`config/stonkfun-expected-launch-config.json`, reviewed
by a human) and fails closed — returns a rejection, never a "looks close
enough" pass — the moment any field differs: launch type, quote asset,
pool fee, creator fee (never hard-coded anywhere), creator payout wallet,
token standard, curve allocation, graduation behavior, claim mechanism.

## 10. Fee wallet — `src/lib/salv/feeWallet.ts`, `feeWalletRepo.ts`

An append-only ledger (`fee_wallet_events`, keyed by transaction
signature so replays are no-ops) tracking protocol/creator fee inflows
and outflows, completely separate from `reward_claims`/the community
vault — there is no code path anywhere that moves a balance between the
two. `getFeeWalletStatus` derives balance purely from the ledger
(`totalReceived - claimed`), with an explicit guard against ever
recording an outflow larger than the current balance.

## 11. Buyback (dry-run only) — `src/lib/salv/buyback.ts`

`planBuyback` is pure and synchronous: given an explicit `BuybackPolicy`
(max spend, min output, slippage limit, expected mint/destination/quote
asset/network) and the current observed numbers, it either plans a swap
or rejects it with a specific reason. A hard 90% treasury-reserve ceiling
(`MAX_TREASURY_SPEND_RATIO`) applies on top of whatever `maxSpend` the
policy configures, regardless of how that policy is set — Section 14's
"never automatically spend the entire treasury balance" is enforced in
code, not left to policy discipline alone. There is no code path in this
module (or anything it calls) that sends a transaction; `docs/token-spec.md`-
style safety (verify mint/destination/quote/route, simulate, enforce
slippage/max spend, record, verify final received) is the explicit gate
any future real execution must pass through, and none of that execution
exists yet.

## 12. Runtime configuration — `src/lib/salv/config.ts`

`getSalvConfig()` reads the public configuration (`SALV_MINT_ADDRESS`,
`SALV_REWARD_VAULT`, `SALV_DISTRIBUTOR`, `SOLANA_RPC_URL`, plus optional
`SALV_NETWORK`/`SALV_FEE_WALLET`) and never throws just because $SALV
isn't deployed yet — it returns `{configured: false}` so every API route
and the UI can render "NOT LIVE" instead of crashing. `server-only`,
never `NEXT_PUBLIC_*`. `getDistributorSecretKey()` is a separate function
(so nothing that only needs the public config ever touches the secret),
returns `null` if unset, but throws on a malformed value rather than
silently ignoring it.

## 13. API surface

Public:
- `GET /api/salv/vault` — community vault status.
- `GET /api/salv/claims/:wallet[?epoch=N]` — one wallet's claim standing
  (defaults to the most recently closed epoch).
- `POST /api/salv/claims/:wallet/claim` — executes a real on-chain claim.

Dev-gated (same `x-dev-admin-secret` convention as the existing
`/api/dev/epochs*` routes — fails closed if `DEV_ADMIN_SECRET` is unset):
- `POST /api/dev/epochs/:id/salv-claims` — creates `CLAIMABLE` rows for a
  closed epoch's snapshots.
- `GET`/`POST /api/dev/salv/fee-wallet` — fee ledger status / record an
  observed fee event.
- `GET`/`POST /api/dev/salv/buyback/dry-run` — list/plan dry-run buybacks.

## 14. UI

`src/app/rewards/page.tsx` (Cyber Chrome Y2K design unchanged) renders a
single state-aware `$SALV reward` card: `NOT LIVE` (nothing deployed),
`DEVNET` (deployed, nothing claimable for this wallet right now),
`CLAIMABLE` (real snapshot-based amount + a `CLAIM SALV` button),
`CLAIMED` (shows the real transaction signature). It never shows a bare
"SIMULATED" number without one of those four explicit labels, and never
implies a live mainnet balance while connected to Devnet.
