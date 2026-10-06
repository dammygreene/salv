# $CULLER community treasury — accounting, multisig, and safety model

This document covers the 300,000,000 CULLER community treasury
specifically: what it is, who controls it, what it can be used for, how
its accounting is kept honest, and exactly which of the 15 required test
categories cover which guarantee. See `docs/culler-architecture.md` for
the full system map and `docs/phase-6-status.md` for the StonkFun/
LaunchLab research that shaped this design.

## What the treasury is (and isn't)

- A **3-of-3 multisig-controlled** on-chain token account holding up to
  300,000,000 CULLER — never more (the cap is a source-code constant,
  `COMMUNITY_ALLOCATION_CULLER` in `src/lib/culler/tokenSpec.ts`, not a
  database row that could be edited).
- **Not permanently locked.** It is a team-controlled pool for
  documented uses: user rewards (via the reward vault), giveaways,
  future community rewards, documented ecosystem/contributor incentives,
  and permanent burns. Every real movement requires all three multisig
  members to sign — nothing in this codebase can move treasury funds
  with fewer than 3 signatures, and nothing can move them at all without
  going through the two build-only proposal/record routes described
  below.
- **Not a single hot wallet.** There is no private key anywhere — in an
  env var, in the database, in a script output — that alone controls the
  treasury. `src/lib/culler/multisig.ts`'s `getCullerTreasuryMultisigConfig()`
  only ever reads and validates four **public** values: the multisig's
  own address and its three members' public keys.

## Who controls it: the 3-of-3 multisig

Implemented as a real on-chain SPL Token program `Multisig` account
(`@solana/spl-token`'s `createMultisig`/`Multisig` type — a base Token
Program feature, present identically under Token-2022, not a
third-party program). Created by `scripts/culler/create-devnet-multisig.ts`
with exactly 3 signer public keys and `m = 3`.

**Why not Squads?** Squads V4 (`@sqds/multisig` 2.1.4, program
`SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf`) was explicitly researched,
not assumed outdated — it is current, actively maintained (37+ npm
dependents as of this check), and a legitimate option, especially if the
project later wants on-chain proposal state, time locks, or a hosted
multisig UI for the three members to coordinate signing. It was not
adopted this phase because:
- It requires trusting an additional external program and SDK, for a
  requirement ("exactly 3-of-3," "no app-held private key," "build but
  never execute from the app") the already-installed `@solana/spl-token`
  dependency satisfies with zero new packages.
- The native `Multisig` account's signing model (a fixed set of N
  required raw signatures on a transaction naming the multisig as
  authority) maps directly onto "the app can build an unsigned
  transaction, but actually moving funds requires 3 external
  signatures" without needing any async on-chain proposal object.

This decision is reversible: nothing in `multisig.ts`,
`treasuryProposals.ts`, or the DB schema assumes the native multisig
specifically — if Squads is adopted later, only the signer/authority
construction in `treasuryProposals.ts`'s builders would need to change.

**Threshold is hard-pinned, not merely defaulted, to exactly 3-of-3.**
`getCullerTreasuryMultisigConfig()` throws `CullerTreasuryMultisigConfigError`
(fails closed) if the environment specifies any other threshold, any
duplicate member key, or a 4th/5th member variable —
`assertIsThreeOfThree(memberCount, threshold)` is the single, separately
tested function enforcing this, called from inside the config reader
so there is no way to construct a valid config object representing a
2-of-3 or 3-of-5.

## How the app can touch the treasury: build, never execute

Every function that constructs a treasury-moving transaction
(`src/lib/solana/culler/treasuryProposals.ts`: `buildFundRewardVaultTransaction`,
`buildTreasuryBurnTransaction`, `buildTreasuryTransferTransaction`) is
pure and synchronous: given public inputs (multisig address, member
public keys, destination, amount, a recent blockhash) it returns an
**unsigned** `Transaction` object. None of these functions, or anything
they call, imports a `Keypair`, reads a secret key, calls `.sign()`, or
calls `sendTransaction()`/`sendRawTransaction()` — there is no code path
in this module capable of moving a single token. Getting all 3 members
to actually sign and submitting the result to the network happens
entirely outside this application.

