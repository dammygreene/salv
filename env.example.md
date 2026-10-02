# SALVAGE - Environment Variables

Rename the actual file to `.env.example` in the project.

## App
- NEXT_PUBLIC_APP_URL=
- NEXT_PUBLIC_ENV=development

## Solana
- NEXT_PUBLIC_SOLANA_NETWORK=devnet
- NEXT_PUBLIC_SOLANA_RPC_URL=
- SOLANA_RPC_URL=
- HELIUS_API_KEY=

To run SALVAGE against Devnet (for manual testing, see
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
