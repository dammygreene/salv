# SALVAGE Phase 5 — status

Honest status of each Phase 5 section as of this commit. This file exists
so status doesn't have to be reconstructed from conversation history —
keep it updated if any section's status changes. See
`docs/salv-architecture.md` for how everything fits together and
`docs/salv-devnet-claim-checklist.md` for the real Devnet claim
procedure.

## Section 1 — Token spec

**Status: DONE.** `docs/token-spec.md` + `src/lib/salv/tokenSpec.ts`.
Name SALVAGE, symbol SALV, total supply 1,000,000,000, allocations
exactly Community 300,000,000 / Market 700,000,000, nothing else.
`assertNoHiddenAllocations()` is a standing runtime+test assertion of
this. 6 tests in `tokenSpec.test.ts`.

## Section 2 — Fixed supply / authorities

**Status: DONE (design) / OPEN (Devnet execution).** The deploy script
(`scripts/salv/deploy-devnet-mint.ts`) mints the full 1B supply exactly
once and deliberately does **not** revoke mint/freeze authorities — both
are recorded in the deployment manifest so their (unrevoked) state is
always explicit, never silently assumed. Actually running the script
against Devnet is OPEN — see Section 9/10 below and
`docs/salv-devnet-claim-checklist.md`.

## Section 3 — Token program

**Status: DONE (research + decision), OPEN (live re-verification at
launch time).** Researched StonkFun's actual current launch mechanism
(web search, Sept–Oct 2026 snapshot — see the architecture doc): StonkFun
migrated to Raydium LaunchLab, and its own flagship STONK token uses the
original SPL Token program, not Token-2022. $SALV uses the original SPL
Token program, 9 decimals, no extensions (no transfer tax, no permanent
delegate, no hooks, no non-default freeze mechanics). Per Section 12,
this decision must still be re-verified live against StonkFun's actual
config before any real launch — the research here is not a substitute
for that live check.

## Section 4 — Community Reward Vault

**Status: DONE.** `src/lib/salv/vault.ts`'s `getCommunityVaultStatus`
computes allocation/distributed/remaining purely from the `reward_claims`
ledger, throws if distributed were ever found to exceed the 300M
allocation, and is exposed publicly via `GET /api/salv/vault`. Covered by
`vault.test.ts` plus the Section 11 scale tests.

## Section 5 — Reward claims

**Status: DONE (code + local integration tests), OPEN (real Devnet
execution).** Full flow wired: verified salvage event → points → epoch →
close epoch → `createRewardSnapshotsForClosedEpoch` (Phase 4) → immutable
snapshot → `createClaimsForEpochSnapshots` → `CLAIMABLE` claim row →
`attemptClaim` → (real executor) on-chain transfer → `CLAIMED`. Wired to
the rewards page UI (`YOUR POINTS`/estimate/status/`CLAIM SALV` button).
API: `GET /api/salv/claims/:wallet`, `POST /api/salv/claims/:wallet/claim`,
dev trigger `POST /api/dev/epochs/:id/salv-claims`. The real on-chain
execution step is OPEN/UNTESTED in this sandbox — see Section 10.

## Section 6 — Immutable reward snapshot

**Status: DONE** (built in Phase 4, unchanged here). `reward_snapshots`
is append-only with a unique `(epoch_id, wallet_id)` constraint and no
UPDATE path; `getClaimView`/`createClaimsForEpochSnapshots` always read
the frozen snapshot fields, never recompute from live points/epoch state.

## Section 7 — Claim idempotency

**Status: DONE, two independent layers.** Database: `reward_claims`'
unique `reward_snapshot_id` plus a compare-and-swap `UPDATE ... WHERE
status = 'CLAIMABLE'` in `markClaimClaimed`. On-chain (the layer the spec
explicitly requires beyond the database): a deterministic claim-receipt
account per `(network, epoch, wallet)`
(`src/lib/solana/salv/claimReceipt.ts`), created via
`SystemProgram.createAccountWithSeed` inside the same atomic transaction
as the transfer — a repeat claim's transaction fails on-chain
independent of this server's own database state. 8 tests in
`claimReceipt.test.ts` (pure, no RPC needed) plus `claims.test.ts`'s
orchestration coverage via injected fake executors.

