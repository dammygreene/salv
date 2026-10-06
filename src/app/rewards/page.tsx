"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { shortAddress, useAppState } from "@/lib/app-state";
import { fetchRewardsSummary, RewardsSummary } from "@/lib/solana/executor/verify";
import { claimCuller, fetchCullerClaimView, fetchCullerVaultStatus, CullerClaimView, CullerVaultStatus } from "@/lib/solana/executor/cullerClaims";
import { COMMUNITY_ALLOCATION_CULLER, TOTAL_SUPPLY_CULLER } from "@/lib/culler/tokenSpec";
import { validateCombinedWalletSubmission } from "@/lib/walletAddress";

/** Phase 5 Section 17: a $CULLER claim's state is always one of these four
 * — never a bare "simulated" label that could be confused with a real
 * balance. NOT LIVE: no $CULLER deployment reachable at all. DEVNET: $CULLER
 * is deployed (on Devnet, never silently mainnet) but this wallet has
 * nothing claimable right now. CLAIMABLE / CLAIMED come straight from
 * the backend's immutable snapshot + claim ledger. */
type CullerBadgeStatus = "NOT LIVE" | "DEVNET" | "CLAIMABLE" | "CLAIMED";

function deriveCullerBadgeStatus(claimView: CullerClaimView | null): CullerBadgeStatus {
  if (!claimView || !claimView.configured) return "NOT LIVE";
  if (claimView.status === "CLAIMABLE") return "CLAIMABLE";
  if (claimView.status === "CLAIMED") return "CLAIMED";
  return "DEVNET"; // deployed and reachable, but NO_SNAPSHOT or FAILED for this wallet/epoch
}

const CULLER_BADGE_CLASS: Record<CullerBadgeStatus, string> = {
  "NOT LIVE": "status-keep",
  DEVNET: "status-review",
  CLAIMABLE: "status-cullable",
  CLAIMED: "status-watch",
};

/** Response shape of POST /api/culler/scan — see that route for the full
 * contract. This is the authoritative, server-computed reward-ledger
 * result for a combined Solana(+optional Robinhood) submission; it is
 * never derived from anything on the client. The Solana wallet is always
 * the sole reward identity — Robinhood, when present, is metadata on the
 * same submission, never a second allocation. */
interface ScanApiResult {
  solanaWallet: string;
  robinhoodWallet: string | null;
  scan: {
    solana: { attempted: boolean; succeeded: boolean; reason?: string };
    robinhood: { submitted: boolean; state: "NOT_IMPLEMENTED" | "NOT_LINKED" };
  };
  reward: { cullerAllocated: string; status: string; epochId: number | null };
  csvRecorded: boolean;
  recordError?: string;
  scanId: string;
}

