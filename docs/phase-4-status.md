# CULLER Phase 4 — status

Honest status of each Phase 4 part as of this commit. This file exists so
status doesn't have to be reconstructed from conversation history — keep
it updated if any part's status changes.

## Part A — Devnet E2E

**Status: OPEN / UNTESTED.**

Not executed. This requires a real browser, a real Phantom/Solflare
wallet, and outbound network access to a Solana Devnet RPC endpoint —
none of which this sandbox has. See `docs/devnet-e2e-checklist.md` for
the exact procedure and the TODO block where real results (transaction
signature, slot, recovered lamports, cull event ID, points awarded)
must be recorded once it is actually run by a developer with the right
environment.

No code anywhere mocks, fakes, or simulates a Devnet transaction result
in place of this. Parts B–G below do not depend on Part A, but the
Phase 4 Definition of Done item "a real Devnet transaction has completed
successfully" is **not met** until this checklist is run for real.

## Part B — Production DB safety

**Status: DONE.** `getDb()` (`src/lib/server/db/client.ts`) throws
`DatabaseConfigurationError` when `NODE_ENV=production` and
`DATABASE_URL` is unset, instead of silently using PGlite. Escape hatch:
`CULLER_ALLOW_PGLITE_IN_PRODUCTION=true` for an intentionally throwaway
staging deploy only. Verified both by `src/lib/server/db/client.test.ts`
and live via `npm run build && npm start` with no `DATABASE_URL` set,
which returns HTTP 500 with the exact configuration error in the server
log, and never creates a `.data/pglite` directory.

## Part C — Reward Simulator

**Status: DONE.** `src/lib/cull/rewardSimulator.ts` — pure,
deterministic, `walletPoints / totalValidPoints * rewardPool`. Handles
zero total points, zero wallet points, non-positive pool, closed/no
active epoch (callers only invoke it with a real active/closed epoch's
numbers; absent an epoch, the rewards API returns zeroes without calling
it). 11 tests in `rewardSimulator.test.ts`.

## Part D — Reward Snapshot

**Status: DONE.** Migration `0002_reward_snapshots` adds an immutable,
append-only table with a unique `(epoch_id, wallet_id)` constraint.
`src/lib/server/createRewardSnapshots.ts` refuses non-`CLOSED` epochs,
never writes a second snapshot for the same wallet/epoch, and never
transfers any token. Dev-only trigger route:
`POST /api/dev/epochs/[id]/snapshot`. 8 tests in
`createRewardSnapshots.test.ts`, including a direct DB-level duplicate
insert and a direct `UPDATE` attempt (both rejected).

## Part E — Simulation UI

**Status: DONE.** `src/app/rewards/page.tsx` (no redesign — existing page
extended) shows CURRENT EPOCH, YOUR POINTS (this epoch), TOTAL NETWORK
POINTS, COMMUNITY REWARD POOL, and a reward figure explicitly labeled
"SIMULATED · not $CULLER". `/api/rewards/[wallet]` returns `epochPoints`,
`networkPoints`, and `rewardPool` alongside the existing fields. Verified
live via curl against a running dev server through a full
create/activate/close/snapshot epoch lifecycle.

## Part F — Economic stress-testing

**Status: DONE.** `src/lib/cull/economicSimulation.ts` +
`scripts/economic-simulations.ts` run all 6 scenarios (low/normal/high
participation, one heavy farmer, many sybil wallets, mixed
legit+farming) across population sizes 100/1,000/10,000/100,000 with a
fixed hypothetical reward pool. Report: `docs/economic-simulation-report.md`
(regenerate with `npm run economic-simulations`). No result was tuned
toward a desired price; every figure is read directly off the
simulation. 9 tests including a 100k-wallet scale check.

## Part G — Tests

**Status: DONE, audited.** Required cases and where they live:

- Sums exactly to reward pool: `rewardSimulator.test.ts`,
  `createRewardSnapshots.test.ts`, `economicSimulation.test.ts`.
- Zero-point wallet: `rewardSimulator.test.ts`.
- Zero total points: `rewardSimulator.test.ts`,
  `createRewardSnapshots.test.ts`.
- Duplicate snapshot: `createRewardSnapshots.test.ts` (both app-level and
  a direct DB-constraint-level attempt).
- Closed epoch (and refusing a non-closed one): `createRewardSnapshots.test.ts`.
- Multiple wallets: all of the above.
- Rounding (awkward/non-dividing point ratios): `rewardSimulator.test.ts`.
- Large wallet concentration: `rewardSimulator.test.ts` (whale test),
  `createRewardSnapshots.test.ts`, `economicSimulation.test.ts`
  (`ONE_HEAVY_FARMER`).

Full-suite validation at the time of this commit:
`npm run lint` clean, `npx tsc --noEmit` clean, `npx vitest run`
83/83 passing across 11 files, `npm run build` succeeds (all 13 routes).

## Definition of Done

- "A real Devnet transaction has completed successfully" — **not yet
  met** (Part A open).
- "Production cannot silently use PGlite" — **met** (Part B).
- "A closed epoch can produce deterministic reward snapshots" — **met**
  (Part D).
- "The total allocated reward can never exceed the epoch reward pool" —
  **met and tested** (Parts C, D, F).
- "No $CULLER token has been deployed yet" — **true**, nothing in this
  phase deploys, mints, or transfers any token.
