# CULLER application architecture

The app calculates and records CULLER allocations. Token deployment, custody,
minting, distribution, claims, treasury operations, and buybacks are outside
the app and are not controlled by its server.

## Authoritative flow

1. A user connects a Solana wallet and submits a scan.
2. The server verifies the scan and reads the active epoch policy.
3. The allocation is calculated from live wallet evidence and fixed epoch rules.
4. The reward ledger records one allocation per wallet and epoch.
5. CSV export, the wallet leaderboard, and share cards read from that ledger.

The ledger is authoritative for app-visible, record-only allocations. Its
wallet/epoch identity prevents duplicate submissions from counting twice.
The server does not create, sign, submit, or automatically execute token
claims or transfers.

## Public token metadata

`NEXT_PUBLIC_CULLER_MINT_ADDRESS`, `NEXT_PUBLIC_CULLER_TOKEN_SYMBOL`,
`NEXT_PUBLIC_CULLER_TOKEN_NAME`, and `NEXT_PUBLIC_CULLER_NETWORK` are display
metadata only. They do not configure a signer, vault, distributor, minting
authority, or claim executor.

`SOLANA_RPC_URL` is used only for server-side verification and reward snapshot
infrastructure. No private token-control key belongs in this application.

## User identity

Leaderboard identity is the verified Solana wallet address. X is only an
external sharing platform and the official CULLER account link; there is no X
OAuth, X identity linking, or X-based leaderboard authentication.
