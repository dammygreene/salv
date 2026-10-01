# SALVAGE - Token Economics

## Token
Symbol: `$SALV`
Chain: Solana
Target total supply: 1,000,000,000

## Allocation
- 700,000,000 `$SALV` - market allocation
- 300,000,000 `$SALV` - community Salvage Rewards

No separate investor, strategic, advisor, marketing, or ecosystem allocations.

## Community rewards
The 300M community allocation is a finite pool.

Rewards are emitted through fixed epochs.

Each epoch has a fixed reward budget.

Users earn internal `Salvage Score` from validated events.

Example calculation:
`user reward = epoch pool x user valid score / network valid score`

The exact emission schedule is configurable and should be modeled against expected usage before launch.

## What earns points
The public explanation should remain simple:

`VALID SALVAGE -> SALVAGE SCORE -> $SALV`

Internally, points can account for:
- asset legitimacy
- age
- historical activity
- verified recovery value
- action type
- anti-abuse confidence

Do not reveal fraud thresholds or internal heuristics publicly.

## Anti-farm rules
- one asset has limited lifetime reward credit
- recently created spam assets earn zero or minimal score
- duplicate transactions are ignored
- linked wallet farming can be flagged
- suspicious events can enter review
- per-wallet caps are configurable
- per-epoch caps are configurable

## Treasury
Trading/creator fees earned by SALVAGE should flow to a transparent treasury controlled by the project.

The intended use is to fund product operations and a published `$SALV` market-purchase policy.

Do not advertise guaranteed appreciation or a guaranteed price floor.

## Buyback policy
Initial policy should be simple and public.

Example framework:
- claim eligible launch/trading fees
- keep an operational reserve
- allocate a defined share to open-market `$SALV` purchases
- record each buy in a public treasury ledger

Exact percentage and automation method are TBD until launchvenue documentation, custody model, and legal review are confirmed.

## User recovery value
Recovered SOL or other assets belong to the user unless the specific recovery mechanism explicitly requires another distribution.

Do not mix recovered asset value with reward token value.

The UX should show:
`RECOVERED` and `REWARD` as two separate figures.

## Reward token claim
Avoid unnecessary friction.

Where feasible, reward distribution should be batched or handled by a program/controlled distribution wallet with strong replay protection.

## Token page copy
Use:
`1B TOTAL SUPPLY`
`70% MARKET`
`30% SALVAGE REWARDS`

Keep the public model one-screen simple.
