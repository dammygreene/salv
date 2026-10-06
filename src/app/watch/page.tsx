"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ToggleSwitch } from "@/components/toggle-switch";
import { useAppState } from "@/lib/app-state";

export default function WatchPage() {
  const { watchItems } = useAppState();
  const [notify, setNotify] = useState<Record<string, boolean>>({});

  return (
    <main className="watch-page">
      <PageHeader
        title="Unresolved, not forgotten."
        support="These assets aren't cullable yet. CULLER keeps checking for a verified recovery path and notifies you when one opens up."
      />

      {watchItems.length === 0 ? (
        <div className="empty-state">
          <h2>Nothing on watch yet.</h2>
          <p>Run a scan and add uncertain assets to watch. CULLER will keep an eye on them.</p>
          <Link href="/scan" className="primary-button">
            Go to scan
          </Link>
        </div>
      ) : (
        <div className="watch-list">
          {watchItems.map((item) => (
            <article key={item.id} className="watch-card">
              <div className="watch-card-top">
                <span className="asset-glyph">◇</span>
                <ToggleSwitch
                  id={`notify-${item.id}`}
                  checked={notify[item.id] ?? item.notify}
                  onChange={(checked) => setNotify((current) => ({ ...current, [item.id]: checked }))}
                  label="Notify"
                />
              </div>
              <h3>{item.name}</h3>
              <p>{item.reason}</p>
              <div className="watch-card-meta">
                <span>
                  Last checked <strong>{item.lastChecked}</strong>
                </span>
                <span>
                  Trigger <strong>{item.trigger}</strong>
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