## Section 8 — Rounding

**Status: DONE.** `src/lib/salv/claimAmount.ts` floors every wallet's
share; a closed epoch's claims can never sum to more than that epoch's
own reward pool. Any dust from flooring is never allocated to anyone and
has an explicit, documented destination: it simply stays in the vault,
unclaimed, forever. No code path mints an extra base unit to cover
rounding. Covered by `claimAmount.test.ts`, `baseUnitAllocator.test.ts`,
and the Section 11 scale report.

## Section 9 — Devnet token deployment

**Status: Code DONE, execution OPEN/UNTESTED.**
`scripts/salv/deploy-devnet-mint.ts` is real and ready to run: creates
the mint, mints the full supply once, splits market/community
allocations, writes `deployments/devnet-salv-manifest.json` with every
required field (mint address, token program, decimals, both authorities,
reward vault, distributor). Never hard-codes a private key — the
deployer keypair is loaded from a CLI-provided file path, and the
generated market-holding keypair is written to a gitignored file. Not
executed from this sandbox (no outbound RPC access). See
`docs/salv-devnet-claim-checklist.md` step 1.

## Section 10 — Real Devnet claim test

**Status: OPEN/UNTESTED**, explicitly separate from Phase 4 Part A.
`scripts/salv/claim-salv.ts` is real and ready to run (refuses to run if
$SALV isn't configured or the distributor secret is missing/mismatched;
never fakes a successful claim). The full manual procedure, including the
TODO block to record real results, is in
`docs/salv-devnet-claim-checklist.md`. Not executed from this sandbox.

## Section 11 — Test distributions at scale

**Status: DONE.** `scripts/salv/test-distributions.ts` runs the real
claim pipeline (immutable snapshot → `reward_claims` → claim-once
semantics) at 1, 10, 100, and 1,000 wallets against an embedded, real
Postgres engine (PGlite) — genuine integration coverage, not a
simulation of the simulation. Verifies, and throws immediately if any
ever fails: total allocation ≤ reward pool; total distribution ≤
community allocation; every eligible wallet claims exactly once;
duplicate claims all fail safely; a deliberately-included zero-point
wallet receives exactly 0 (and never even gets a claim row); and
re-running the identical inputs produces byte-identical allocations
(determinism). Report: `docs/salv-distribution-test-report.md`
(regenerate with `npm run salv-test-distributions`).

## Section 12 — StonkFun adapter

**Status: DONE (adapter), explicitly no launch.**
`src/lib/salv/stonkfunAdapter.ts` compares an observed launch
configuration against a human-reviewed expected one
(`config/stonkfun-expected-launch-config.json`) and fails closed on any
mismatch (launch type, quote asset, pool fee, creator fee — never
hard-coded — creator payout wallet, token standard, curve allocation,
graduation behavior, claim mechanism). 7 tests in
`stonkfunAdapter.test.ts`. No production launch exists anywhere in this
codebase.

## Section 13 — Fee wallet

**Status: DONE.** `fee_wallet_events` (append-only, keyed by transaction
signature) + `src/lib/salv/feeWallet.ts`/`feeWalletRepo.ts`. Strictly
separate from the community reward vault — no shared table, no shared
balance, no code path moving funds between the two. Dev-admin API:
`GET`/`POST /api/dev/salv/fee-wallet`.

## Section 14 — Buyback engine (dry-run)

**Status: DONE, dry-run only.** `src/lib/salv/buyback.ts`'s
`planBuyback`/`planAndRecordBuyback` require an explicit policy, compute
a planned spend/output from real inputs (fee balance, SALV quote, max
spend, min output, slippage limit), and enforce a hard 90% treasury
reserve ceiling on top of whatever the policy's own `maxSpend` says.
Nothing in this module or anything it calls sends a transaction. 12
tests in `buyback.test.ts`. Dev-admin API: `GET`/`POST
/api/dev/salv/buyback/dry-run`.

## Section 15 — Buyback safety

