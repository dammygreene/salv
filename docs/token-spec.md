# $SALV Token Specification

Authoritative spec for the $SALV token. This document is the single
source of truth for supply and allocation — if code and this document
ever disagree, this document is correct and the code has a bug.

## Identity

| Field    | Value          |
|----------|----------------|
| Name     | SALVAGE        |
| Symbol   | SALV           |
| Chain    | Solana         |
| Decimals | 9              |

Decimals chosen as 9 to match standard SPL Token convention (same as
SOL and the observed StonkFun/STONK token — see "Token program"
below) rather than an arbitrary smaller value.

## Supply

| Bucket             | Amount (SALV) | Share |
|--------------------|---------------|-------|
| Total supply       | 1,000,000,000 | 100%  |
| Market             |   700,000,000 | 70%   |
| Community rewards  |   300,000,000 | 30%   |

`market + community_rewards = total_supply` exactly. This is enforced in
code by `src/lib/salv/tokenSpec.ts`'s `assertNoHiddenAllocations()`,
which is itself exercised by a test that fails the build if anyone ever
adds a third bucket or changes a number without updating this file.

There is no:
- investor allocation
- strategic allocation
- marketing allocation
- ecosystem allocation
- advisor allocation

If a future, genuinely new allocation bucket is ever required, it must be
added to this table (reducing an existing bucket, never inflating total
supply past 1,000,000,000) and reflected in `tokenSpec.ts` in the same
change — never introduced only in a deployment script or a wallet
transfer with no corresponding entry here.

## Market allocation (700,000,000 SALV)

Intended destination: the chosen launch venue's liquidity mechanism (see
`launch.md` and the StonkFun adapter, `src/lib/salv/stonkfunAdapter.ts`).
Phase 5 does not launch on any venue — see "Launch status" below. On
Devnet, this allocation sits in a plain token account (the "market
holding account") pending a real launch decision; it is never
distributed to users directly.

## Community allocation (300,000,000 SALV)

Destination: the Community Reward Vault (see
`docs/salv-architecture.md`). Distributed over time, epoch by epoch,
driven only by verified reward snapshots (Phase 4 Part D) — never by
discretionary transfer. The vault's own balance invariant (it can never
distribute more than it holds) and the global invariant (total
distributed can never exceed 300,000,000 SALV) are enforced in code and
tested — see `src/lib/salv/vault.ts` and its test suite.

## Token program

**Decision: standard SPL Token program (`TOKEN_PROGRAM_ID`), not
Token-2022.**

Rationale (researched before this decision, not assumed):
- The project's own launch plan (`launch.md`) names StonkFun, subject to
  verifying its live configuration at launch time, as the preferred
  venue. StonkFun's own token (STONK) and the documented launch path
  through Raydium's LaunchLab both use the standard SPL Token program at
  9 decimals, not Token-2022 — confirmed via public token-explorer data
  for STONK's own mint and multiple independent write-ups of how
  LaunchLab-based launches work as of this phase.
- Token-2022 extensions this project would actually need — none. The
  product has no requirement for transfer fees, a permanent delegate,
  freeze-on-transfer, confidential transfers, or transfer hooks. Adding
  Token-2022 only to get a newer program ID, with zero extensions
  enabled, would add integration risk (more wallets/explorers/DEXs
  understand plain SPL Token natively) for no product benefit.
- Phase 5's explicit instruction is "do not add unnecessary extensions"
  and "the desired $SALV token should be simple." Plain SPL Token is the
  simpler, more broadly compatible choice that also matches the
  observed launch venue's own token.

This decision is re-checked, not re-assumed, by the StonkFun adapter
(`src/lib/salv/stonkfunAdapter.ts`) before any real launch: if a real
launch transaction is ever prepared and the observed, live StonkFun
configuration reports a different token standard requirement, the
adapter fails closed rather than silently proceeding with SPL Token.

No extensions are added: no transfer tax, no automatic fee, no permanent
delegate, no freeze mechanics beyond the one authority tracked below,
no hooks.

## Authorities (fixed-supply deployment design)

Intended production sequence (see `docs/salv-devnet-claim-checklist.md`
for the Devnet dry run of this sequence):

1. Create the mint with a deployer-controlled mint authority and
   freeze authority (both required temporarily to perform the one-time
   mint below; Solana's `createMint` always sets both at creation).
2. Mint the entire 1,000,000,000 SALV supply in a single mint
   instruction, to a deployer-controlled token account. The mint
   instruction is never called a second time.
3. Transfer 300,000,000 SALV to the Community Reward Vault's token
   account and 700,000,000 SALV to the market holding account. After
   this step, 100% of supply is accounted for and sitting in one of
   exactly two documented, publicly recorded addresses.
4. Only once every required production setup step (vault wiring,
   distributor wiring, launch venue verification) is complete and
   independently verified, set the mint authority to `null` (revoking it
   permanently, making the supply mathematically fixed forever) and set
   the freeze authority to `null` (revoking the ability to freeze any
   account).

**Step 4 is explicitly not performed on Devnet by default.** Devnet
deployments keep both authorities live (held by the deployer keypair) so
the test token can be re-minted or adjusted if the Devnet rehearsal
surfaces a bug. Every Devnet deployment manifest
(`deployments/devnet-salv-manifest.json`) records the exact authority
state — `mintAuthority` and `freezeAuthority` fields are either a real
address (authority still live) or the string `"null (revoked)"`. Nobody
should assume an authority is revoked without checking that field.

## No hidden allocations — how this is enforced, not just claimed

- `src/lib/salv/tokenSpec.ts` exports exactly two allocation constants
  (`MARKET_ALLOCATION_SALV`, `COMMUNITY_ALLOCATION_SALV`) and a test
  asserts their sum equals `TOTAL_SUPPLY_SALV` with no other constant in
  the module contributing to supply.
- The Devnet deployment script never mints more than once, and never to
  more than the two documented addresses (deployer's own distribution
  account, which momentarily holds the full supply mid-script, does not
  count as a third bucket — it is emptied into the two real buckets in
  the same script run and its balance is asserted to be zero before the
  script reports success).
- Every address that ever receives SALV from the deployment script is
  written to the deployment manifest (public record), per Phase 5
  Section 9.
