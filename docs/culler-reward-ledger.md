# $CULLER reward allocation ledger (Phase 8: Solana-primary combined submission)

This document covers the no-wallet-connect scan flow and the durable
reward ledger it feeds. See `docs/culler-architecture.md` §15/§16 for how
this fits into the rest of the $CULLER system, and `docs/phase-6-status.md`
for the treasury/claim system this ledger reads from but never alters.

> **Phase 8 superseded Phase 7's "paste any Solana or EVM address"
> model.** The product requirement is now: **every CULLER reward
> submission requires a Solana wallet.** Robinhood is **optional** and
> attaches to that same submission as a linked address — it is never a
> second identity and never a second allocation. "Robinhood only" is
> always rejected. See §2-§4 below for the exact mechanics; this
> rewrite replaces, not supplements, Phase 7's old `network`-keyed
> model.

## 1. No-connect model

Nothing in the primary CULLER flow ever asks a user to connect a wallet
extension (Phantom, Solflare, Backpack, MetaMask, Robinhood Wallet, or
any other adapter) to preview a wallet, run a scan, or check $CULLER
standing. The entire flow is:

> **PASTE SOLANA WALLET (required) + OPTIONALLY PASTE ROBINHOOD WALLET →
> SCAN WALLET (one button) → one $CULLER allocation shown → "wallet
> recorded for rewards" confirmation.**

No private key, seed phrase, signature, or wallet-adapter popup is ever
requested at any step of that flow. This is true on both pages that use
it:
- `/scan` — the existing SPL token-account recovery tool. It is
  functionally unchanged for the Solana recovery scan itself (still a
  real, read-only, live Solana RPC scan) but its form now also carries an
  optional Robinhood field that feeds the reward ledger (§3) alongside
  the existing scan — still one form, one "Scan wallet" button.
- `/rewards` — the primary home of the new scan → allocation → ledger
  flow described below.

**Signing is a separate, later, clearly-labeled step.** Actually
executing an on-chain recovery transaction still requires a real
signature from the wallet that holds the funds — that is a genuine
cryptographic requirement this project cannot and does not try to work
around. That one unavoidable "connect a wallet extension to sign" control
is confined to `src/components/review-modal.tsx`, shown only at the
moment a transaction is actually about to be signed (after a user has
already selected specific assets to recover), never on the paste/scan
screen itself. `$CULLER` claiming today requires no signature at all (see
§7) — it is explicitly labeled as such on `/rewards`.

## 2. Solana required, Robinhood optional — the combined submission

`src/lib/walletAddress.ts`'s `validateCombinedWalletSubmission()` is the
single function both the API route and both UI pages use to validate a
submission, so none of them can ever disagree about what counts as
valid:

| Field | Required? | Shape | Validator |
|---|---|---|---|
| Solana wallet | **Always required** | base58-encoded 32-byte public key | `isValidSolanaAddress` (existing, unchanged, reused) |
| Robinhood wallet | **Optional** | `0x` + 40 hex characters (standard EVM address shape) | `isValidEvmAddress` |

**Every CULLER reward submission requires a Solana wallet.** A missing or
invalid Solana wallet is always rejected (400), regardless of whether a
Robinhood address was supplied. **Robinhood is optional and can be
attached to the same submission** — an empty/missing Robinhood field is
never an error, but a non-empty, invalid one always is. **A Robinhood
address submitted with no Solana address is always rejected** — there is
no path through `validateCombinedWalletSubmission` that can produce a
"Robinhood only" result, because the Solana check runs first and
unconditionally.

Both fields are trimmed of surrounding whitespace before validation, and
both are length-capped at `MAX_ADDRESS_INPUT_LENGTH` (128 characters) —
garbage, empty strings, seed phrases, and oversized input are all
rejected before any further processing, with an inline error — never
silently coerced into "valid."

