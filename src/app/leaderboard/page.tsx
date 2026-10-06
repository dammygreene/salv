"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { formatCullerAllocation } from "@/lib/culler/share";

interface LeaderboardRow {
  rank: number;
  allocation: string;
  walletAddress: string;
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [currentUser, setCurrentUser] = useState<LeaderboardRow | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch("/api/leaderboard")
      .then(async (response) => {
        if (!response.ok) throw new Error("leaderboard");
        return (await response.json()) as { rows: LeaderboardRow[]; currentUser: LeaderboardRow | null };
      })
      .then((data) => {
        setRows(data.rows);
        setCurrentUser(data.currentUser);
      })
      .catch(() => setError(true));
  }, []);

  return (
    <main className="leaderboard-page">
      <PageHeader title="CULLER leaderboard." support="Who found the most dead weight?" />
      <section className="leaderboard-panel" aria-labelledby="leaderboard-title">
        <div className="leaderboard-heading">
          <div>
            <span className="eyebrow">Verified allocations</span>
            <h2 id="leaderboard-title">The board is still warming up.</h2>
          </div>
          <p>Verified wallet allocations come directly from the authoritative reward ledger.</p>
        </div>
        {error ? (
          <p className="leaderboard-empty">Leaderboard unavailable right now.</p>
        ) : rows.length === 0 ? (
          <p className="leaderboard-empty">Complete a verified scan to take your spot.</p>
        ) : (
          <div className="leaderboard-list">
            {rows.map((row) => (
              <div className={`leaderboard-row ${currentUser?.walletAddress === row.walletAddress ? "is-current" : ""}`} key={row.walletAddress}>
                <strong className="leaderboard-rank">#{row.rank}</strong>
                <span className="leaderboard-user">
                  {row.walletAddress}
                </span>
                <strong className="leaderboard-allocation">{formatCullerAllocation(row.allocation)} $CULLER</strong>
              </div>
            ))}
          </div>
        )}
        {currentUser && !rows.some((row) => row.walletAddress === currentUser.walletAddress) && (
          <div className="leaderboard-current">
            <span>Your rank</span>
            <strong>#{currentUser.rank}</strong>
            <span>{currentUser.walletAddress}</span>
            <strong>{formatCullerAllocation(currentUser.allocation)} $CULLER</strong>
          </div>
        )}
      </section>
    </main>
  );
}
