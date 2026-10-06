# CULLER - Environment Variables

Rename the actual file to `.env.example` in the project.

## App
- NEXT_PUBLIC_SITE_URL=https://cullerlabs.xyz
  The canonical production URL, e.g. `https://cullerlabs.xyz`. Used only for
  resolving relative Open Graph/metadata URLs and public share links.
- NEXT_PUBLIC_CULLER_MINT_ADDRESS=
  The public CULLER mint address. Leave empty before launch; the UI then shows
  an intentional pre-launch state. A value must be a valid Solana address.
- NEXT_PUBLIC_CULLER_TOKEN_SYMBOL=CULLER
  Public token symbol used by the UI.
- NEXT_PUBLIC_CULLER_TOKEN_NAME=CULLER
  Public token name used by the UI.
- NEXT_PUBLIC_CULLER_NETWORK=mainnet-beta
  Public network used for explorer links. Use `devnet`, `testnet`, or
  `mainnet-beta`.
- NEXT_PUBLIC_APP_URL=
  Legacy fallback for metadata/share links when `NEXT_PUBLIC_SITE_URL` is unset.

- NEXT_PUBLIC_ENV=development

## Solana
- NEXT_PUBLIC_SOLANA_NETWORK=devnet
- NEXT_PUBLIC_SOLANA_RPC_URL=
- SOLANA_RPC_URL=
- HELIUS_API_KEY=

To run CULLER against Devnet (for manual testing, see
`docs/devnet-e2e-checklist.md`): set `NEXT_PUBLIC_SOLANA_NETWORK=devnet`,
and point both `NEXT_PUBLIC_SOLANA_RPC_URL` and `SOLANA_RPC_URL` at a
Devnet RPC endpoint (e.g. `https://api.devnet.solana.com`, or a provider's
Devnet endpoint). The client-side and server-side (verification) RPC
endpoints must agree, or the backend will try to verify a Devnet
signature against mainnet-beta and always fail to find it.

## Dev-only admin
- DEV_ADMIN_SECRET=
  Required to create/activate/close epochs via `/api/dev/epochs*`. Never
  set this as `NEXT_PUBLIC_*`. If unset, those endpoints refuse every
  request (fail-closed; there is no "open" fallback).

## $CULLER server configuration (Phase 5 — see docs/culler-architecture.md)
- CULLER_MINT_ADDRESS=
  Server-side mint address used by claim execution. Keep this aligned with the
  public value after launch; it is never exposed through `NEXT_PUBLIC_*`.
- CULLER_REWARD_VAULT=
  The Community Reward Vault's token account address (holds the fixed
  300,000,000 CULLER community allocation).
- CULLER_DISTRIBUTOR=
  The public address of the keypair authorized to sign claim
  transactions out of the reward vault. Must match the public key
  derived from `CULLER_DISTRIBUTOR_SECRET_KEY` below, or claims refuse to
  run (see `src/app/api/culler/claims/[wallet]/claim/route.ts`).
- CULLER_DISTRIBUTOR_SECRET_KEY=
  **Secret.** The distributor keypair's raw secret key, as a JSON array
  of 64 numbers (`solana-keygen`'s own format —
  `JSON.stringify(Array.from(keypair.secretKey))`). Never hard-code this
  anywhere in source; never commit a real value; never `NEXT_PUBLIC_*`.
  Required only to actually execute a claim — every read-only $CULLER
  status endpoint works without it.
- CULLER_FEE_WALLET=
  Optional. The public address legitimate creator/protocol fees are
  received at (Phase 5 Section 13). Strictly separate from
  `CULLER_REWARD_VAULT` — never mixed.
- CULLER_NETWORK=devnet
  Optional, defaults to `devnet`. One of `devnet` / `testnet` /
  `mainnet-beta`. This phase only ever deploys to Devnet — do not set
  this to `mainnet-beta` yet.
- SOLANA_RPC_URL=
  A real Solana RPC endpoint (same var the rest of the app already uses
  server-side for signature verification). Required for any $CULLER
  on-chain operation (deploy script, claim script, claim API route).

If any of `CULLER_MINT_ADDRESS` / `CULLER_REWARD_VAULT` / `CULLER_DISTRIBUTOR` /
`SOLANA_RPC_URL` is unset, every $CULLER endpoint reports `configured:
false` rather than crashing — this is the normal, expected state until
`scripts/culler/deploy-devnet-mint.ts` has actually been run against a real
Devnet RPC endpoint (see `docs/culler-devnet-claim-checklist.md`).

## Database
- DATABASE_URL=

## EVM
- EVM_RPC_URLS_JSON=

## Auth / session
- AUTH_SECRET=

## Notifications
- NOTIFICATION_PROVIDER_API_KEY=

## Observability
- SENTRY_DSN=

Never commit real values.
Never place privileged credentials in `NEXT_PUBLIC_*` variables.
