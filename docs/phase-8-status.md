# Phase 8 status — Solana-primary combined wallet submission

This phase refined Phase 7's wallet submission model. SALV is a Solana
token, so a **Solana wallet is now REQUIRED for every reward
submission**; Robinhood is **optional** and attaches to that same
submission as a linked address — never a second reward identity, never a
second allocation. "Robinhood only" is always rejected. See
`docs/salv-reward-ledger.md` for the full design and
`docs/salv-architecture.md` §16 for the module-map summary.

## 1. Product statements (verbatim, as required)

- Every SALV reward submission requires a Solana wallet.
- Robinhood is optional and can be attached to the same submission.
- Submitting both addresses performs one scan and produces one reward
  allocation.
- The Solana wallet is the primary reward identity.
- If Robinhood scanning is not yet available, the address is stored as
  an optional linked address but does not create a second reward.
- Robinhood asset scanning does not work today — this and every other
  document in this repo say so explicitly, and the API/UI never fake a
  Robinhood scan result.

## 2. What changed

- **Request/response contract.** `POST /api/salv/scan` now takes
  `{ solanaWallet: string, robinhoodWallet?: string | null }` — Phase
  7's single `{ wallet }` shape is gone entirely (no backward-compat
  shim; there were no external callers). Response:
  `{ solanaWallet, robinhoodWallet, scan: { solana, robinhood }, reward: { salvAllocated, status, epochId }, csvRecorded, scanId }`.
- **Validation.** New `validateCombinedWalletSubmission()`
  (`src/lib/walletAddress.ts`) is the single function the server route
  and both UI pages call. Solana required + must be a valid Solana
  address; Robinhood optional, but if present must be a valid EVM-style
  address; whitespace trimmed on both; oversized input (>128 chars)
  rejected; a Robinhood address with no Solana address is always
  rejected. `detectWalletAddress()` (Phase 7's single-address
  classifier) is unchanged and still tested, just no longer used by this
  flow.
- **Database.** Migration `0006_combined_reward_submission` **alters**
  (never duplicates) the existing `reward_ledger_entries` table from
  Phase 7's migration `0005` — following the repo's established pattern
  of altering earlier tables in later migrations (precedent: migrations
  `0002`, `0004`). `wallet_address` → `solana_wallet`; `network` column
  dropped entirely; new nullable `robinhood_wallet` column added; unique
  identity becomes `(solana_wallet, epoch_key)`; the `NOT_APPLICABLE`
  status value is dropped from the status enum (only ever meant "this
  row isn't Solana," which can no longer happen). Pre-existing standalone
  `network = 'evm'` rows (a shape the product no longer allows) are
  deleted by the migration — justified because this project has not
  launched and holds no real financial data yet.
- **Ledger identity & replacement policy.** One row per
  `(solana_wallet, epoch)`. Robinhood is metadata on that row, never a
  uniqueness key. On every upsert, `robinhood_wallet` is fully replaced
  by that scan's own value (including being cleared to `NULL` if the
  latest scan omits it) — the deterministic policy required so one
  Solana wallet can never have two competing Robinhood links in the same
  epoch. Implemented via `INSERT ... ON CONFLICT (solana_wallet,
  epoch_key) DO UPDATE SET robinhood_wallet = EXCLUDED.robinhood_wallet, ...`.
- **CSV schema.** New column order:
  `solana_wallet,robinhood_wallet,epoch_id,salv_allocated,scanned_at,status`
  (note `epoch_id` now precedes `salv_allocated`, unlike Phase 7).
