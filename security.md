# CULLER - Security and Abuse Prevention

## Threat model
Assume attackers will try to:
- mint fake garbage assets
- mass distribute junk to many wallets
- transfer the same asset through multiple wallets
- replay transactions
- spoof reward claims
- exploit provider inconsistencies
- trick users into destroying valuable assets
- abuse price feeds
- exploit reward epoch boundaries
- manipulate social or metadata signals

## Non-negotiable rules
1. Never ask for seed phrases or private keys.
2. Never auto-sign destructive transactions.
3. Never auto-cull ambiguous assets.
4. Never credit rewards solely from frontend state.
5. Never rely on token price alone to decide an asset is dead.
6. Never trust user-submitted transaction IDs without independent verification.

## Transaction safety
Before signing:
- show exact chain/program
- show exact asset identifiers
- show amount
- show expected account closures/recoveries
- show irreversible actions
- simulate where supported

## Allowlist model
Only support known safe program interactions.

A supported action must specify:
- program/contract address
- instruction type
- expected account changes
- expected token/NFT changes
- verification rule

## Reward verification
A cull event is valid only after server/indexer verification.

Required fields:
- chain
- tx hash/signature
- wallet
- asset
- action type
- instruction/log position if applicable
- confirmation state

## Anti-sybil
Use conservative signals.

Potential signals:
- wallet age
- funding relationships
- creation timing
- repeated asset distribution patterns
- transaction similarity
- many wallets controlled by common source

Do not permanently ban solely from one heuristic.

## Admin controls
Admin can:
- pause reward claims
- pause specific asset classes
- disable specific integrations
- flag events
- re-run verification
- quarantine suspicious rewards

Every privileged action must be logged.

## Incident handling
Maintain a runbook for:
- incorrect classifications
- unsafe integration
- provider compromise
- reward exploit
- treasury issue
- suspected phishing

Public status messaging should be factual and specific.