export default function RewardsPage() {
  const { proofEvents, walletAddress, setWalletAddress, clearWallet } = useAppState();
  const [summary, setSummary] = useState<RewardsSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cullerClaim, setCullerClaim] = useState<CullerClaimView | null>(null);
  const [vaultStatus, setVaultStatus] = useState<CullerVaultStatus | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimNotice, setClaimNotice] = useState<string | null>(null);

  // The paste-address -> scan -> record flow. Entirely independent of
  // any wallet connection: this never asks for, and cannot accept, a
  // signature or private key -- it only reads the strings the user
  // pastes. Solana is required; Robinhood is optional and attaches as
  // metadata to the same submission (never a second reward account).
  const [pasteInput, setPasteInput] = useState("");
  const [robinhoodInput, setRobinhoodInput] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanApiResult | null>(null);

  const refreshCullerClaim = useCallback((wallet: string) => {
    fetchCullerClaimView(wallet)
      .then((view) => setCullerClaim(view))
      .catch(() => setCullerClaim(null)); // $CULLER status is supplementary; never block the rest of the page on it
  }, []);

  useEffect(() => {
    // The community treasury is a public, wallet-independent figure (it
    // is the same for every visitor), so it loads once on mount rather
    // than waiting for an address to be scanned.
    fetchCullerVaultStatus()
      .then((status) => setVaultStatus(status))
      .catch(() => setVaultStatus(null)); // supplementary; never block the rest of the page on it
  }, []);

  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;
    fetchRewardsSummary(walletAddress)
      .then((data) => {
        if (!cancelled) {
          setSummary(data);
          setLoadError(null);
        }
      })
      .catch((err) => {
        // An EVM address has no points/simulation history (that system
        // is Solana-only) -- this just leaves the simulated-points
        // widgets at "—" rather than surfacing a scary error for an
        // expected case.
        if (!cancelled) setLoadError(err instanceof Error ? err.message : null);
      });
    refreshCullerClaim(walletAddress);
    return () => {
      cancelled = true;
    };
    // Re-fetch whenever a new verified event lands so the dashboard
    // reflects the backend's authoritative ledger, not a local guess.
  }, [walletAddress, proofEvents.length, refreshCullerClaim]);

  // Only show stats for the currently scanned address — if it's
  // cleared, don't keep displaying a stale wallet's numbers.
  const effectiveSummary = walletAddress ? summary : null;
  const epoch = effectiveSummary?.currentEpoch ?? null;
  const effectiveCullerClaim = walletAddress ? cullerClaim : null;
  const cullerBadgeStatus = deriveCullerBadgeStatus(effectiveCullerClaim);

  async function handleScanSubmit(event: FormEvent) {
    event.preventDefault();
    const validated = validateCombinedWalletSubmission({ solanaWallet: pasteInput, robinhoodWallet: robinhoodInput });
    if (!validated.valid) {
      setPasteError(validated.error);
      return;
    }
    setPasteError(null);
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/culler/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated.submission),
      });
      const data = (await res.json()) as ScanApiResult & { error?: string };
      if (!res.ok) {
        setPasteError(data.error ?? "Scan failed. Try again in a moment.");
        return;
      }
      setScanResult(data);
      setWalletAddress(data.solanaWallet); // shared across pages for continuity only -- not a "connection"
    } catch {
      setPasteError("Could not reach the scan service. Try again shortly.");
    } finally {
      setScanning(false);
    }
  }

  function handleScanAnother() {
    clearWallet();
    setScanResult(null);
    setPasteInput("");
    setRobinhoodInput("");
    setPasteError(null);
  }

  async function handleClaimCuller() {
    if (!walletAddress || !effectiveCullerClaim?.epoch) return;
    setClaiming(true);
    setClaimError(null);
    setClaimNotice(null);
    try {
      const result = await claimCuller(walletAddress, effectiveCullerClaim.epoch);
      if (result.outcome === "CLAIMED") {
        setClaimNotice(`Claimed. Tx ${result.transactionSignature?.slice(0, 12)}…`);
      }
      refreshCullerClaim(walletAddress);
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : "Claim failed.");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <main className="rewards-page">
      <PageHeader
        title="Rewards need proof."
        support="Every point traces back to an independently verified onchain event. EST. $CULLER is a simulation for testing hypothetical reward-pool economics — there is no live $CULLER token yet."
      />

      {!walletAddress ? (
        <div className="empty-state">
          <h2>Paste a wallet address to check your rewards.</h2>
          <p>No wallet connection, signature, or private key required — CULLER only reads the public address(es) you paste.</p>
          <form className="wallet-form" onSubmit={handleScanSubmit}>
            <div className="wallet-field">
              <label className="wallet-field-label" htmlFor="rewards-solana-wallet">
                Solana wallet
              </label>
              <input
                id="rewards-solana-wallet"
                type="text"
                className="wallet-input code"
                placeholder="Paste a Solana wallet address"
                value={pasteInput}
                onChange={(event) => setPasteInput(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                aria-label="Solana wallet address"
                required
              />
            </div>
            <div className="wallet-field">
              <label className="wallet-field-label" htmlFor="rewards-robinhood-wallet">
                Robinhood wallet (optional)
              </label>
              <input
                id="rewards-robinhood-wallet"
                type="text"
                className="wallet-input code"
                placeholder="Optional: paste your Robinhood wallet address"
                value={robinhoodInput}
                onChange={(event) => setRobinhoodInput(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                aria-label="Robinhood wallet address (optional)"
              />
            </div>
            <button type="submit" className="primary-button" disabled={scanning || !pasteInput.trim()}>
              {scanning ? "Scanning…" : "Scan wallet"}
            </button>
          </form>
          <small className="wallet-form-note">Solana wallet required for $CULLER rewards.</small>
          <small className="wallet-form-note">Optional. Add your Robinhood wallet to scan both.</small>
          {pasteError && <small className="wallet-form-error">{pasteError}</small>}
        </div>
      ) : (
        <>
          <div className="section-intro section-intro-tight">
            <span>{shortAddress(walletAddress)}</span>
            <span className="meta-rule" />
            <button type="button" className="text-link" onClick={handleScanAnother}>
              Scan a different address
            </button>
          </div>

          {scanResult && (
            <div className="reward-card" style={{ marginBottom: "1.5rem" }}>
              <span>Reward ledger record</span>
              <strong>
                {scanResult.reward.cullerAllocated} CULLER <small>{scanResult.reward.status}</small>
              </strong>
              <small>
                Solana wallet · Epoch {scanResult.reward.epochId ?? "none"}
                {scanResult.scan.solana.attempted
                  ? scanResult.scan.solana.succeeded
                    ? " · live scan OK"
                    : ` · live scan failed (${scanResult.scan.solana.reason ?? "unknown"})`
                  : ""}
              </small>
              {scanResult.robinhoodWallet ? (
                <small>Robinhood linked · asset scanning not yet available ({scanResult.scan.robinhood.state})</small>
              ) : (
                <small>No Robinhood wallet linked for this scan.</small>
              )}
              {scanResult.csvRecorded ? (
                <small>✓ Wallet recorded for rewards.</small>
              ) : (
                <small className="wallet-form-error">
                  Scan succeeded, but this result was NOT recorded in the reward ledger ({scanResult.recordError ?? "unknown error"}
                  ). Try scanning again.
                </small>
              )}
            </div>
          )}

          <div className="rewards-grid">
            <div className="reward-card">
              <span>Points</span>
              <strong>{(effectiveSummary?.points ?? 0).toLocaleString()}</strong>
            </div>
            <div className="reward-card">
              <span>Assets culld</span>
              <strong>{(effectiveSummary?.assetsCulld ?? 0).toLocaleString()}</strong>
            </div>
            <div className="reward-card">
              <span>SOL recovered</span>
              <strong>{(effectiveSummary?.actualRecovery ?? 0).toFixed(4)}</strong>
            </div>
            <div className="reward-card">
              <span>Current epoch</span>
              <strong>
                {epoch ? `#${epoch.number}` : "—"} <small>{epoch ? epoch.status.toLowerCase() : "none active"}</small>
              </strong>
            </div>
            <div className="reward-card">
              <span>Your points (this epoch)</span>
              <strong>{epoch ? (effectiveSummary?.epochPoints ?? 0).toLocaleString() : "—"}</strong>
            </div>
            <div className="reward-card">
              <span>Total network points</span>
              <strong>{epoch ? (effectiveSummary?.networkPoints ?? 0).toLocaleString() : "—"}</strong>
            </div>
            <div className="reward-card">
              <span>Community reward pool</span>
              <strong>{epoch ? (effectiveSummary?.rewardPool ?? 0).toLocaleString() : "—"} <small>simulated</small></strong>
            </div>
            <div className="reward-card">
              <span>$CULLER reward</span>
              <strong>
                {cullerBadgeStatus === "CLAIMABLE" || cullerBadgeStatus === "CLAIMED"
                  ? effectiveCullerClaim!.amountCuller.toLocaleString(undefined, { maximumFractionDigits: 2 })
                  : epoch
                    ? `~${effectiveSummary!.estimatedReward.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                    : "—"}
              </strong>
              <span className={`status-badge ${CULLER_BADGE_CLASS[cullerBadgeStatus]}`}>
                <i />
                {cullerBadgeStatus}
              </span>
              {cullerBadgeStatus === "CLAIMABLE" && (
                <>
                  <button type="button" className="cull-bin-cta" onClick={handleClaimCuller} disabled={claiming}>
                    {claiming ? "CLAIMING…" : "CLAIM CULLER"}
                  </button>
                  <small>
                    Record-only today: claiming executes automatically server-side, with no signature required. A future
                    version will require you to sign this step with an external wallet before it executes.
                  </small>
                </>
              )}
              {cullerBadgeStatus === "CLAIMED" && effectiveCullerClaim?.claim?.claimTransactionSignature && (
                <small>tx {effectiveCullerClaim.claim.claimTransactionSignature.slice(0, 12)}…</small>
              )}
              {(cullerBadgeStatus === "NOT LIVE" || cullerBadgeStatus === "DEVNET") && epoch && <small>SIMULATED · not $CULLER</small>}
              {claimNotice && <small>{claimNotice}</small>}
              {claimError && <small className="wallet-form-error">{claimError}</small>}
            </div>
          </div>
        </>
      )}

      {walletAddress && !epoch && (
        <p className="rewards-epoch-note">
          No epoch is currently active, so there is nothing to simulate a reward share against yet.
        </p>
      )}

      {loadError && <p className="wallet-form-error">{loadError}</p>}

      <div className="section-intro section-intro-tight">
        <h2>Community treasury.</h2>
        <p>
          Community treasury: up to {(COMMUNITY_ALLOCATION_CULLER / 1_000_000).toLocaleString()}M CULLER. Controlled by a
          3-of-3 team multisig — every rewards payout, giveaway, future incentive, or burn requires all three
          members to sign. Not permanently locked: it is a team-controlled pool for documented community uses,
          capped at {(COMMUNITY_ALLOCATION_CULLER / 1_000_000).toLocaleString()}M and never exceeded.
        </p>
      </div>

      {vaultStatus && (
        <div className="rewards-grid">
          <div className="reward-card">
            <span>Current $CULLER supply</span>
            <strong>{TOTAL_SUPPLY_CULLER.toLocaleString()}</strong>
            <span className={`status-badge ${vaultStatus.configured ? "status-review" : "status-keep"}`}>
              <i />
              {vaultStatus.configured ? (vaultStatus.network ?? "DEPLOYED") : "NOT LIVE"}
            </span>
          </div>
          <div className="reward-card">
            <span>Community treasury cap</span>
            <strong>{vaultStatus.allocationCuller.toLocaleString()}</strong>
            <small>hard cap · never exceeded</small>
          </div>
          <div className="reward-card">
            <span>Rewards allocated</span>
            <strong>{vaultStatus.allocatedToRewardsCuller.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
            <small>claimable, not yet sent</small>
          </div>
          <div className="reward-card">
            <span>Rewards claimed</span>
            <strong>{vaultStatus.distributedCuller.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
            <small>sent on-chain</small>
          </div>
          <div className="reward-card">
            <span>Burned</span>
            <strong>{vaultStatus.burnedCuller.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
            <small>permanent · multisig-approved</small>
          </div>
          <div className="reward-card">
            <span>Treasury remaining</span>
            <strong>{vaultStatus.remainingCuller.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
            <small>of the 300M cap</small>
          </div>
        </div>
      )}

      <div className="section-intro section-intro-tight">
        <h2>Your verified events.</h2>
      </div>

      {proofEvents.length === 0 ? (
        <div className="empty-state">
          <h2>No verified events yet.</h2>
          <p>Complete a cull to generate your first Proof of Cull receipt.</p>
        </div>
      ) : (
        <div className="proof-list">
          {proofEvents.map((event) => (
            <article key={event.id} className="proof-receipt">
              <div className="proof-receipt-top">
                <span>{event.label}</span>
                <span className="status-badge status-cullable">
                  <i />
                  {event.status}
                </span>
              </div>
              <div className="proof-flow">
                <span>Cull</span>
                <b>→</b>
                <span>Verify</span>
                <b>→</b>
                <span>Reward</span>
              </div>
              <p className="proof-receipt-assets">{event.assets.join(", ")}</p>
              <div className="proof-confirm">
                <strong>Recovered {event.recovered}</strong>
                <b>+{event.reward} pts</b>
              </div>
              <div className="proof-fields">
                <span>
                  Chain <b>{event.chain}</b>
                </span>
                <span>
                  Time <b>{event.timestamp}</b>
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
