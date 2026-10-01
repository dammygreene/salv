# SALVAGE - Agent Spec Pack

This folder is the source-of-truth build specification for SALVAGE.

## Read first
1. `build-prompt.md` - master implementation brief
2. `agent-workflow.md` - how the coding agent should execute the work
3. `plan.md` - product and engineering phases

## Product
- `content.md`
- `tokenomics.md`
- `launch.md`

## Design
- `design.md`
- `ui-ux.md`

## Engineering
- `architecture.md`
- `data-model.md`
- `api.md`
- `security.md`
- `env.example.md`

## QA
- `qa.md`

## Current product definition
SALVAGE is a recovery network for stranded digital assets.

Primary chain: Solana.
Native token: `$SALV`.

Token supply:
- 70% market
- 30% community salvage rewards

The product scans supported wallets for abandoned, spammy, obsolete, zero-value, or potentially recoverable assets. It helps users safely recover value or dispose of supported assets and rewards verified Proof of Salvage activity with `$SALV`.

## Important build constraint
Do not fake blockchain data, transaction verification, reward attribution, or unsupported recovery flows. When a capability is not supported yet, show an explicit unsupported state and keep the integration behind an adapter.

## Design constraint
Cyber Chrome Y2K Utility. Think futuristic 2000s consumer hardware and utility software, not generic cyberpunk or a typical Web3 dashboard.

## Runnable prototype

The first vertical slice lives in `src/app` and uses Next.js, React, and TypeScript. It includes the responsive SALVAGE machine, wallet connection state, documented scan states, deterministic demo classifications, salvage-bin selection, and a transaction review surface.

Install and run it with npm:

```bash
npm install
npm run dev
```

Validation commands are `npm run lint`, `npm run typecheck`, and `npm run build`.

The prototype does not claim live wallet data or submit transactions. Solana credentials belong in `.env.local` using `.env.example`; indexed assets, transaction simulation, independent verification, and reward attribution remain behind the adapter/API work described in the other specification files.
