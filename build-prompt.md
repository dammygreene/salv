# CULLER - Master Build Prompt

## Role
You are the lead product engineer, product designer, and implementation agent for CULLER.

Build a production-quality first release of CULLER, a cross-chain digital-asset recovery product focused on identifying abandoned, spammy, obsolete, zero-value, or potentially recoverable crypto assets and helping users safely dispose of or recover them.

The native token is `$CULLER` on Solana.

The product should feel like a real consumer crypto product, not a meme landing page and not another analytics terminal.

## Core product idea
CULLER is a recovery layer for stranded onchain assets.

A user can:
1. Connect a supported wallet.
2. Scan their wallet history and current balances.
3. See assets classified as `CULLABLE`, `WATCH`, `REVIEW`, or `KEEP`.
4. Recover legitimate value where technically supported.
5. Safely dispose of eligible dead assets.
6. Earn `$CULLER` through verified Proof of Cull activity.
7. Monitor old assets for future recovery opportunities.

A second path is `DROP`: the user sends an eligible asset to a protocol-controlled cull flow. The system verifies the asset and credits rewards only after verification.

## Product principles
- Useful first, token second.
- Never label an asset permanently worthless based only on price data.
- Never auto-destroy ambiguous assets.
- Every reward must correspond to a verifiable onchain event.
- Prevent easy farming, sybil abuse, repeated transfer farming, and fake asset creation.
- Keep the public token model extremely simple.
- Make the interface memorable through interaction and industrial Y2K chrome styling, not through excessive effects.
- The experience should be fast and understandable within seconds.
- Avoid generic crypto dashboard patterns.

## Token structure
Target supply: 1,000,000,000 `$CULLER`.

- 70% market allocation.
- 30% community cull rewards.
- No investor allocation.
- No strategic allocation.
- No separate marketing allocation.
- No separate ecosystem allocation.
- No advisor allocation.

The 30% community allocation is a finite rewards pool, released over epochs.

The exact launchpad configuration and creator fee percentage must be configurable and verified against the launch venue's current official documentation at implementation time. Do not hardcode unverified fee assumptions.

The intended economic loop is:
CULLER activity -> protocol/creator fees -> treasury -> transparent open-market `$CULLER` purchases according to a published policy.

Do not implement guaranteed price support, automatic price promises, or copy that implies investment returns.

## MVP scope
Implement:
- Marketing homepage.
- Wallet connection.
- Solana wallet scan.
- Basic EVM wallet scan abstraction for future Robinhood Chain and other supported EVM networks.
- Asset inventory.
- Asset classification.
- Cull report.
- Cull action creation for supported token-account closures and supported burn flows.
- Drop flow placeholder with real verification architecture, not a fake success path.
- Proof of Cull event model.
- Reward points ledger.
- Epoch reward allocation model.
- `$CULLER` rewards dashboard.
- Cull history.
- Watchlist for unresolved or potentially recoverable assets.
- Basic public wallet report route.
- Responsive mobile and desktop UI.

Do not build in MVP:
- Full cross-chain coverage.
- Complex autonomous recovery.
- Full token marketplace.
- Governance.
- Social feed.
- Staking unless explicitly added later.
- Trading terminal.
- AI agent.
- Any feature that is only decorative.

## Chain priorities
Primary: Solana.
Secondary architecture: EVM-compatible networks including Robinhood Chain, but make the first release modular and limit actual integrations to networks that can be safely supported.

The app must represent chain support as data/config, not scattered hardcoded conditionals.

## Suggested stack
- Next.js + TypeScript.
- React.
- Tailwind CSS or a strongly typed CSS system.
- Solana wallet adapter or current recommended wallet tooling.
- QuickNode or equivalent indexed Solana data source.
- Solana RPC fallback.
- EVM provider abstraction for supported EVM chains.
- PostgreSQL.
- Prisma or Drizzle.
- Server routes/actions for privileged indexing operations.
- Vercel for web frontend.
- A persistent backend/worker environment for scheduled indexing and reward jobs.
- Redis or equivalent queue only if required.

Use environment variables for all keys and provider endpoints.

## UI direction
Style name: `Cyber Chrome Y2K Utility`.

Visual references in spirit:
- early 2000s futuristic consumer hardware
- translucent UI chrome
- brushed metal
- cold black surfaces
- icy blue light
- old sci-fi operating systems
- industrial utility software
- subtle CRT/scanline textures
- glossy buttons and beveled controls

Avoid:
- purple Web3 gradients
- generic cyberpunk
- robot illustrations
- excessive neon
- fake terminal interfaces everywhere
- unnecessary 3D coins
- giant decorative blobs
- AI-generated-looking visual clutter

The site must feel like a real machine called CULLER.

## Voice
Short, blunt, human, slightly mischievous.

