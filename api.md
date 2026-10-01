# SALVAGE - API Contract

Use versioned endpoints under `/api/v1`.

## Wallet

### `POST /wallet/resolve`
Input:
```json
{
  "chain": "solana",
  "address": "..."
}
```

Output:
```json
{
  "wallet": {
    "chain": "solana",
    "address": "..."
  }
}
```

## Scan

### `POST /scans`
Create a scan.

### `GET /scans/:id`
Return scan status and summary.

### `GET /scans/:id/items`
Return normalized scan results.

## Assets

### `GET /assets/:chain/:id`
Return normalized asset details.

## Salvage actions

### `POST /salvage/prepare`
Input selected asset IDs.

Output transaction payload(s) and safety summary.

### `POST /salvage/verify`
Input signed transaction ID/hash.

Server independently verifies and creates a Proof of Salvage event if valid.

## Rewards

### `GET /rewards/summary?wallet=`
Return current points and epoch information.

### `GET /rewards/history?wallet=`
Return historical rewards.

### `POST /rewards/claim`
Create a claim request if the distribution model supports user claims.

## Watch

### `GET /watch?wallet=`
Return watch items.

### `POST /watch`
Create a watch item.

### `DELETE /watch/:id`
Disable a watch item.

## Admin
Protected routes only.

- pause rewards
- review risk flags
- inspect provider health
- inspect reward epoch
- disable integrations

## API rules
- Validate all addresses.
- Validate chain IDs.
- Rate limit wallet scans.
- Do not expose provider API keys.
- Return machine-readable error codes.
- Log request IDs.