**Status: DONE (as pre-execution gates on the dry-run), no real
execution exists.** `planBuyback` rejects (never silently proceeds) if
the observed mint, destination, quote asset, or network differs from the
policy's expected values ("verify mint/destination/quote/route"), and
enforces both the slippage limit and the max-spend/treasury-reserve
ceiling. There is no "simulate transaction" or "record transaction"
execution step yet because there is no execution yet — those remain
real, open work for whenever a real buyback is actually built, which is
explicitly out of scope for this phase.

## Section 16 — Production configuration

**Status: DONE.** `src/lib/salv/config.ts`'s `getSalvConfig()` /
`getDistributorSecretKey()`. `SALV_MINT_ADDRESS`, `SALV_REWARD_VAULT`,
`SALV_DISTRIBUTOR`, `SALV_FEE_WALLET`, `SOLANA_RPC_URL` are all
server-only, never `NEXT_PUBLIC_*`. Missing config never crashes the
app — every endpoint/UI element reports "not configured"/"NOT LIVE"
instead. 7 tests in `config.test.ts`. `.env.example`/`env.example.md`
updated with every new variable.

## Section 17 — UI

**Status: DONE.** No redesign — `src/app/rewards/page.tsx` keeps the
existing Cyber Chrome Y2K layout and card components. The former bare
"SIMULATED · not $SALV" label is now one state-aware `$SALV reward` card
showing exactly one of `NOT LIVE` / `DEVNET` / `CLAIMABLE` / `CLAIMED`,
with a real `CLAIM SALV` button that appears only in the `CLAIMABLE`
state and calls the real claim API. Never implies a live mainnet balance
while connected to Devnet.

## Section 18 — Tests

**Status: DONE.** Full-suite validation at the time of this commit:
`npm run lint` clean, `npx tsc --noEmit` clean, `npm run build` succeeds
(all routes, including the 6 new $SALV routes, registered), `npx vitest
run` passing across every test file (counts below). Required cases and
where they live:

- Fixed supply / no hidden allocations: `tokenSpec.test.ts`.
- Vault balance (allocation/distributed/remaining, cap enforcement):
  `vault.test.ts`.
- Snapshot immutability: Phase 4's `createRewardSnapshots.test.ts`
  (unchanged, still enforced).
- Claim once / duplicate claim: `claims.test.ts` (DB layer),
  `claimReceipt.test.ts` (on-chain address determinism underlying the
  on-chain layer), `scripts/salv/test-distributions.ts`'s report (live
  exercise at 1/10/100/1,000 wallets).
- Reward cap / community allocation cap: `vault.test.ts`,
  `claimAmount.test.ts`, the distribution report.
- Zero points: `claimAmount.test.ts`, `baseUnitAllocator.test.ts`, the
  distribution report (a deliberately-included zero-point wallet at
  every scale > 1).
- Rounding (deterministic, never over-distributes): `claimAmount.test.ts`,
  `baseUnitAllocator.test.ts`, the distribution report's determinism
  re-run check.
- Multi-wallet distribution: `baseUnitAllocator.test.ts`, the
  distribution report.
- Invalid epoch / invalid snapshot: `claims.test.ts`.
- Wrong mint / wrong recipient / wrong network: `buyback.test.ts`
  (`verify mint/destination/network` rejection paths),
  `stonkfunAdapter.test.ts` (config-mismatch fail-closed paths).
- Buyback dry-run / slippage rejection: `buyback.test.ts`.

## Definition of Done

- "$SALV exists, community reward vault exists, a closed epoch creates a
  final snapshot, a real wallet can claim SALV, claim is verified
  onchain, second claim fails, total distributions never exceed 300M
  SALV" — **design and local-integration-tested, real Devnet execution
  OPEN** (Sections 9–10; see `docs/salv-devnet-claim-checklist.md`).
- "StonkFun: only the configuration adapter/dry-run exists, no production
  launch, no real buyback" — **met.** No launch transaction, no buyback
  execution, anywhere in this codebase.
- "Phase 4 Part A remains explicitly OPEN/UNTESTED until performed with a
  real wallet against Solana Devnet" — **still true and unchanged**; see
  `docs/devnet-e2e-checklist.md` / `docs/phase-4-status.md`.
