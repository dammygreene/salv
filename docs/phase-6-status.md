# Phase 6 status — SALV supply + community treasury architecture

This phase finalized SALV's supply/treasury architecture and prepared
(but did not execute) a real Devnet deployment under it. No mainnet
activity occurred. This document is the authoritative Phase 6 record;
see `docs/salv-architecture.md` for the module-by-module map and
`docs/salv-treasury.md` for the treasury model specifically. See
`docs/phase-7-status.md` for the next phase (removing wallet-connect
from the user flow and adding the reward allocation ledger), which
builds on this phase's treasury/claim system without changing it.

## 1. Final supply / account architecture

- **1,000,000,000 SALV fixed supply**, minted exactly once, no future
  minting, no transfer tax, no hidden allocations, no permanent
  delegate, no arbitrary hooks (`src/lib/salv/tokenSpec.ts`,
  `assertNoHiddenAllocations()`).
- **Token program: Token-2022**, zero extensions enabled (see §2 below
  for why this supersedes Phase 5's original SPL Token choice).
- **700,000,000 SALV market/launch allocation** → a separate generated
  market-holding keypair, outside the treasury's accounting entirely.
- **300,000,000 SALV community treasury** (hard cap, never exceeded) →
  a **3-of-3 multisig address** (native `@solana/spl-token` `Multisig`
  account, `m = 3`, exactly 3 signer public keys). Not permanently
  locked — a team-controlled pool for rewards, giveaways, future
  community rewards, documented ecosystem/contributor incentives, and
  permanent burns, all requiring all three signers.
- **Reward vault**: a fourth, distributor-controlled account, starting
  at 0 SALV, only ever funded by a multisig-approved "fund reward vault"
  transaction. Reward claims spend from here, never from the treasury
  multisig account directly — see `docs/salv-treasury.md` for why this
  satisfies "no unilateral treasury authority" while still letting the
  existing one-time-claim flow work without a human in the loop per
  claim.
- **Fee wallet**: a fifth, fully separate address/ledger for
  protocol/creator fees — never merged with the treasury.
- **Deployer/admin wallet**: whichever keypair runs the deploy/multisig
  scripts; retains no treasury authority after deployment.

Accounting invariant, enforced in code (`src/lib/salv/vault.ts`), not
just documented: `treasury_allocated_to_rewards + treasury_distributed +
treasury_burned ≤ 300,000,000` at all times. `treasury_remaining` is
derived, never a separately-settable field, so it cannot drift from the
other three.

## 2. StonkFun / Raydium LaunchLab verification (12 points, live sources only)

All of the following were checked against `docs.raydium.io` (fetched in
full) and on-chain program/config addresses reported by
`docs.bitquery.io`'s StonkFun API docs (cross-checked against a
secondary summary), not assumption or training-data memory:

1. **Current standard launch token program**: Token-2022. Both of
   StonkFun's on-chain configs mint Token-2022 — the "standard launch"
   config (`4E876qZTE9FJMrBzgVtBrSrzz2TLivB5Y5QXPjB4gZL7`) has **no**
   transfer-fee extension; the separate "reward launch" config
   (`6BwHHDg3u1854jC8PDLXvR4spTcLNaoBxLJNGC4nTESt`) mandates a 1-3%
   Token-2022 transfer fee and is therefore incompatible with SALV's "no
   transfer tax" requirement and was not used.
2. **Current total supply**: configurable per-launch in generic
   LaunchLab; StonkFun's own observed launches use 1,000,000,000.
3. **Current curve allocation**: official current range is 51-80% of
   declared supply (`docs.raydium.io/user-flows/creating-a-launchlab-token`);
   StonkFun's own whitelisted curve shape sells 793,100,000/1,000,000,000
   (79.31%).
4. **Current graduation allocation**: the remainder (StonkFun: 20.69% =
   206,900,000) plus the raised quote asset seeds a Raydium CPMM pool
   (program `CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C`, 0.25% fee
   config `CRRS5ieQmBrZjWhcj99JuGrT5tyuWDaGAXLXLFjbAtjQ`), with the
   entire LP locked to the platform for StonkFun's launches specifically
   (StonkFun chose neither a burn nor a creator LP share — it keeps the
   graduated liquidity as platform revenue).
5. **Current creator account semantics**: generic on-chain fields
   (`platform_cp_creator`, `creator_scale`, `creator_fee_rate`) exist in
   the `PlatformConfig`/curve-param structs; StonkFun sets
   `creator_fee_rate = 0` on its observed launches.
