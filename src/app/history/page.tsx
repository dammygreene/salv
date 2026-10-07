"use client";

import { PageHeader } from "@/components/page-header";
import { useAppState } from "@/lib/app-state";

const KIND_LABEL: Record<string, string> = {
  SCAN: "Scan",
  CULLER: "Cull",
  WATCH: "Watch",
  REWARD: "Reward",
};

export default function HistoryPage() {
  const { history } = useAppState();

  return (
    <main className="history-page">
      <PageHeader title="Your history." support="Recorded scans and CULLER allocation activity for this wallet." />

      {history.length === 0 ? (
        <div className="empty-state">
          <h2>No recorded activity yet.</h2>
          <p>Scan a Solana wallet to begin building its CULLER history.</p>
        </div>
      ) : (
        <ol className="timeline">
          {history.map((event) => (
            <li key={event.id} className={`timeline-item timeline-${event.kind.toLowerCase()}`}>
              <span className="timeline-dot" />
              <div className="timeline-body">
                <div className="timeline-head">
                  <span className="timeline-kind">{KIND_LABEL[event.kind]}</span>
                  <span className="timeline-time">{event.timestamp}</span>
                </div>
                <strong>{event.label}</strong>
                <p>{event.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
