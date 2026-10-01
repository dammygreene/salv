# SALVAGE - Environment Variables

Rename the actual file to `.env.example` in the project.

## App
- NEXT_PUBLIC_APP_URL=
- NEXT_PUBLIC_ENV=development

## Solana
- NEXT_PUBLIC_SOLANA_NETWORK=devnet
- SOLANA_RPC_URL=
- HELIUS_API_KEY=

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
