# CULLER - Product and Engineering Plan

## 1. Product thesis
CULLER is a recovery network for stranded digital assets.

The first wedge is simple: scan a wallet, find things the user probably forgot or no longer wants, safely recover what can be recovered, dispose of supported dead assets, and reward verified participation with `$CULLER`.

The long-term product is not merely a wallet cleaner. It is a persistent layer that remembers dormant assets and alerts users when previously useless assets become redeemable or recoverable.

## 2. MVP objective
Prove three things:
1. People enjoy seeing hidden or forgotten assets surfaced.
2. People trust the product enough to execute legitimate cleanup/recovery transactions.
3. Proof of Cull can distribute rewards without becoming an obvious farming exploit.

## 3. Build phases

### Phase 0 - Foundation
- Repository setup.
- TypeScript strict mode.
- Environment configuration.
- Database schema.
- Auth/wallet abstraction.
- Chain adapter interfaces.
- Logging.
- Error reporting.

### Phase 1 - Visual shell
- Global design tokens.
- Landing page.
- Cull machine hero.
- Navigation.
- Wallet connection.
- Responsive shell.

### Phase 2 - Solana scan
- Token account indexing.
- NFT indexing.
- Empty account detection.
- Current balance normalization.
- Known protocol opportunity adapter interface.
- Classification engine.
- Scan persistence.

### Phase 3 - Cull actions
- Supported token burn.
- Supported token account close.
- Supported NFT burn.
- Transaction simulation.
- Review modal.
- Confirmation state.
- Onchain verification.

### Phase 4 - Rewards
- Proof of Cull events.
- Point ledger.
- Epochs.
- User reward calculation.
- Claim/distribution mechanism.
- Reward history.

### Phase 5 - Watch
- Watchlist.
- Asset snapshots.
- Protocol/redeemability watchers.
- Notification framework.

### Phase 6 - EVM expansion
- Common asset schema.
- EVM chain adapter.
- Robinhood Chain adapter.
- Wallet/network switching UX.
- Safe asset classification and action allowlists.

### Phase 7 - Production hardening
- Security review.
- Rate limiting.
- Anti-sybil tuning.
- Observability.
- Load tests.
- Mainnet configuration.
- Incident runbook.

## 4. MVP success metrics
Track:
- scan starts
- scan completion rate
- unique wallets scanned
- cull transactions completed
- recovery value returned
- valid Proof of Cull events
- suspicious event rate
- reward distribution
- repeat users
- watchlist adoption
- average time from scan to first cull

Do not optimize for raw transaction count without validating event quality.

## 5. What to postpone
- Full mobile native app.
- DAO governance.
- NFT marketplace.
- Social feed.
- Referral farming.
- staking.
- multi-chain automation.
- complex AI classification.
- advanced portfolio tracking.

## 6. Definition of done
A vertical slice is done when a real user can:
connect -> scan -> review -> cull -> verify -> see Proof of Cull -> see reward accounting.
