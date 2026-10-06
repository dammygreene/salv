# CULLER - Agent Spec Pack

This folder is the source-of-truth build specification for CULLER.

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
CULLER is a recovery network for stranded digital assets.

Primary chain: Solana.
Native token: `$CULLER`.

Token supply:
- 70% market
- 30% community cull rewards

The product scans supported wallets for abandoned, spammy, obsolete, zero-value, or potentially recoverable assets. It helps users safely recover value or dispose of supported assets and rewards verified Proof of Cull activity with `$CULLER`.

## Important build constraint
Do not fake blockchain data, transaction verification, reward attribution, or unsupported recovery flows. When a capability is not supported yet, show an explicit unsupported state and keep the integration behind an adapter.

## Design constraint
Cyber Chrome Y2K Utility. Think futuristic 2000s consumer hardware and utility software, not generic cyberpunk or a typical Web3 dashboard.

## Runnable prototype

The vertical slice lives in `src/app` and uses Next.js (App Router), React, and TypeScript. It is structured as a real multi-page app rather than a single scrolling marketing page:

- `/` — marketing home: hero machine, how-it-works, proof-of-cull teaser, CTA into the app.
- `/scan` — connect a wallet, run the scan sequence, review classified assets, and build a cull bin.
- `/watch` — unresolved assets CULLER is keeping an eye on.
- `/rewards` — Proof of Cull receipts and epoch/score summary.
- `/history` — a timeline of scans, culls, watch adds, and reward events.
- `/token` — the one-screen `$CULLER` supply/allocation/policy page.

Session state (wallet connection, scan progress, classifications, cull bin, reward score, proof events, history) lives in a single React context (`src/lib/app-state.tsx`) so it persists as you navigate between pages, the way a real app would.

### Design system

Visual direction is **Cyber Chrome Y2K Futurism** with a touch of **Frutiger Aero**: polished chrome, translucent icy-blue acrylic, soft rounded/orbital shapes, a dark environment with layered light instead of flat black, and glossy specular highlights on primary controls. Typography is `Unbounded` (display/wordmark), `Plus Jakarta Sans` (body/UI), and `JetBrains Mono` (technical metadata only) — self-hosted via `@fontsource` so the build doesn't depend on reaching Google Fonts at runtime. Tokens, base styles, motion, layout, components, and page-specific styles are split under `src/styles/`.

Install and run it with npm:

```bash
npm install
npm run dev
```

Validation commands are `npm run lint`, `npm run typecheck`, and `npm run build`.

The prototype does not claim live wallet data or submit transactions. Solana credentials belong in `.env.local` using `.env.example`; indexed assets, transaction simulation, independent verification, and reward attribution remain behind the adapter/API work described in the other specification files.
