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

## Server-side verification
- SOLANA_RPC_URL=
  Optional dedicated Solana RPC endpoint used for server-side verification
  and authoritative reward snapshots. The web app never holds or distributes
  CULLER tokens.

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
