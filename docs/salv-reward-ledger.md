# $SALV reward allocation ledger (Phase 7)

This document covers the no-wallet-connect scan flow and the durable
reward ledger it feeds. See `docs/salv-architecture.md` §15 for how this
fits into the rest of the $SALV system, and `docs/phase-6-status.md` for
the treasury/claim system this ledger reads from but never alters.

## 1. No-connect model

Nothing in the primary SALVAGE flow ever asks a user to connect a wallet
extension (Phantom, Solflare, Backpack, MetaMask, Robinhood Wallet, or
any other adapter) to preview a wallet, run a scan, or check $SALV
standing. The entire flow is:

> **PASTE WALLET ADDRESS → SCAN WALLET → SALV allocation shown → "wallet
> recorded for rewards" confirmation.**

No private key, seed phrase, signature, or wallet-adapter popup is ever
requested at any step of that flow. This is true on both pages that use
it:
- `/scan` — the existing SPL token-account recovery tool. It is
  functionally unchanged (still a real, read-only, live Solana RPC scan)
  but no longer offers a wallet-adapter "Connect" button on its primary
  screen — only a paste-address input.
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
screen itself. `$SALV` claiming today requires no signature at all (see
§5) — it is explicitly labeled as such on `/rewards`.

## 2. Supported address types

`src/lib/walletAddress.ts`'s `detectWalletAddress()` is the single
function both the API route and the UI use to classify a pasted string,
so the two can never disagree about what counts as a valid address:

| Network | Shape | Validator |
|---|---|---|
| `solana` | base58-encoded 32-byte public key | `isValidSolanaAddress` (existing, unchanged, reused) |
| `evm` | `0x` + 40 hex characters | `isValidEvmAddress` (new) |

"EVM" and "Robinhood Wallet" are the same shape check here: Robinhood
Wallet (and essentially every EVM chain it or any other EVM wallet
supports — Ethereum, Polygon, Arbitrum, Base, etc.) all share this exact
address format. This module never attempts to "connect to" Robinhood or
any EVM chain — it only accepts the address string a user chooses to
paste, exactly like Solana.

Garbage, empty strings, seed phrases, and oversized input (over 128
characters) are all rejected before any further processing, with an
inline error — never silently coerced into "valid."

## 3. What a scan actually computes

`POST /api/salv/scan` is the single endpoint behind this flow. Given
`{ wallet: "<pasted string>" }`:

1. **Classify** the address (§2). Invalid input is rejected with 400
   before anything else runs.
2. **Solana only** — run the real, existing, read-only Solana RPC scan
   (`scanWallet()`, unchanged since Phase 1-6: reads token accounts and
   balances live from the chain). This step never runs for an EVM
   address, since the scan is itself a Solana-specific feature (reading
   SPL token accounts).
3. **Compute the $SALV allocation strictly server-side**, from the
   **existing, authoritative reward-snapshot/claim system**
   (`getClaimView()` in `src/lib/salv/claims.ts` — the same function
   `GET /api/salv/claims/:wallet` already uses), never from the live
   scan in step 2 and never from anything the client sent. There is no
   `amount` field anywhere in the request body this route accepts; a
   client cannot supply or influence the recorded allocation in any way.
   For a Solana address, this resolves to the most recently **closed**
   epoch (same default as the claims route) and reads that wallet's
   frozen snapshot/claim row for it. For an EVM address, this step is
   skipped entirely — the claims/snapshot/epoch system is Solana-only
   today — and the wallet is recorded with `NOT_APPLICABLE` and
   `salvAllocated: 0`.
4. **Upsert exactly one row** into the reward ledger (§4) for this
   `(wallet, network, epoch)`.

The response reports three independent outcomes, deliberately kept
separate rather than collapsed into one boolean, so a partial failure is
never misreported as a full success:

```jsonc
{
  "wallet": "...",
  "network": "solana",              // or "evm"
  "scan": { "attempted": true, "succeeded": true },      // live RPC outcome (Solana only)
  "salvAllocated": "1250.000000000", // authoritative, from the DB, deterministic decimal string
  "status": "ALLOCATED",             // see §6
  "epochId": 12,                     // the epoch's human-facing NUMBER, not its internal uuid
  "csvRecorded": true,               // whether the ledger write actually succeeded
  "scanId": "a1b2c3d4-..."           // correlation id for this one scan request, not a row identity
}
```

If the ledger write fails after the allocation was successfully
computed, `csvRecorded` is `false` and a `recordError` message is
included — the response never claims a recording that did not happen,
and it never downgrades an already-successful scan/allocation into a
hard failure just because the *recording* of it failed.

## 4. Ledger purpose, storage, and dedup rule

The ledger is a **record of allocations that have already been
computed**, for manual team review — never the authority that creates
them. The data flow is one-directional:

```
verified scan/activity -> reward calc (reward_snapshots/reward_claims) -> ledger record -> CSV export
```

Never the reverse: the ledger (or its CSV export) is never read back in
to invent, approve, or pay out a claim. The existing claim system
(`reward_claims`, `attemptClaim()`) remains the sole source of truth for
what is actually claimable/claimed; this ledger only mirrors a snapshot
of that truth, timestamped per scan, for team visibility.

