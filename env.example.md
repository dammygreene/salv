# CULLER - Environment Variables

Rename the actual file to `.env.example` in the project.

## App
- NEXT_PUBLIC_SITE_URL=https://cullerlabs.xyz
  The canonical production URL, e.g. `https://cullerlabs.xyz`. Used only for
  resolving relative Open Graph/metadata URLs and public share links.
- NEXT_PUBLIC_APP_URL=
  Optional legacy fallback for metadata/share links when
  `NEXT_PUBLIC_SITE_URL` is unset.
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
- NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
  Client network used for Solana explorer links and wallet validation.

## Solana
- NEXT_PUBLIC_SOLANA_RPC_URL=
- SOLANA_RPC_URL=
- CULLER_TOKENS_PER_POINT=100
  Approved whole-token conversion rate for new fixed-allocation epochs. This
  value must also be persisted in the epoch snapshot and is not a mutable
  override after activation.
- CULLER_MIN_TOKEN_VALUE_USD=0.01
  Minimum reliable USD value used to distinguish valuable from low-value
  fungible assets. It never removes an asset from scan results.
  QuickNode's configured Solana endpoint is also queried for enhanced asset
  metadata when its asset/NFT API is enabled. If that capability is not
  available, raw RPC assets remain visible with conservative unknown-value
  classifications; metadata and prices are never fabricated.
- CULLER_MIN_VALUE_USD=0.01
  Canonical minimum estimated USD value for low-value classification.
- CULLER_MIN_LIQUIDITY_USD=
  Optional minimum liquidity threshold. It is unused while the configured
  market providers do not return reliable liquidity USD.
- CULLER_MAX_QUOTE_CANDIDATES=24
  Maximum number of positive-balance fungible assets checked with a small,
  read-only Jupiter quote probe per scan. It is intentionally bounded.
- CULLER_LOW_LIQUIDITY_PRICE_IMPACT_BPS=500
  Reserved conservative threshold for future liquidity evidence. A quote
  alone does not make a token liquid; only an explicit no-route response is
  classified as no liquidity.

Market enrichment uses the read-only `https://public.jupiterapi.com` Swap API
when available. Its `/price` endpoint is paid-only on some accounts; that
failure remains unknown and does not affect raw scanning. `/quote` is used
only as bounded route evidence. No swaps, transactions, signatures, or
private keys are used.

## NFT marketplace intelligence
- OPENSEA_API_KEY=
  Server-only OpenSea API key. CULLER uses only read-only GET requests for
  supported Solana NFT details and collection stats. If unset, NFTs remain
  visible with `NFT_UNKNOWN_VALUE`.
  OpenSea requests are deduplicated per collection, bounded, and never used
  to create listings, offers, fulfillments, signatures, or purchases.

## Robinhood Chain
- ROBINHOOD_RPC_URL=
  Server-side JSON-RPC endpoint for the optional Robinhood wallet scan.
  Production may use `https://rpc.mainnet.chain.robinhood.com`, but a
  dedicated provider URL is recommended. If unset, Robinhood scanning reports
  unavailable while Solana scanning remains usable. Do not expose this as
  `NEXT_PUBLIC_*`.
- ROBINHOOD_CHAIN_ID=4663
  The only supported Robinhood network is Robinhood Chain mainnet.
  - ROBINHOOD_INDEXER_URL=https://robinhoodchain.blockscout.com/api/v2
    Indexed token and NFT discovery endpoint. The default is the official
    public Blockscout endpoint; use a dedicated indexed provider for production
    rate limits and higher availability.
- ROBINHOOD_INDEXER_API_KEY=
    Optional server-only key for the indexed provider. Some providers require
    a key for non-empty address queries. For the official Blockscout endpoint,
    CULLER sends it as the `x-api-key` request header. Never expose this as a
    public variable.

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
- `DATABASE_URL=` **required in production**. Use a reachable PostgreSQL connection
  string for the reward ledger, reward snapshots, epochs, scan persistence,
  leaderboard, and history APIs. Never expose it through `NEXT_PUBLIC_*`.
- Local development and tests may omit `DATABASE_URL`; they use disposable
  in-memory PGlite. PGlite is never used automatically when `NODE_ENV=production`.
- If production starts without `DATABASE_URL`, the scan API fails closed with a
  server configuration error rather than returning an allocation without
  persistence.

## NFT market data
- `OPENSEA_API_KEY=` enables read-only OpenSea enrichment for supported,
  uncompressed NFTs.
- `MAGIC_EDEN_API_KEY=` is optional. CULLER uses Magic Eden's public keyless
  Solana endpoints for compressed NFT metadata, listings, and activities when
  it is unset, and uses authenticated requests when configured. Keyless
  requests are serialized and paced below the public 2 QPS limit; 429
  responses remain `UNKNOWN`. Keep the key server-side; never use
  `NEXT_PUBLIC_*`.

Asset metadata and market evidence are persisted in PostgreSQL. The default
freshness windows are 24 hours for metadata, 15 minutes for fungible market
evidence, and 30 minutes for NFT/collection market evidence. Override them
with `CULLER_TOKEN_METADATA_TTL_MS`, `CULLER_NFT_METADATA_TTL_MS`,
`CULLER_TOKEN_MARKET_TTL_MS`, `CULLER_NFT_MARKET_TTL_MS`, and
`CULLER_COLLECTION_MARKET_TTL_MS`.
`CULLER_MAX_NFT_MARKET_CANDIDATES` bounds the number of individual NFT
marketplace checks per scan (default 24). Candidates are ranked
deterministically. Every discovered asset is retained in the knowledge base;
deferred assets have `coverage_status=DEFERRED` and are not treated as
checked unknown-value or no-market evidence. Coverage states are
`CHECKED`, `DEFERRED`, `UNSUPPORTED`, and `PROVIDER_UNAVAILABLE`.
`CULLER_ENRICHMENT_TIME_BUDGET_MS` bounds synchronous enrichment work
(default 45 seconds); remaining eligible assets are persisted as deferred.

Allocation policy is snapshotted into each epoch when it is created. The
conservative default is 25 points for each eligible empty account,
FUNGIBLE_NO_LIQUIDITY, or low-value evidence according to category; 20 points
for an eligible NFT with no market; 10 points for a low-value NFT; 100 points
per asset; 300 points per category; and 1,000 points per wallet per epoch.
UNKNOWN and VALUABLE classifications always contribute zero. Create and
activate an epoch through the admin-protected `/api/dev/epochs` endpoints;
do not manufacture an epoch during a user scan.
- Magic Eden requests use the DAS asset ID directly and never create a mint or
  contract mapping for compressed NFTs.

Never commit real values.
Never place privileged credentials in `NEXT_PUBLIC_*` variables.
