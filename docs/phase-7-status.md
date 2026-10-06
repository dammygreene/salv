# Phase 7 status — no-wallet-connect scan + reward allocation ledger

This phase removed wallet-adapter *connection* from the primary SALVAGE
user flow and replaced it with paste-address scanning, and added a
durable, admin-exportable reward allocation ledger. No mainnet activity
occurred; no new secrets were introduced. See `docs/salv-architecture.md`
§15 for the module map and `docs/salv-reward-ledger.md` for the full
ledger design, schema, and rationale.

> **Superseded by Phase 8 for the wallet submission model.** Everything
> below describes Phase 7's original "paste any Solana **or** EVM
> address" model, which has since been refined. See
> `docs/salv-reward-ledger.md` and `docs/salv-architecture.md` §16 for
> the current behavior. In short: **every SALV reward submission
> requires a Solana wallet. Robinhood is optional and can be attached to
> the same submission. Submitting both addresses performs one scan and
> produces one reward allocation. The Solana wallet is the primary reward
> identity.** Phase 7's single `{ wallet }` request shape, its
> `network`-keyed ledger identity (`wallet_address, network, epoch`), and
> its `NOT_APPLICABLE` status value have all been replaced — a standalone
> EVM/Robinhood-only submission, which Phase 7 allowed, is now always
> rejected as a validation error. If Robinhood scanning is not yet
> available (it is not), the address is stored as an optional linked
> address but does not create a second reward — Robinhood asset scanning
> does not work today and this document does not claim otherwise.

## 1. What changed

- **No more "Connect Wallet."** `/scan` (the real, read-only SPL
  token-account recovery tool — functionally unchanged) and `/rewards`
  (the new scan → allocation → record flow) both work from a pasted
  address only. The global nav's "Connect" button was removed entirely.
- **Signing moved, not removed.** Executing a real recovery transaction
  still requires a genuine wallet-extension signature — that is
  unavoidable and unchanged. That one control now lives only in
  `src/components/review-modal.tsx`, shown at the moment of signing, not
  on the primary paste/scan screen (`src/lib/app-state.tsx`'s `canSign`
  now also requires the connected extension's pubkey to match the
  address being previewed).
- **New endpoint**: `POST /api/salv/scan` — classifies a pasted address
  as Solana or EVM, runs the real existing Solana scan when applicable,
  computes the $SALV allocation from the existing authoritative
  reward-snapshot/claim system (never from the client, never from the
  live scan), and upserts one row into a new reward ledger.
- **New table**: `reward_ledger_entries` (migration `0005`), one row per
  `(wallet, network, epoch)`, update-in-place (not append-only). Backed
  by the same Postgres database every other repository already uses —
  not Vercel Blob (not configured in this project) and never the local
  filesystem.
- **New admin endpoint**: `GET /api/dev/salv/rewards/export` — downloads
  the ledger as CSV, gated by the existing `DEV_ADMIN_SECRET` /
  `assertDevAuthorized` convention used by every other `/api/dev/*`
  route.

## 2. What did not change

- The real Solana scan (`scanWallet()`), reward snapshots, reward claims,
  treasury accounting, the buyback dry-run, the StonkFun adapter, and
  every existing admin/dev route are all untouched and still pass their
  existing tests.
- Claiming (`POST /api/salv/claims/:wallet/claim`) is functionally
  identical — it never depended on a wallet-adapter connection in the
  first place (it only ever needed the address string, executed
  server-side from the distributor key). `/rewards` now states explicitly,
  next to the CLAIM button, that this executes automatically today with
  no signature, and that a future version is expected to require an
  external wallet-signing step.
- No new environment variables were introduced.

## 3. Verification run this phase

- `npm run lint` — clean.
- `npx tsc --noEmit` — clean.
- `npx vitest run` — all suites pass (263 tests across 33 files,
  including the 11 new `rewardLedgerRepo` tests, 15 new
  `walletAddress` tests, 5 new `tokenSpec` decimal-string tests, and a
  new static-source-grep test confirming no wallet-adapter UI appears in
  the primary scan/rewards flow).
- `npm run build` — succeeds; `/api/salv/scan` and
  `/api/dev/salv/rewards/export` both appear as server-rendered routes.
- Manual smoke test against a locally running dev server (embedded
  PGlite database): pasted a real Solana address → scan attempted (RPC
  unreachable from this sandbox, reported honestly as
  `scan.succeeded: false`, independent of the ledger write succeeding) →
  allocation computed (`NO_EPOCH` before any epoch existed) → ledger row
  created → rescanned the same address → same row updated, not
  duplicated → created/activated/closed a real epoch via the existing
  dev routes → rescanned → status correctly became `NO_SNAPSHOT` and a
  **second** row appeared for the new epoch (dedup-by-epoch confirmed) →
  pasted an EVM-shaped address → recorded as `NOT_APPLICABLE` with no
  live scan attempted → `GET /api/dev/salv/rewards/export` without a
  secret header returned 403; with the correct secret returned a
  correctly-formatted CSV (ISO-8601 timestamps, deterministic decimal
  amounts, exactly one row per wallet+network+epoch).

## 4. OPEN / UNTESTED (carried over, unaffected by this phase)

- **Phase 4 Part A** remains open/untested (no outbound network access
  from this sandbox to a real Solana RPC endpoint — unchanged by this
  phase; the new scan endpoint's live-RPC step fails the same way for
  the same reason, which is exactly why its result is reported as an
  independent, honest `scan.succeeded: false` signal rather than being
  allowed to block or fake the reward computation).
- No real Devnet transaction was sent or claimed as sent during this
  phase's manual smoke test.