Good:
- `YOUR WALLET HAS LEFTOVERS.`
- `73 ASSETS FOUND.`
- `0.184 SOL RECOVERABLE.`
- `READY TO CULLER.`
- `WE FOUND SOMETHING.`
- `WATCH THIS ONE.`

Avoid:
- corporate blockchain language
- fake hype
- `revolutionize`, `unlock`, `next generation`, `seamless`, `empower`
- long explanatory paragraphs in the UI

## Main routes
- `/`
- `/scan`
- `/wallet/[address]`
- `/cull`
- `/watch`
- `/rewards`
- `/history`
- `/token`
- `/docs`
- `/legal`

## Core components
- CullMachine
- WalletConnectButton
- ScanLauncher
- ScanProgress
- AssetGrid
- AssetCard
- AssetStatusBadge
- CullBin
- CullSummary
- RecoveryValueCard
- WatchCard
- RewardMeter
- EpochProgress
- CullHistory
- ProofOfCullCard
- TransactionReviewModal
- CrossChainTabs
- EmptyState
- ErrorState

## Scan experience
The scan should feel active but not slow.

Sequence:
1. Connect wallet.
2. Start scan.
3. Resolve wallet balances and token accounts.
4. Resolve NFTs where supported.
5. Resolve known protocol positions.
6. Classify.
7. Calculate potential recovery value.
8. Present actions.

Never invent values. If a value is unknown, show `UNKNOWN` rather than `$0`.

## Asset classification
Minimum states:
- `KEEP`: no reason to dispose.
- `WATCH`: currently inactive or uncertain, but worth monitoring.
- `REVIEW`: potentially meaningful asset requiring user review.
- `CULLABLE`: verified candidate for safe disposal or recovery.

Classification must be deterministic in MVP and explainable.

## Proof of Cull
Each eligible action produces a record with:
- wallet
- chain
- asset identifier
- action type
- transaction signature/hash
- timestamp
- classification at action time
- score awarded
- reward epoch
- anti-abuse status

The user never receives final rewards from an unverified event.

## Anti-farming requirements
Must support:
- event idempotency
- per-asset lifetime credit limits
- wallet cooldowns
- detection of recently created spam assets
- sender/recipient relationship checks where relevant
- prevention of multi-wallet transfer farming
- suspicious event flagging
- manual admin review capability
- rate limiting
- signed transaction verification

Do not expose internal fraud thresholds in the public UI.

## Reward model
Use a simple public concept:
`CULLER SCORE`.

Do not expose a complex mathematical formula to users.

Internally, score can use asset age, history, legitimacy, verified recoverable value, and disposal/recovery action type.

Rewards are distributed from a fixed epoch pool.

Example only:
- epoch reward pool is fixed
- user share = validated user score / validated network score

All reward constants must be configurable.

## Buyback policy
Implement a treasury ledger and buyback event record.

Do not execute buybacks automatically in the MVP unless the exact launch environment and treasury controls have been audited.

Build the architecture so the buyback mechanism can later be automated through a dedicated program or controlled execution service.

## Security expectations
- Never request private keys or seed phrases.
- Never expose privileged credentials client-side.
- Simulate/preview every destructive transaction before user confirmation.
- Use exact asset identifiers in transaction builders.
- Require explicit user confirmation for burns/transfers.
- Do not automatically destroy ambiguous NFTs/tokens.
- Use allowlists for supported program interactions.
- Log transaction signatures and outcomes.
- Provide rollback/incident procedures for backend state, while recognizing blockchain state itself cannot be rolled back.

## Performance expectations
- Initial page should be fast.
- Avoid blocking the homepage on chain data.
- Scan states should stream progress.
- Use skeletons rather than blank screens.
- Cache safe read-only data.
- Use background workers for heavy indexing.

## Acceptance criteria
The build is not complete until:
- A user can connect a Solana wallet.
- A real wallet scan returns real assets.
- Unsupported assets are clearly marked.
- A supported cull action creates an exact reviewable transaction.
- Rewards are only credited after verification.
- Duplicate events do not generate duplicate rewards.
- The UI works on mobile and desktop.
- There are no fake balances or fake cull confirmations.
- All tokenomics copy matches the actual configured supply/allocation.
- The app has a coherent visual system across all routes.
- Errors are understandable to non-technical users.
- Unit tests cover reward calculations and anti-double-credit logic.
- Integration tests cover at least one real supported Solana flow on testnet/devnet before mainnet release.

## Build behavior
Make sensible implementation decisions without repeatedly asking for clarification. Prefer a thin, real, testable MVP over incomplete breadth. When a capability is uncertain, isolate it behind an adapter and label it unsupported rather than faking it.

Before declaring completion, run linting, type checking, tests, production build, and a manual route-by-route review.