**Storage**: a plain Postgres table, `reward_ledger_entries` (migration
`src/lib/server/db/migrations/0005_reward_ledger.ts`), in the exact same
database every other repository in this codebase already uses — selected
via `DATABASE_URL` in production, or the embedded PGlite engine in
dev/test (`src/lib/server/db/client.ts`, unchanged). **Why not Vercel
Blob**: this project has no Blob store configured anywhere (`grep`-ing
`.env.example`/the codebase turns up nothing) and does not need one —
introducing a second durable storage technology for one feature, when a
real Postgres database the app already depends on in production is
right there, would be unjustified new infrastructure. **Why not a file
on the Vercel filesystem**: that filesystem is ephemeral/read-only in
serverless deployments — `fs.writeFile`-ing a CSV there would silently
lose data on the next cold start or redeploy. **Why not a brand-new
database**: this project already requires one real Postgres instance in
production; adding a second just for this ledger would be an
unjustified new piece of infrastructure for what is, structurally, one
more table with the same durability and access-control needs as every
other table already in this schema. The CSV file a team member downloads
is generated **on demand** by serializing this table
(`GET /api/dev/salv/rewards/export`) — the table itself *is* the ledger;
"CSV" is only its export format.

**Dedup rule**: wallet + network + epoch is the row's identity. One row
per `(wallet_address, network, epoch)`; wallets with no resolvable epoch
yet share a fixed `NO_EPOCH` sentinel key (never a bare SQL `NULL`,
which would defeat the uniqueness constraint — see the migration's doc
comment) so they still dedup to one row instead of one row per scan.

- **Rescanning the same wallet in the same epoch updates the existing
  row** (`salv_allocated`, `status`, `scanned_at` all refresh) — it never
  creates a second row for the same identity.
- **The same wallet in a new epoch creates a new, separate row** — a
  wallet's history across epochs is preserved, not overwritten.
- Implemented as a single atomic `INSERT ... ON CONFLICT ... DO UPDATE`
  (`src/lib/server/repositories/rewardLedgerRepo.ts`), which gives
  per-row locking for free: concurrent scans of two *different* wallets
  never contend with each other at all, and concurrent scans of the
  *same* wallet+epoch serialize safely (no lost update, no duplicate
  row) without any hand-rolled locking code.
- This table is **update-in-place**, not append-only — unlike
  `reward_snapshots`/`reward_claims`/`treasury_burns` elsewhere in this
  codebase, which must never be mutated once written. The ledger is
  explicitly "a clean allocation table," not a historical log of every
  scan that ever happened.

## 5. CSV schema and admin export

`GET /api/dev/salv/rewards/export` serializes the full ledger to CSV,
one row per `(wallet, network, epoch)`, most-recently-scanned first:

```
wallet_address,network,salv_allocated,epoch_id,scanned_at,status
ABC...,solana,1250.000000000,12,2026-10-06T03:12:42.000Z,ALLOCATED
0x...,evm,0.000000000,,2026-10-06T03:12:55.000Z,NOT_APPLICABLE
```

- `wallet_address` — the pasted address, exactly as scanned.
- `network` — `solana` or `evm`.
- `salv_allocated` — a deterministic, bigint-based decimal string (9
  decimal places, matching the rest of this codebase's $SALV precision
  rules — see `src/lib/salv/tokenSpec.ts`'s `baseUnitsToSalvDecimalString`).
  **Never** a floating-point `toFixed()`/`toLocaleString()` — token
  amounts are never represented as an imprecise JS `number` anywhere in
  this export path.
- `epoch_id` — the epoch's human-facing **number** (e.g. `12`), not the
  internal database uuid; blank when no epoch could be resolved yet.
- `scanned_at` — ISO-8601 UTC timestamp of the most recent scan that
  produced this row's current values.
- `status` — see §6.

**Privacy / sensitivity**: the ledger table has no column for a private
key, seed phrase, signature, RPC URL, or admin secret — there is nothing
of that shape to ever accidentally serialize into this CSV. It contains
only already-public information (a wallet address and a reward figure
this codebase's own claim system already treats as the wallet's own
claimable amount).

**Access control**: gated by `assertDevAuthorized`
(`x-dev-admin-secret` header matching the server's `DEV_ADMIN_SECRET`
env var) — the exact same convention as every other `/api/dev/*` route
in this codebase. Fails closed (403) if the header is missing/wrong, and
fails closed if `DEV_ADMIN_SECRET` itself is not configured on the
server at all. Never public.

## 6. Status values

| Status | Meaning |
|---|---|
| `NOT_APPLICABLE` | Non-Solana (`evm`) wallet — the claims/snapshot system is Solana-only, so there is nothing to allocate. |
| `NO_EPOCH` | No closed epoch exists yet for this environment at all. |
| `NO_SNAPSHOT` | A closed epoch exists, but this wallet has no reward snapshot for it (no activity recorded, or snapshots not yet generated). |
| `ALLOCATED` | A real, computed allocation exists and has not been claimed yet. |
| `CLAIMED` | This wallet's allocation for this epoch has already been claimed on-chain. |
| `FAILED` | A previous claim attempt's on-chain transaction did not confirm (not a terminal state — eligible for retry via the existing claim flow). |

## 7. Claiming — record-only today, explicitly labeled

Claiming a $SALV allocation (`POST /api/salv/claims/:wallet/claim`) is
unchanged by Phase 7 and was never gated by a wallet-adapter connection
in the first place — it only ever needed the address string, and
executes server-side from the distributor key (see
`docs/salv-architecture.md` §6). Removing wallet-connect from the
scan/preview flow does not weaken this in any way. `/rewards` now states
this explicitly next to the CLAIM button: claiming today executes
automatically with no signature required; a future version is expected
to require an external wallet-signing step before it executes, and that
step will be implemented the same way signing already is for recovery
transactions (§1) — never faked, never auto-connected.
