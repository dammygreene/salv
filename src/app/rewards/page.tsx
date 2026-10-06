"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { shortAddress, useAppState } from "@/lib/app-state";
import { fetchRewardsSummary, RewardsSummary } from "@/lib/solana/executor/verify";
import { claimSalv, fetchSalvClaimView, fetchSalvVaultStatus, SalvClaimView, SalvVaultStatus } from "@/lib/solana/executor/salvClaims";
import { COMMUNITY_ALLOCATION_SALV, TOTAL_SUPPLY_SALV } from "@/lib/salv/tokenSpec";
import { detectWalletAddress } from "@/lib/walletAddress";

/** Phase 5 Section 17: a $SALV claim's state is always one of these four
 * — never a bare "simulated" label that could be confused with a real
 * balance. NOT LIVE: no $SALV deployment reachable at all. DEVNET: $SALV
 * is deployed (on Devnet, never silently mainnet) but this wallet has
 * nothing claimable right now. CLAIMABLE / CLAIMED come straight from
 * the backend's immutable snapshot + claim ledger. */
type SalvBadgeStatus = "NOT LIVE" | "DEVNET" | "CLAIMABLE" | "CLAIMED";

function deriveSalvBadgeStatus(claimView: SalvClaimView | null): SalvBadgeStatus {
  if (!claimView || !claimView.configured) return "NOT LIVE";
  if (claimView.status === "CLAIMABLE") return "CLAIMABLE";
  if (claimView.status === "CLAIMED") return "CLAIMED";
  return "DEVNET"; // deployed and reachable, but NO_SNAPSHOT or FAILED for this wallet/epoch
}

const SALV_BADGE_CLASS: Record<SalvBadgeStatus, string> = {
  "NOT LIVE": "status-keep",
  DEVNET: "status-review",
  CLAIMABLE: "status-salvageable",
  CLAIMED: "status-watch",
};

/** Response shape of POST /api/salv/scan — see that route for the full
 * contract. This is the authoritative, server-computed reward-ledger
 * result for a pasted address; it is never derived from anything on the
 * client. */
interface ScanApiResult {
  wallet: string;
  network: "solana" | "evm";
  scan: { attempted: boolean; succeeded: boolean; reason?: string };
  salvAllocated: string;
  status: string;
  epochId: number | null;
  csvRecorded: boolean;
  recordError?: string;
  scanId: string;
}

