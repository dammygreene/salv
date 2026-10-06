# $CULLER Token Specification

Authoritative spec for the $CULLER token. This document is the single
source of truth for supply and allocation — if code and this document
ever disagree, this document is correct and the code has a bug.

## Identity

| Field    | Value          |
|----------|----------------|
| Name     | CULLER        |
| Symbol   | CULLER           |
| Chain    | Solana         |
| Decimals | 9              |

Decimals chosen as 9 to match SOL and the most common SPL
Token/Token-2022 convention. (Phase 6 correction: StonkFun's own
*observed example LaunchLab launches* commonly use 6 decimals, not 9 —
see `docs/phase-6-status.md`. This does not change $CULLER's own
decimals, because — see "Token program" below — $CULLER's 1B/300M/700M
split is not implemented via an actual StonkFun/LaunchLab mint
transaction in this phase; $CULLER's own independently-created mint is
free to use 9 decimals, and changing it now would be a wide, high-risk
change across already-tested code with no real benefit.)

## Supply

| Bucket             | Amount (CULLER) | Share |
|--------------------|---------------|-------|
| Total supply       | 1,000,000,000 | 100%  |
| Market             |   700,000,000 | 70%   |
| Community rewards  |   300,000,000 | 30%   |

`market + community_rewards = total_supply` exactly. This is enforced in
code by `src/lib/culler/tokenSpec.ts`'s `assertNoHiddenAllocations()`,
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

## Market allocation (700,000,000 CULLER)

Intended destination: the chosen launch venue's liquidity mechanism (see
`launch.md` and the StonkFun adapter, `src/lib/culler/stonkfunAdapter.ts`).
Phase 5 does not launch on any venue — see "Launch status" below. On
Devnet, this allocation sits in a plain token account (the "market
holding account") pending a real launch decision; it is never
distributed to users directly.

## Community allocation (300,000,000 CULLER)

Destination: the Community Reward Vault (see
`docs/culler-architecture.md`). Distributed over time, epoch by epoch,
driven only by verified reward snapshots (Phase 4 Part D) — never by
discretionary transfer. The vault's own balance invariant (it can never
distribute more than it holds) and the global invariant (total
distributed can never exceed 300,000,000 CULLER) are enforced in code and
tested — see `src/lib/culler/vault.ts` and its test suite.

## Token program

**Decision (Phase 6, supersedes Phase 5): SPL Token-2022 program
(`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`), with zero extensions
enabled.**

Phase 5 originally chose the legacy SPL Token program based on an
assumption that StonkFun's launch path used it. Phase 6's explicit
instruction was to re-verify this against StonkFun/Raydium LaunchLab's
**current** live documentation rather than trust that assumption, and
the current, verified answer is the opposite of Phase 5's:

- StonkFun currently operates two distinct on-chain platform configs
  against the Raydium LaunchLab program (`LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj`):
  a "standard launches" config
  (`4E876qZTE9FJMrBzgVtBrSrzz2TLivB5Y5QXPjB4gZL7`) and a "reward
  launches" config (`6BwHHDg3u1854jC8PDLXvR4spTcLNaoBxLJNGC4nTESt`).
  **Both mint Token-2022 tokens, not legacy SPL Token.** The "reward
  launches" config additionally imposes a 1%–3% transfer fee extension;
  the "standard launches" config does not. See
  `docs/phase-6-status.md` for the full citation list.
- $CULLER's own requirement is "no transfer tax" (Phase 6 spec), which
  rules out StonkFun's "reward launches" config regardless of token
  program. The "standard launches" config is Token-2022 with **no**
  transfer-fee extension enabled — functionally identical to a plain
  SPL Token mint for every operation this project performs (create,
  mint once, transfer, `transferChecked`, `burnChecked`, multisig
  authorities), just under the newer program id.
- No Token-2022 extension is enabled: no transfer fee, no permanent
  delegate, no transfer hook, no confidential transfers. `TOKEN_PROGRAM_ID_BASE58`
  in `src/lib/culler/tokenSpec.ts` pins the exact program id as a plain
  string so this module stays dependency-free.

This decision is re-checked, not re-assumed, by the StonkFun adapter
(`src/lib/culler/stonkfunAdapter.ts`) before any real launch: if a real
launch transaction is ever prepared and the observed, live StonkFun
configuration reports a different token standard requirement, the
adapter fails closed rather than silently proceeding.

**Important, separately documented limitation (Phase 6 — see
`docs/culler-treasury.md`):** regardless of token program, a real
StonkFun/LaunchLab launch transaction mints its own, brand-new
`total_supply` as part of one instruction, and StonkFun's own current
launches are observed to always whitelist a vesting lock of exactly
zero (vesting disabled) with zero creator fee. This means the
1,000,000,000 / 300M / 700M split described below is **not** expressed
through any real StonkFun/LaunchLab transaction — it happens at the
token level, before/outside of any such transaction. A real StonkFun
listing of the 700,000,000 CULLER market tranche, if pursued later, would
be a separate integration decision, not a mechanism for creating the
split itself.

## Authorities (fixed-supply deployment design)

Intended production sequence (see `docs/culler-devnet-claim-checklist.md`
for the Devnet dry run of this sequence):

1. Create the mint with a deployer-controlled mint authority and
   freeze authority (both required temporarily to perform the one-time
   mint below; Solana's `createMint` always sets both at creation).
2. Mint the entire 1,000,000,000 CULLER supply in a single mint
   instruction, to a deployer-controlled token account. The mint
   instruction is never called a second time.
3. Transfer 300,000,000 CULLER to the Community Reward Vault's token
   account and 700,000,000 CULLER to the market holding account. After
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
(`deployments/devnet-culler-manifest.json`) records the exact authority
state — `mintAuthority` and `freezeAuthority` fields are either a real
address (authority still live) or the string `"null (revoked)"`. Nobody
should assume an authority is revoked without checking that field.

## No hidden allocations — how this is enforced, not just claimed

- `src/lib/culler/tokenSpec.ts` exports exactly two allocation constants
  (`MARKET_ALLOCATION_CULLER`, `COMMUNITY_ALLOCATION_CULLER`) and a test
  asserts their sum equals `TOTAL_SUPPLY_CULLER` with no other constant in
  the module contributing to supply.
- The Devnet deployment script never mints more than once, and never to
  more than the two documented addresses (deployer's own distribution
  account, which momentarily holds the full supply mid-script, does not
  count as a third bucket — it is emptied into the two real buckets in
  the same script run and its balance is asserted to be zero before the
  script reports success).
- Every address that ever receives CULLER from the deployment script is
  written to the deployment manifest (public record), per Phase 5
  Section 9.