- **UI (`/scan`, `/rewards`).** Both pages now show two fields in one
  form — "Solana wallet" (required) and "Robinhood wallet (optional)" —
  with the exact required copy "Solana wallet required for $SALV
  rewards." and "Optional. Add your Robinhood wallet to scan both.", and
  exactly one "Scan wallet" submit button. No second Scan button for
  Robinhood, no Connect Wallet button anywhere. The existing Cyber Chrome
  Y2K visual design is unchanged; only the form structure/copy/state
  changed (a `.wallet-field`/`.wallet-field-label` CSS addition stacks a
  small label above each input so the two fields are distinguishable,
  matching the app's existing small-uppercase-label visual convention).
  `/scan` additionally still runs the pre-existing, unrelated SPL
  token-account recovery scan (`app-state.tsx`'s `startScan()`,
  untouched) from the same Solana field and the same single button click
  — it was not changed to avoid touching that widely-used module's public
  contract.

## 3. What did not change

- The real Solana scan (`scanWallet()`), reward snapshots, reward claims,
  treasury accounting, buyback dry-run, StonkFun adapter, and every other
  existing admin/dev route are untouched and still pass their existing
  tests.
- The authoritative reward calculation itself (`getClaimView()`) is
  unchanged — Phase 8 only changed what identity it's looked up by
  (still the Solana wallet; Robinhood never participates).
- `src/lib/app-state.tsx` (the global on-chain recovery-scan state) was
  deliberately left unchanged — the new Robinhood field lives as
  page-local state on `/scan/page.tsx` instead, to avoid touching that
  widely-used module's public contract for a feature that is logically
  separate from the asset-recovery scan it already drives.
- No new environment variables were introduced.

## 4. Verification run this phase

- `npm run lint` — clean.
- `npx tsc --noEmit` — clean.
- `npx vitest run` — all suites pass: **299 tests across 34 files**,
  including the rewritten `rewardLedgerRepo.test.ts` (15 tests covering
  the new schema, the Robinhood replacement policy, new-epoch-creates-
  new-row, and concurrent-upsert dedup), the extended
  `walletAddress.test.ts` (27 tests, 20 new for
  `validateCombinedWalletSubmission` covering all 8 named robustness
  scenarios plus edge cases), and a new `combinedWalletFormUI.test.ts`
  (20 static-structure checks across `/scan` and `/rewards`: no Connect
  Wallet language, both inputs present, Solana marked required, Robinhood
  marked optional, exactly one submit button, the exact required copy
  present, and exactly one `/api/salv/scan` fetch call per submit).
- `npm run build` — succeeds; `/api/salv/scan` and
  `/api/dev/salv/rewards/export` both appear as server-rendered routes.
- Manual smoke test against a locally running dev server (embedded
  PGlite database), scenarios A-F:
  - **A. Solana only** → 200, one row created, `robinhoodWallet: null`.
  - **B. Solana + Robinhood** → 200, one row, `robinhoodWallet` recorded,
    `scan.robinhood.state: "NOT_IMPLEMENTED"`.
  - **C. Robinhood only** → 400, rejected with "A Solana wallet address
    is required for $SALV rewards — a Robinhood address alone cannot be
    submitted."
  - **D. Repeated Solana+Robinhood (same epoch)** → 200, same row
    updated, ledger export still shows exactly one row for that Solana
    wallet.
  - **E. Same Solana, changed Robinhood (same epoch)** → 200, the row's
    `robinhood_wallet` replaced (old value gone), still exactly one row.
  - **F. New epoch, same Solana+Robinhood** → 200, a **second**,
    separate row appears (dedup-by-epoch confirmed); export now shows
    exactly 2 rows total, one per epoch, each with the correct
    `robinhood_wallet` value for that scan.
  - Confirmed via `GET /api/dev/salv/rewards/export` throughout: never
    more than one row per `(solanaWallet, epoch)`, correct new CSV
    column order, no secret-shaped fields.
  - `/scan` and `/rewards` both returned 200 and rendered the required
    copy ("Solana wallet required for $SALV rewards.", "Optional. Add
    your Robinhood wallet to scan both.") with no "Connect Wallet" text
    anywhere in the HTML.

## 5. OPEN / UNTESTED

- **Live Solana RPC scanning is still untestable from this sandbox** (no
  outbound network access to a real Solana RPC endpoint) — unchanged
  from every prior phase; the scan step fails honestly
  (`scan.solana.succeeded: false`, reason reported) and never blocks or
  fakes the reward computation, which is independent of it.
- **Robinhood/EVM asset scanning remains entirely unimplemented** — by
  design this phase, not a gap. `scan.robinhood.state` is always
  `NOT_IMPLEMENTED` or `NOT_LINKED`; no balance or asset list is ever
  produced for it.
- No automated browser/DOM interaction test (e.g. Playwright) was run
  against the live `/scan`/`/rewards` forms this phase — verification was
  via the static source-structure test (`combinedWalletFormUI.test.ts`)
  plus a manual `curl`-based API smoke test and an HTML-source `grep` of
  the rendered pages. A real click-through in a browser was not
  performed.
- No real Devnet transaction was sent or claimed as sent during this
  phase's manual smoke test.
