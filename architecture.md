# CULLER - Technical Architecture

## High-level architecture

```text
Web App
  |
  +-- Wallet adapters
  |
  +-- Scan API
  |     +-- Solana adapter
  |     +-- EVM adapter
  |
  +-- Classification engine
  |
  +-- Action builder
  |
  +-- Reward API
  |
  +-- Watch engine
  |
  +-- Database
  |
  +-- Background workers
```

## Services

### Web
Next.js application.

Responsibilities:
- UI
- wallet connection
- read-only API calls
- transaction review
- authenticated user settings

### API
Responsibilities:
- wallet scans
- normalized asset records
- classifications
- reward ledger reads
- watchlist management
- signed transaction verification callbacks

### Indexer/worker
Responsibilities:
- ingest onchain events
- refresh asset state
- detect supported recovery paths
- verify cull events
- calculate epochs
- flag suspicious activity

## Chain abstraction
Define interfaces such as:

```ts
interface ChainAdapter {
  chainId: string;
  scanWallet(address: string): Promise<NormalizedAsset[]>;
  buildCullAction(asset: NormalizedAsset): Promise<CullAction | null>;
  verifyTransaction(tx: string): Promise<VerifiedEvent | null>;
}
```

Never make UI components depend directly on a specific RPC provider.

## Solana implementation
Primary data:
- token accounts
- SPL token balances
- NFT metadata
- compressed assets where supported
- transaction history
- known protocol interactions

Prefer indexed APIs for discovery and RPC for verification/simulation where appropriate.

## EVM implementation
Normalize:
- chain ID
- address
- token contract
- token ID for NFTs
- balance
- transfer history
- contract metadata

Action support must be allowlisted.

## Database entities
Minimum:
- users
- wallets
- chains
- assets
- asset_snapshots
- scans
- scan_items
- cull_events
- reward_ledger
- reward_epochs
- reward_snapshots
- watch_items
- protocol_integrations
- risk_flags
- audit_logs

## Idempotency
Every onchain event must have a unique identifier derived from chain + transaction + relevant instruction/log index.

Reward creation must be idempotent.

## Background jobs
- wallet refresh
- asset classification refresh
- watch evaluation
- cull verification
- reward epoch closing
- reward allocation
- notification dispatch

## Caching
Cache:
- token metadata
- collection metadata
- historical prices
- safe read-only asset details

Do not cache destructive transaction state as authoritative.

## Observability
Track:
- scan latency
- provider failures
- classification errors
- transaction verification failures
- reward calculation errors
- suspicious event volume

## Deployment
Frontend can run on Vercel.
Persistent workers should run in an environment designed for background jobs. Do not depend on a serverless request staying alive for scheduled indexing.