Two ways the app exposes this capability, both explicitly build-only:

1. **CLI**: `scripts/culler/build-fund-reward-vault-proposal.ts` loads the
   deployment manifest and the three members' *public* keys (env vars),
   fetches a live blockhash, builds the transaction, and prints it as
   base64 — never signs or sends it. Optionally records the proposal (for
   an audit trail) if `DATABASE_URL` is set.
2. **API**: `POST /api/dev/culler/treasury/proposals` (dev-gated) builds
   and records a `FUND_REWARD_VAULT`/`BURN`/`TRANSFER` proposal the same
   way. It fails closed (`409`) if `$CULLER`, the treasury address, or the
   multisig configuration is incomplete — it will never silently build a
   transaction against a guessed or partially-configured treasury.

Recorded proposals (`treasury_proposals` table,
`src/lib/server/repositories/treasuryProposalRepo.ts`) have **no
status/executed field whatsoever** — this is deliberate and tested
explicitly (`treasuryProposalRepo.test.ts`: "the record has no
status/executed field whatsoever — proposal creation can never be
confused with execution"), so there is no way for this table to ever be
misread as "this already happened."

## Burns

No automatic or app-triggered burn mechanism exists anywhere in this
codebase. A burn:
1. Is built as an unsigned transaction via `buildTreasuryBurnTransaction`
   (burns from the treasury's own token account, authority = the
   multisig, `multiSigners` = all 3 members — see
   `treasuryProposals.test.ts`: "every built instruction's authority is
   the treasury MULTISIG account, with all 3 members listed as
   multiSigners").
2. Is signed by all 3 members and submitted to the network **entirely
   outside this application** — there is no "execute burn" button or
   endpoint anywhere.
3. Is then *recorded* (never executed) via `POST /api/dev/culler/treasury/
   burn`, which requires the real, already-confirmed
   `transactionSignature` and writes one row to the append-only
   `treasury_burns` table (`recordTreasuryBurn`,
   `src/lib/server/repositories/treasuryBurnRepo.ts`).

Burns are idempotent on `transactionSignature` (recording the same burn
twice is a no-op, never double-counted — `treasuryBurnRepo.test.ts`),
require a positive amount and a non-empty documented reason, and are
tracked in their own `burnedCuller` bucket, entirely separate from
`distributedCuller` — a burn is never, anywhere in this codebase,
represented as a distributed reward. A burn reduces `remainingCuller` (the
unused part of the 300M cap) but never changes the cap itself
(`allocationCuller` is a fixed constant).

## Reward claims spend from the reward vault, not the treasury directly

The claim flow (`verified cull → epoch points → immutable reward
snapshot → CLAIMABLE reward_claims row → one-time on-chain claim →
balance decreases`) is unchanged from Phase 5. What changed is *where*
the claim transfers from: a **reward vault**, a fourth,
distributor-controlled account that starts at 0 CULLER and is only ever
topped up by a multisig-approved `buildFundRewardVaultTransaction`. The
claim route (`POST /api/culler/claims/:wallet/claim`) can execute without
3 fresh signatures per claim — by design, so the existing one-time-claim
UX keeps working — but it can only ever move tokens the multisig has
already explicitly chosen to release into that vault; it has no access
to, and no code path that references, the treasury account itself. The
real control point the three treasury members hold is *how much* and
*how often* they top up the reward vault — documented here explicitly so
it is a conscious operational decision, not a hidden assumption.

## Accounting invariant

`src/lib/culler/vault.ts`'s `getCommunityVaultStatus` computes, purely from
append-only ledgers (never a separately mutable counter):

```
treasury_allocated_to_rewards  = Σ CLAIMABLE reward_claims rows (not yet paid)
treasury_distributed           = Σ CLAIMED reward_claims rows (actually paid)
treasury_burned                 = Σ confirmed treasury_burns rows
treasury_remaining              = 300,000,000 − allocated − distributed − burned
```

and throws `CommunityVaultError` if `allocated + distributed + burned`
is ever found to exceed 300,000,000 — checked explicitly on every read,
not just assumed safe because the write paths are supposed to prevent it.

## Where each of the 15 required test categories is covered

| # | Requirement | Covered by |
|---|---|---|
| 1 | 300M hard cap | `tokenSpec.test.ts` (`assertNoHiddenAllocations`), `vault.test.ts` ("throws CommunityVaultError if distributed + allocated + burned were ever found to exceed the 300M cap") |
| 2 | Allocation can't exceed 300M | `vault.test.ts` (same test above), `claimAmount.test.ts` (per-epoch flooring never exceeds the epoch's own pool) |
| 3 | Rewards can't spend more than treasury availability | `claims.test.ts` ("the community vault's distributed total reflects only CLAIMED claims, and never exceeds the 300M allocation") |
| 4 | Claimed rewards reduce treasury exactly once | `claims.test.ts` ("createClaimsForEpochSnapshots derives the exact amount... attemptClaim pays it out exactly once"), `vault.test.ts` ("remaining decreases exactly by what is actually CLAIMED, never by what is merely claimable") |
| 5 | Duplicate claims impossible | `claims.test.ts` ("a second claim attempt returns ALREADY_CLAIMED...", "two concurrent claim attempts for the same wallet/epoch: only one succeeds"), plus the independent on-chain deterministic claim-receipt account (`claimReceipt.ts`) |
| 6 | Burns reduce treasury exactly once | `treasuryBurnRepo.test.ts` ("is idempotent on transactionSignature — recording the same burn twice is a no-op, never double-counted") |
| 7 | Burned tokens never counted as distributed | `vault.test.ts` ("a recorded burn reduces remaining and is tracked separately from distributed (never counted as a reward)") |
| 8 | 3-of-3 threshold configuration | `multisig.test.ts` ("fails closed if CULLER_TREASURY_THRESHOLD is set to anything other than 3", "fails closed if a 4th member variable is set", "does not throw for exactly 3 members / 3 threshold", "throws for 2-of-3", "throws for 3-of-5") |
| 9 | Unilateral treasury transfer rejected | `treasuryProposals.test.ts` ("every built instruction's authority is the treasury MULTISIG account, with all 3 members listed as multiSigners") — no builder anywhere constructs a single-signer treasury authority; code audit confirms no route can sign/send (§ "API safety" in `culler-architecture.md`) |
| 10 | Proposal creation ≠ execution | `treasuryProposalRepo.test.ts` ("the record has no status/executed field whatsoever") |
| 11 | Fee wallet and treasury addresses separate | `docs/culler-architecture.md` §10 code-path audit (no shared ledger/repository); `feeWalletRepo.test.ts` and `vault.test.ts`/`treasuryBurnRepo.test.ts` exercise entirely separate tables |
| 12 | Invalid treasury config fails closed | `multisig.test.ts` ("fails closed if a member public key is duplicated", "fails closed on an obviously-malformed value (e.g. a private-key-shaped array pasted in)", "rejects an unknown network value") |
| 13 | Deployment manifest correctness | `tokenDeploymentRepo.test.ts` (round-trips every manifest field including `treasuryAddress`) |
| 14 | StonkFun adapter fails closed if live config unsupported | `stonkfunAdapter.test.ts` ("fails closed on a single differing field", "fails closed if StonkFun ever starts whitelisting a non-zero vesting lock", "the real network fetcher is not implemented and throws clearly rather than returning fabricated data") |
| 15 | No private key exposed via client bundles/API responses | `noSecretExposure.test.ts` (new, Phase 6: `getCullerConfig()`'s shape contains no secret-key-shaped field; only the claim route imports `getDistributorSecretKey` and never echoes it in a JSON response; no route references a raw secret-key env var directly) |

All of the above pass as part of `npx vitest run` (223/223 tests, 29
files, as of this phase's last commit).
