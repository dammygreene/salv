"use client";

import { PageHeader } from "@/components/page-header";
import { useAppState } from "@/lib/app-state";

export default function RewardsPage() {
  const { rewardScore, proofEvents } = useAppState();
  const networkScore = 184920;
  const share = networkScore ? ((rewardScore / (networkScore + rewardScore)) * 100).toFixed(4) : "0.0000";

  return (
    <main className="rewards-page">
      <PageHeader
        title="Rewards need proof."
        support="Every $SALV credit traces back to an independently verified onchain event. Projections are estimates until the epoch closes."
      />

      <div className="rewards-grid">
        <div className="reward-card">
          <span>Current epoch</span>
          <strong>07 <small>/ 12</small></strong>
        </div>
        <div className="reward-card">
          <span>Your salvage score</span>
          <strong>{rewardScore.toLocaleString()}</strong>
        </div>
        <div className="reward-card">
          <span>Network score</span>
          <strong>{networkScore.toLocaleString()}</strong>
        </div>
        <div className="reward-card">
          <span>Estimated share</span>
          <strong>{share}% <small>estimate</small></strong>
        </div>
      </div>

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
                <b>+{event.reward} $SALV</b>
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