6. **Current creator fee behavior**: 0% pre-graduation under StonkFun's
   own configuration; 0% post-graduation under the current (post-
   2026-08-17) protocol-wide policy change, which moved newly-migrated
   pools' `creatorScale` into a platform-owned Fee Key position instead
   of minting a dedicated creator Fee Key (pre-upgrade Fee Keys are
   grandfathered, but that does not apply to a new launch today) —
   compounded by StonkFun's own choice (point 4) to keep 100% of
   graduated liquidity as platform revenue. **No creator revenue is
   available today via a StonkFun launch**, under either mechanism.
7. **Custom/self-built LaunchLab transactions**: technically possible
   against the public `LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj`
   program directly, but to count as *StonkFun's* branded launch (appear
   in their indexer/UI/fee routing) the transaction's curve parameters
   must match StonkFun's own whitelisted `curve_params` entry — an
   arbitrary custom curve submitted straight to the base program would
   not be a "StonkFun launch," just a LaunchLab launch.
8. **Separate ~30% community/vesting allocation**: supported generically
   by LaunchLab — an explicit `total_locked_amount`, with named
   beneficiary wallets, fixed cliff/unlock periods, and the official docs
   themselves recommend "use a multisig if recovery matters" for the
   beneficiary. **Not available through StonkFun's specific standard-
   launch whitelist**: StonkFun's own observed launches have
   `vesting_param = 0`, and the `PlatformConfig` struct documents
   `total_locked_amount = 0` as "opted out of vesting" (not a wildcard —
   the wildcard sentinel is `u64::MAX`), so StonkFun's whitelisted curve
   shape categorically disallows a reserved/vesting tranche.
9. **Current max lock/vesting rate**: no universal numeric ceiling is
   published beyond "subject to program caps" in the generic LaunchLab
   docs; for StonkFun specifically it is effectively 0%, since vesting is
   disabled for their whitelisted config (point 8).
10. **Exact platform/config IDs**: Raydium LaunchLab program
    `LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj`; StonkFun "reward
    launch" config `6BwHHDg3u1854jC8PDLXvR4spTcLNaoBxLJNGC4nTESt`
    (Token-2022, 1-3% transfer fee); StonkFun "standard launch" config
    `4E876qZTE9FJMrBzgVtBrSrzz2TLivB5Y5QXPjB4gZL7` (Token-2022, no
    transfer fee); Raydium CPMM program
    `CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C`; CPMM 0.25% fee config
    `CRRS5ieQmBrZjWhcj99JuGrT5tyuWDaGAXLXLFjbAtjQ`; Raydium CLMM program
    `CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK`; StonkFun
    launcher/fee wallet `5CEbueQnq1Ym2uSSx2xXds3jQAqT1BDnkA59RZobSPAG`.
11. **Can the treasury multisig be beneficiary of the reserved
    allocation?**: architecturally yes at the protocol level (LaunchLab's
    vesting beneficiary is just a wallet address, and the docs explicitly
    endorse a multisig there) — but unreachable via StonkFun specifically,
    since StonkFun's whitelisted config disables vesting entirely
    (point 8). This would only become reachable by launching through
    generic LaunchLab with a custom (non-StonkFun-branded) config.
12. **Creator fees with this structure**: none currently available via
    StonkFun (see point 6) — true independent of whether a vesting
    allocation is used or not.

### Structural conclusion

Raydium LaunchLab's `initialize` instruction **mints its own brand-new
mint for its own declared supply in a single transaction** — it has no
mode that accepts a pre-existing, already-split mint. This means SALV's
1,000,000,000 mint and its 300M/700M split **cannot be produced by any
real StonkFun/LaunchLab transaction** — it must be (and was) created and
split entirely by SALV's own deploy script (`deploy-devnet-mint.ts`),
independent of LaunchLab. A future actual StonkFun/Raydium listing of
the 700M market tranche would be a *separate* integration step (e.g.
seeding a CPMM/CLMM pool directly with already-minted SALV, not a
LaunchLab mint-creation call) — and per the hard rule against forcing an
unsupported split into LaunchLab instructions, **the StonkFun adapter
(`src/lib/salv/stonkfunAdapter.ts`) remains fail-closed**: it only ever
compares an observed launch config against a reviewed expected one and
rejects on any mismatch, and no code path in this repository attempts to
submit a 1B/300M/700M-shaped transaction to the live LaunchLab program.

## 3. Multisig mechanism decision

Native `@solana/spl-token` `Multisig` account — already a transitive
dependency (`@solana/spl-token` v0.4.15), zero new packages. `m = 3`,
exactly 3 signer public keys, created by `scripts/salv/create-devnet-
multisig.ts`. No private key for any member is ever read, stored, or
transmitted by this script or by the web app — only public keys.

Squads V4 (`@sqds/multisig` 2.1.4, program
`SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf`) was explicitly checked (not
assumed outdated): current on npm, actively maintained, 37+ dependents —
a legitimate option, documented as a future alternative if the project
later wants on-chain proposal state, time locks, or a hosted multisig UI.
Not adopted this phase because the native SPL Multisig satisfies every
stated Phase 6 requirement ("exactly 3-of-3," "no app-held private key,"
"build-but-never-execute from the app") with no new dependency.