export default function RewardsPage() {
  const { proofEvents, walletAddress, setWalletAddress, clearWallet } = useAppState();
  const [summary, setSummary] = useState<RewardsSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [salvClaim, setSalvClaim] = useState<SalvClaimView | null>(null);
  const [vaultStatus, setVaultStatus] = useState<SalvVaultStatus | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimNotice, setClaimNotice] = useState<string | null>(null);

  // The paste-address -> scan -> record flow. Entirely independent of
  // any wallet connection: this never asks for, and cannot accept, a
  // signature or private key -- it only reads the string the user pastes.
  const [pasteInput, setPasteInput] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanApiResult | null>(null);

  const refreshSalvClaim = useCallback((wallet: string) => {
    fetchSalvClaimView(wallet)
      .then((view) => setSalvClaim(view))
      .catch(() => setSalvClaim(null)); // $SALV status is supplementary; never block the rest of the page on it
  }, []);

  useEffect(() => {
    // The community treasury is a public, wallet-independent figure (it
    // is the same for every visitor), so it loads once on mount rather
    // than waiting for an address to be scanned.
    fetchSalvVaultStatus()
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
    refreshSalvClaim(walletAddress);
    return () => {
      cancelled = true;
    };
    // Re-fetch whenever a new verified event lands so the dashboard
    // reflects the backend's authoritative ledger, not a local guess.
  }, [walletAddress, proofEvents.length, refreshSalvClaim]);

  // Only show stats for the currently scanned address — if it's
  // cleared, don't keep displaying a stale wallet's numbers.
  const effectiveSummary = walletAddress ? summary : null;
  const epoch = effectiveSummary?.currentEpoch ?? null;
  const effectiveSalvClaim = walletAddress ? salvClaim : null;
  const salvBadgeStatus = deriveSalvBadgeStatus(effectiveSalvClaim);

  async function handleScanSubmit(event: FormEvent) {
    event.preventDefault();
    const detected = detectWalletAddress(pasteInput);
    if (!detected.valid) {
      setPasteError("That does not look like a valid Solana or EVM (e.g. Robinhood Wallet) address.");
      return;
    }
    setPasteError(null);
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/salv/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: pasteInput.trim() }),
      });
      const data = (await res.json()) as ScanApiResult & { error?: string };
      if (!res.ok) {
        setPasteError(data.error ?? "Scan failed. Try again in a moment.");
        return;
      }
      setScanResult(data);
      setWalletAddress(data.wallet); // shared across pages for continuity only -- not a "connection"
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
    setPasteError(null);
  }

  async function handleClaimSalv() {
    if (!walletAddress || !effectiveSalvClaim?.epoch) return;
    setClaiming(true);
    setClaimError(null);
    setClaimNotice(null);
    try {
      const result = await claimSalv(walletAddress, effectiveSalvClaim.epoch);
      if (result.outcome === "CLAIMED") {
        setClaimNotice(`Claimed. Tx ${result.transactionSignature?.slice(0, 12)}…`);
      }
      refreshSalvClaim(walletAddress);
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
        support="Every point traces back to an independently verified onchain event. EST. $SALV is a simulation for testing hypothetical reward-pool economics — there is no live $SALV token yet."
      />

      {!walletAddress ? (
        <div className="empty-state">
          <h2>Paste a wallet address to check your rewards.</h2>
          <p>
            No wallet connection, signature, or private key required — SALVAGE only reads the public address you
            paste. Solana and EVM (e.g. Robinhood Wallet) addresses are both accepted.
          </p>
          <form className="wallet-form" onSubmit={handleScanSubmit}>
            <input
              type="text"
              className="wallet-input code"
              placeholder="Paste a Solana or EVM wallet address"
              value={pasteInput}
              onChange={(event) => setPasteInput(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-label="Wallet address"
            />
            <button type="submit" className="primary-button" disabled={scanning || !pasteInput.trim()}>
              {scanning ? "Scanning…" : "Scan wallet"}
            </button>
          </form>
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
                {scanResult.salvAllocated} SALV <small>{scanResult.status}</small>
              </strong>
              <small>
                Network {scanResult.network.toUpperCase()} · Epoch {scanResult.epochId ?? "none"}
                {scanResult.scan.attempted ? (scanResult.scan.succeeded ? " · live scan OK" : ` · live scan failed (${scanResult.scan.reason ?? "unknown"})`) : ""}
              </small>
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
              <span>Assets salvaged</span>
              <strong>{(effectiveSummary?.assetsSalvaged ?? 0).toLocaleString()}</strong>
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
              <span>$SALV reward</span>
              <strong>
                {salvBadgeStatus === "CLAIMABLE" || salvBadgeStatus === "CLAIMED"
                  ? effectiveSalvClaim!.amountSalv.toLocaleString(undefined, { maximumFractionDigits: 2 })
                  : epoch
                    ? `~${effectiveSummary!.estimatedReward.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                    : "—"}
              </strong>
              <span className={`status-badge ${SALV_BADGE_CLASS[salvBadgeStatus]}`}>
                <i />
                {salvBadgeStatus}
              </span>
              {salvBadgeStatus === "CLAIMABLE" && (
                <>
                  <button type="button" className="salvage-bin-cta" onClick={handleClaimSalv} disabled={claiming}>
                    {claiming ? "CLAIMING…" : "CLAIM SALV"}
                  </button>
                  <small>
                    Record-only today: claiming executes automatically server-side, with no signature required. A future
                    version will require you to sign this step with an external wallet before it executes.
                  </small>
                </>
              )}
              {salvBadgeStatus === "CLAIMED" && effectiveSalvClaim?.claim?.claimTransactionSignature && (
                <small>tx {effectiveSalvClaim.claim.claimTransactionSignature.slice(0, 12)}…</small>
              )}
              {(salvBadgeStatus === "NOT LIVE" || salvBadgeStatus === "DEVNET") && epoch && <small>SIMULATED · not $SALV</small>}
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
          Community treasury: up to {(COMMUNITY_ALLOCATION_SALV / 1_000_000).toLocaleString()}M SALV. Controlled by a
          3-of-3 team multisig — every rewards payout, giveaway, future incentive, or burn requires all three
          members to sign. Not permanently locked: it is a team-controlled pool for documented community uses,
          capped at {(COMMUNITY_ALLOCATION_SALV / 1_000_000).toLocaleString()}M and never exceeded.
        </p>
      </div>

      {vaultStatus && (
        <div className="rewards-grid">
          <div className="reward-card">
            <span>Current $SALV supply</span>
            <strong>{TOTAL_SUPPLY_SALV.toLocaleString()}</strong>
            <span className={`status-badge ${vaultStatus.configured ? "status-review" : "status-keep"}`}>
              <i />
              {vaultStatus.configured ? (vaultStatus.network ?? "DEPLOYED") : "NOT LIVE"}
            </span>
          </div>
          <div className="reward-card">
            <span>Community treasury cap</span>
            <strong>{vaultStatus.allocationSalv.toLocaleString()}</strong>
            <small>hard cap · never exceeded</small>
          </div>
          <div className="reward-card">
            <span>Rewards allocated</span>
            <strong>{vaultStatus.allocatedToRewardsSalv.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
            <small>claimable, not yet sent</small>
          </div>
          <div className="reward-card">
            <span>Rewards claimed</span>
            <strong>{vaultStatus.distributedSalv.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
            <small>sent on-chain</small>
          </div>
          <div className="reward-card">
            <span>Burned</span>
            <strong>{vaultStatus.burnedSalv.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
            <small>permanent · multisig-approved</small>
          </div>
          <div className="reward-card">
            <span>Treasury remaining</span>
            <strong>{vaultStatus.remainingSalv.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
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
          <p>Complete a salvage to generate your first Proof of Salvage receipt.</p>
        </div>
      ) : (
        <div className="proof-list">
          {proofEvents.map((event) => (
            <article key={event.id} className="proof-receipt">
              <div className="proof-receipt-top">
                <span>{event.label}</span>
                <span className="status-badge status-salvageable">
                  <i />
                  {event.status}
                </span>
              </div>
              <div className="proof-flow">
                <span>Salvage</span>
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