`detectWalletAddress()` (the Phase 7 single-address classifier) still
exists and is still tested, but the combined-submission flow (`/scan`,
`/rewards`, `POST /api/culler/scan`) no longer uses it — it has no concept
of "one address is required, the other is optional," which the new flow
needs.

## 3. What a scan actually computes

`POST /api/culler/scan` is the single endpoint behind this flow. Given
`{ solanaWallet: "<required>", robinhoodWallet: "<optional, or null/empty>" }`:

1. **Validate** both fields per §2. Invalid/missing Solana, or an invalid
   non-empty Robinhood, is rejected with 400 before anything else runs.
2. **Run the real, existing Solana scan** (`scanWallet()`, unchanged
   since Phase 1-6: reads token accounts and balances live from the
   chain) against the Solana wallet. This always runs — Solana is always
   present by the time this step is reached.
3. **Robinhood/EVM asset scanning is NOT implemented.** If a Robinhood
   wallet was submitted, it is stored as a linked wallet
   (bookkeeping-only, via `ensureWallet(db, robinhoodWallet, "evm")`) and
   its scan state is reported as `NOT_IMPLEMENTED` — **never faked**.
   There is no code path anywhere in this route that invents a Robinhood
   balance, asset list, or "scan succeeded" result. If Robinhood scanning
   is ever implemented later, it plugs into this same step without
   changing the identity model in step 4-6 at all.
4. **Compute the $CULLER allocation strictly server-side, from the Solana
   wallet alone**, via the **existing, authoritative reward-snapshot/
   claim system** (`getClaimView()` in `src/lib/culler/claims.ts` — the
   same function `GET /api/culler/claims/:wallet` already uses), never
   from the live scan in step 2, never from Robinhood, and never from
   anything the client sent. There is no `amount` field anywhere in the
   request body this route accepts; a client cannot supply or influence
   the recorded allocation in any way. This resolves to the most
   recently **closed** epoch (same default as the claims route) and
   reads the Solana wallet's frozen snapshot/claim row for it.
5. **Upsert exactly one row** into the reward ledger (§4) for this
   `(solanaWallet, epoch)` — never two rows, never a row keyed on
   Robinhood.
6. **Return both addresses plus the single allocation.**

The response reports independent outcomes, deliberately kept separate
rather than collapsed into one boolean, so a partial failure is never
misreported as a full success:

```jsonc
{
  "solanaWallet": "...",
  "robinhoodWallet": "...",            // or null if none was submitted/linked
  "scan": {
    "solana": { "attempted": true, "succeeded": true },        // live RPC outcome
    "robinhood": { "submitted": true, "state": "NOT_IMPLEMENTED" } // or {submitted:false, state:"NOT_LINKED"}
  },
  "reward": {
    "cullerAllocated": "1250.000000000",  // authoritative, from the DB, deterministic decimal string
    "status": "ALLOCATED",              // see §6
    "epochId": 12                       // the epoch's human-facing NUMBER, not its internal uuid
  },
  "csvRecorded": true,                  // whether the ledger write actually succeeded
  "scanId": "a1b2c3d4-..."              // correlation id for this one scan request, not a row identity
}
```

If the ledger write fails after the allocation was successfully
computed, `csvRecorded` is `false` and a `recordError` message is
included — the response never claims a recording that did not happen,
and it never downgrades an already-successful scan/allocation into a
hard failure just because the *recording* of it failed.

**This replaces Phase 7's `{ wallet: "..." }` request shape entirely** —
there are no external callers of this route, so no backward-compat shim
was kept.

## 4. Ledger purpose, storage, and dedup rule

The ledger is a **record of allocations that have already been
computed**, for manual team review — never the authority that creates
them. The data flow is one-directional:

```
verified scan/activity -> reward calc (reward_snapshots/reward_claims, Solana-only) -> ledger record -> CSV export
```

Never the reverse: the ledger (or its CSV export) is never read back in
to invent, approve, or pay out a claim. The existing claim system
(`reward_claims`, `attemptClaim()`) remains the sole source of truth for
what is actually claimable/claimed; this ledger only mirrors a snapshot
of that truth, timestamped per scan, for team visibility.

