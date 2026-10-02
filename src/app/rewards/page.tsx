"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { useAppState } from "@/lib/app-state";
import { fetchRewardsSummary, RewardsSummary } from "@/lib/solana/executor/verify";

export default function RewardsPage() {
  const { proofEvents, walletAddress } = useAppState();
  const [summary, setSummary] = useState<RewardsSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Could not load rewards.");
      });
    return () => {
      cancelled = true;
    };
    // Re-fetch whenever a new verified event lands so the dashboard
    // reflects the backend's authoritative ledger, not a local guess.
  }, [walletAddress, proofEvents.length]);

  // Only show stats for the currently connected wallet — if it
  // disconnects, don't keep displaying a stale wallet's numbers.
  const effectiveSummary = walletAddress ? summary : null;
  const epoch = effectiveSummary?.currentEpoch ?? null;

  return (
    <main className="rewards-page">
      <PageHeader
        title="Rewards need proof."
        support="Every point traces back to an independently verified onchain event. EST. $SALV is a simulation for testing hypothetical reward-pool economics — there is no live $SALV token yet."
      />

      {!walletAddress ? (
        <div className="empty-state">
          <h2>Connect a wallet to see your rewards.</h2>
          <p>Points and epoch standing are tracked per wallet by the backend.</p>
        </div>
      ) : (
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
            <span>Simulated reward</span>
            <strong>
              {epoch ? `~${effectiveSummary!.estimatedReward.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}{" "}
              <small>SIMULATED · not $SALV</small>
            </strong>
          </div>
        </div>
      )}

      {walletAddress && !epoch && (
        <p className="rewards-epoch-note">
          No epoch is currently active, so there is nothing to simulate a reward share against yet.
        </p>
      )}

      {loadError && <p className="wallet-form-error">{loadError}</p>}

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
