# CULLER - QA Checklist

## Functional
- [ ] Wallet connection works.
- [ ] Wallet disconnection works.
- [ ] Wrong-network state is handled.
- [ ] Scan starts.
- [ ] Scan streams believable progress.
- [ ] Scan results are real.
- [ ] Unknown values remain unknown.
- [ ] Classification is deterministic.
- [ ] Unsupported assets are not actionable.
- [ ] Cull bin updates correctly.
- [ ] Review modal displays exact actions.
- [ ] Transaction simulation is shown where available.
- [ ] User confirmation is required.
- [ ] Verification is independent of frontend state.
- [ ] Duplicate verification does not duplicate reward.
- [ ] Reward points appear after valid verification.
- [ ] Watch item creation works.
- [ ] History is consistent.

## Security
- [ ] No secret or seed phrase collection.
- [ ] No privileged key in client bundle.
- [ ] Address validation exists.
- [ ] API rate limits exist.
- [ ] Admin routes protected.
- [ ] Destructive action allowlist enforced.
- [ ] Reward replay prevented.
- [ ] Suspicious event flagging works.

## UX
- [ ] Core action understood without docs.
- [ ] Mobile layout works.
- [ ] Desktop layout works.
- [ ] Keyboard navigation works.
- [ ] Focus states visible.
- [ ] Color is not the only status indicator.
- [ ] Reduced-motion mode works.
- [ ] Empty states are designed.
- [ ] Errors explain what happened and what the user can do.

## Visual
- [ ] Chrome material feels consistent.
- [ ] Typography hierarchy is clear.
- [ ] No excessive glow.
- [ ] No generic crypto gradients.
- [ ] No unnecessary animation.
- [ ] Cards align consistently.
- [ ] CTA hierarchy is obvious.

## Performance
- [ ] Lighthouse/performance reviewed.
- [ ] No huge client-only bundles.
- [ ] Images optimized.
- [ ] Fonts loaded efficiently.
- [ ] Scan requests are asynchronous.
- [ ] Heavy indexing runs off the request path.

## Final release
- [ ] Lint passes.
- [ ] Typecheck passes.
- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] Production build passes.
- [ ] Mainnet configuration reviewed.
- [ ] Contract/program addresses verified.
- [ ] Token metadata verified.
- [ ] Treasury addresses verified.
- [ ] Public docs match implementation.