## 4. Permitted treasury uses

Rewards (claims, via the reward vault), giveaways, future community
rewards, documented ecosystem/contributor incentives, and permanent
burns — all explicitly multisig-approved per movement, never app-
triggered. The 300M figure is a cap, never a promise that it will all be
distributed, and never described as permanently locked anywhere in code,
docs, or UI copy.

## 5. Burn behavior

No automatic or app-triggered burn mechanism exists. A burn must
originate as a multisig-signed, already-confirmed on-chain transaction
(built via `buildTreasuryBurnTransaction`, signed/sent entirely outside this
app), then *recorded* (never executed) via `POST /api/dev/salv/treasury/
burn`, which requires the real transaction signature. Burns permanently
reduce `remainingSalv`, are tracked in their own `burnedSalv` bucket
(never counted as `distributedSalv`), and never increase the 300M cap.
Recording is keyed by transaction signature so re-submitting the same
signature is a no-op (idempotent).

## 6. Reward accounting (preserved flow)

Unchanged: verified salvage → epoch points → immutable reward snapshot →
`CLAIMABLE` reward_claims row → one-time on-chain claim → reward vault
balance decreases. The only structural change is *where* the claim
spends from (reward vault, not a single ad hoc "vault" ATA that was
implicitly the same as the treasury) — the points algorithm, snapshot
immutability, claim idempotency (DB compare-and-swap + on-chain
deterministic claim-receipt account), and claim API shape are all
unchanged from Phase 5. The reward system still has no mint authority
anywhere in its code path and can only ever spend what is actually
present in the reward vault.

## 7. Fee-wallet / treasury separation

Confirmed by code audit (`docs/salv-architecture.md` §10): five distinct
addresses (fee wallet, treasury, reward vault, deployer/admin, market
holding), five separate ledgers/repositories, zero code paths that move
a balance between any two of them.

## 8. Unresolved limitations / OPEN items

- **No real Devnet transaction has been executed this phase.** Every
  script (`create-devnet-multisig.ts`, `deploy-devnet-mint.ts`,
  `build-fund-reward-vault-proposal.ts`) is written, type-checked, and
  lint-clean, but has not been run against a live Devnet RPC with funded
  keypairs from this environment — doing so requires real SOL and real
  member public keys that are not available in this sandbox. See
  `docs/salv-devnet-checklist.md` for the exact remaining steps.
- **StonkFun's standard-launch whitelist disallows a reserved/vesting
  tranche** (point 8 above) — if an actual StonkFun-branded launch is
  still desired, the 300M community treasury cannot be expressed as a
  LaunchLab vesting allocation; it must continue to exist purely as
  SALV's own pre-minted, multisig-held balance, entirely outside
  whatever StonkFun transaction (if any) later lists the 700M market
  tranche.
- **No creator fee revenue is available via StonkFun** under the current
  (post-2026-08-17) protocol policy combined with StonkFun's own
  platform-revenue choice — any future creator-fee-dependent design
  assumption should be revisited against live data before being relied
  upon, not assumed from this document indefinitely (verify again closer
  to any real launch).
- **Claim route's reward-vault model is a deliberate simplification**,
  not a flaw to silently accept forever: the distributor key alone can
  move anything already funded into the reward vault, instantly, no
  further multisig step per claim. This is intentional (so the existing
  "one-time on-chain claim" UX keeps working without requiring 3
  signatures per individual reward), but it does mean the *size* of each
  "fund reward vault" top-up is the real control point the treasury
  members must size carefully — documented explicitly here so it is
  never discovered as a surprise.
- Migrations 0001/0002, `scripts/salv/claim-salv.ts`,
  `scripts/salv/test-distributions.ts`, and
  `docs/salv-distribution-test-report.md` were not re-read or re-verified
  this phase (no Phase 6 requirement touched them); they are assumed
  unchanged from Phase 5 and should be spot-checked before any future
  phase that depends on them.

## 9. Tests / results

`npm run lint`, `npx tsc --noEmit`, and `npx vitest run` all pass with
zero errors (223/223 tests across 29 files as of this phase's last
commit). See `docs/salv-treasury.md` for the mapping from each of the
15 required test categories to its actual test file/case. `npm run
build` is run as part of the final gate before this phase's last commit
(see the top-level PR/commit message for its result).

## 10. Files changed this phase

See `git log` on this branch for the itemized commit history
(`d5dfacb`, `be2ac36`, `9f7c15c`, `b0e90ce`, `d72405b`, plus this
docs commit) and each commit's message for its own file list.
