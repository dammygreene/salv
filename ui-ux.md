# CULLER - UI/UX Specification

## Primary user journey
Connect wallet -> scan -> understand -> cull -> verify -> earn -> watch.

## Homepage
Sections:
1. Hero.
2. Live cull statistics.
3. How CULLER works.
4. Example cull report.
5. Proof of Cull.
6. `$CULLER` overview.
7. Supported chains.
8. Footer with docs/legal.

Do not overload the homepage with protocol jargon.

## Scan flow
State 1:
`READY`

State 2:
`SCANNING WALLET`

State 3:
`MAPPING ASSETS`

State 4:
`CHECKING RECOVERY PATHS`

State 5:
`SORTING`

State 6:
`SCAN COMPLETE`

The progress indicator should feel believable. Never fabricate specific backend checks that did not occur.

## Scan results
Top summary:
- total assets
- cullable
- review
- watch
- recoverable value
- chains detected

Primary action:
`CULLER SELECTED`

Secondary:
`VIEW ALL`

Each asset card shows:
- asset name
- mint/contract shortened
- chain
- age if known
- approximate value if reliable
- reason for classification
- action available

## Cull bin
A persistent interactive component.

Users can add assets to the bin.

The bin shows:
- count
- estimated recovered value
- reward estimate
- warnings

Before transaction signing, open a review modal with exact assets and exact actions.

## Transaction review
Must include:
- network
- wallet
- assets affected
- expected recovered amount if known
- protocol/contract/program
- fees
- warning if any asset is permanently destroyed

CTA:
`CONFIRM CULLER`

Never use a vague button like `CONTINUE` for destructive actions.

## Rewards
Show:
- current epoch
- user Cull Score
- network score
- reward pool
- estimated share
- completed events

Avoid fake live estimates when final calculation is not yet known. Label projections as `ESTIMATE`.

## Watch
Watch screen shows unresolved assets and future checks.

Each item:
- asset
- why it is being watched
- last checked
- trigger condition
- notification setting

## History
Timeline of:
- scans
- culls
- recoveries
- rewards
- watch events

## Token page
Keep it very simple:
- supply
- market allocation
- community reward allocation
- reward mechanism
- protocol fee/buyback policy
- contract address when live

Do not build a complicated tokenomics microsite.

## Errors
Use direct language.

Examples:
`WALLET NOT CONNECTED`
`THIS ASSET IS NOT SUPPORTED`
`NOT SAFE TO AUTO-CULLER`
`TRANSACTION REJECTED`
`WE COULDN'T VERIFY THAT EVENT`

Never say:
`Something went wrong. Please try again.`
without context.

## Mobile
- wallet connect always reachable
- cull bin becomes bottom sheet
- review modal becomes full-screen sheet
- cards remain touch friendly
- no hover-only interactions