**Storage**: a plain Postgres table, `reward_ledger_entries`, originally
created in migration `0005_reward_ledger.ts` and altered in place by
migration `0006_combined_reward_submission.ts` (never a new/duplicate
table — the repo's established pattern, per migrations `0002` and
`0004`, is to `ALTER TABLE` an earlier table in a later migration rather
than create a parallel one) — in the exact same database every other
repository in this codebase already uses.

Migration `0006` renamed `wallet_address` to `solana_wallet`, dropped the
`network` column entirely (a row's identity no longer has a network
dimension — it is simply "this Solana wallet, this epoch" now), and
added a nullable `robinhood_wallet` column. Because this project has not
launched and holds no real financial data yet, the migration deletes any
pre-existing standalone `network = 'evm'` row outright (a shape the
product no longer allows to exist at all) rather than attempting to
preserve or migrate it forward.

**The Solana wallet is the primary reward identity. Robinhood is never
the uniqueness/identity key.** One row per `(solana_wallet, epoch)`;
`robinhood_wallet` is metadata on that row, not part of its identity, and
is never itself unique or indexed as an identity column. Wallets with no
resolvable epoch yet share a fixed `NO_EPOCH` sentinel key (never a bare
SQL `NULL`, which would defeat the uniqueness constraint — see the
migration's doc comment) so they still dedup to one row instead of one
row per scan.

- **Rescanning the same Solana wallet in the same epoch (same Robinhood,
  or no Robinhood) updates the existing row** (`culler_allocated`,
  `status`, `scanned_at` all refresh) — it never creates a second row for
  the same identity.
- **The same Solana wallet in a new epoch creates a new, separate row** —
  a wallet's history across epochs is preserved, not overwritten.
- **Robinhood replacement policy (deterministic, required by the
  product spec): the latest submitted Robinhood address always replaces
  whatever was linked before for that Solana wallet + epoch.** Concretely,
  every upsert sets `robinhood_wallet` to exactly what THAT scan
  submitted: a different address replaces the old one, and submitting
  with **no** Robinhood address this time **clears** the previously
  linked one (sets it back to `NULL`). The row always reflects the most
  recently submitted state, never an additive merge of every Robinhood
  address ever seen for that Solana wallet. This is the single
  deterministic policy this ledger implements — a Solana wallet can never
  have two competing Robinhood links for the same epoch, because there is
  only ever one `robinhood_wallet` column on one row, and it always holds
  the latest submission's value.
- Implemented as a single atomic `INSERT ... ON CONFLICT (solana_wallet,
  epoch_key) DO UPDATE` (`src/lib/server/repositories/rewardLedgerRepo.ts`),
  which gives per-row locking for free: concurrent scans of two
  *different* Solana wallets never contend with each other at all, and
  concurrent scans of the *same* Solana wallet+epoch serialize safely (no
  lost update, no duplicate row) without any hand-rolled locking code.
- This table is **update-in-place**, not append-only — unlike
  `reward_snapshots`/`reward_claims`/`treasury_burns` elsewhere in this
  codebase, which must never be mutated once written. The ledger is
  explicitly "a clean allocation table," not a historical log of every
  scan that ever happened.

## 5. CSV schema and admin export

`GET /api/dev/culler/rewards/export` serializes the full ledger to CSV,
one row per `(solana_wallet, epoch)`, most-recently-scanned first:

```
solana_wallet,robinhood_wallet,epoch_id,culler_allocated,scanned_at,status
ABC...,0x1111111111111111111111111111111111aaaa,12,1250.000000000,2026-10-06T03:12:42.000Z,ALLOCATED
DEF...,,1,0.000000000,2026-10-06T03:12:55.000Z,NO_SNAPSHOT
```

- `solana_wallet` — the pasted Solana address, exactly as scanned. Always
  present; this is the row's sole identity column.
- `robinhood_wallet` — the pasted Robinhood/EVM address currently linked
  to this submission, or an **empty field** (never a placeholder string)
  when none is linked. Metadata only — never part of this row's identity.
- `culler_allocated` — a deterministic, bigint-based decimal string (9
  decimal places, matching the rest of this codebase's $CULLER precision
  rules — see `src/lib/culler/tokenSpec.ts`'s `baseUnitsToCullerDecimalString`).
  **Never** a floating-point `toFixed()`/`toLocaleString()` — token
  amounts are never represented as an imprecise JS `number` anywhere in
  this export path. Computed solely from the Solana wallet's claim view —
  **never affected by whether a Robinhood address is linked.**
- `epoch_id` — the epoch's human-facing **number** (e.g. `12`), not the
  internal database uuid; blank when no epoch could be resolved yet.
- `scanned_at` — ISO-8601 UTC timestamp of the most recent scan that
  produced this row's current values.
- `status` — see §6.

**Privacy / sensitivity**: the ledger table has no column for a private
key, seed phrase, signature, RPC URL, or admin secret — there is nothing
of that shape to ever accidentally serialize into this CSV. It contains
only already-public information (two wallet addresses and a reward
figure this codebase's own claim system already treats as the Solana
wallet's own claimable amount).

**Access control**: gated by `assertDevAuthorized`
(`x-dev-admin-secret` header matching the server's `DEV_ADMIN_SECRET`
env var) — the exact same convention as every other `/api/dev/*` route
in this codebase. Fails closed (403) if the header is missing/wrong, and
fails closed if `DEV_ADMIN_SECRET` itself is not configured on the
server at all. Never public.

## 6. Status values

| Status | Meaning |
|---|---|
| `NO_EPOCH` | No closed epoch exists yet for this environment at all. |
| `NO_SNAPSHOT` | A closed epoch exists, but this Solana wallet has no reward snapshot for it (no activity recorded, or snapshots not yet generated). |
| `ALLOCATED` | A real, computed allocation exists and has not been claimed yet. |
| `CLAIMED` | This Solana wallet's allocation for this epoch has already been claimed on-chain. |
| `FAILED` | A previous claim attempt's on-chain transaction did not confirm (not a terminal state — eligible for retry via the existing claim flow). |

Phase 7's `NOT_APPLICABLE` status is **removed** in Phase 8: it only ever
meant "this row's network isn't Solana," a case that can no longer exist
now that every row's identity is always a Solana wallet.

## 7. Robinhood: what it does and does not do today

- **Submitting both addresses performs one scan and produces one reward
  allocation** — Robinhood is never scanned for assets, never produces
  its own reward figure, and never creates a second ledger row.
- **If Robinhood scanning is not yet available, the address is stored as
  an optional linked address but does not create a second reward** — it
  is recorded (via `ensureWallet`) purely so the team can see which
  Robinhood address was associated with a given Solana submission, for
  whenever real Robinhood/EVM asset scanning is implemented.
- **Do not claim Robinhood asset scanning works — it does not.** Every
  response marks it explicitly as `NOT_IMPLEMENTED` (submitted) or
  `NOT_LINKED` (not submitted); neither the API nor the UI ever displays
  a fabricated Robinhood balance, asset list, or "scan complete" state
  for it.

## 8. Claiming — record-only today, explicitly labeled

Claiming a $CULLER allocation (`POST /api/culler/claims/:wallet/claim`) is
unchanged by Phase 7/8 and was never gated by a wallet-adapter connection
in the first place — it only ever needed the Solana address string, and
executes server-side from the distributor key (see
`docs/culler-architecture.md` §6). Removing wallet-connect from the
scan/preview flow does not weaken this in any way. `/rewards` now states
this explicitly next to the CLAIM button: claiming today executes
automatically with no signature required; a future version is expected
to require an external wallet-signing step before it executes, and that
step will be implemented the same way signing already is for recovery
transactions (§1) — never faked, never auto-connected.
