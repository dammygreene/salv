"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { shortAddress, useAppState } from "@/lib/app-state";
import { validateCombinedWalletSubmission } from "@/lib/walletAddress";

interface ScanApiResult {
  solanaWallet: string;
  robinhoodWallet: string | null;
  scan: {
    solana: { attempted: boolean; succeeded: boolean; reason?: string };
    robinhood: { submitted: boolean; state: "AVAILABLE" | "UNAVAILABLE" | "NOT_LINKED"; nativeBalanceWei: string | null; reason?: string };
  };
  reward: { cullerAllocated: string; status: string; epochId: number | null };
  csvRecorded: boolean;
  recordError?: string;
}

export default function RewardsPage() {
  const { walletAddress, setWalletAddress, clearWallet } = useAppState();
  const [pasteInput, setPasteInput] = useState("");
  const [robinhoodInput, setRobinhoodInput] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanApiResult | null>(null);

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
      setWalletAddress(data.solanaWallet);
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

  return (
    <main className="rewards-page">
      <PageHeader
        title="Your CULLER allocation."
        support="CULLER calculates an allocation from verified wallet activity and records it against your Solana wallet and epoch."
      />

      {!walletAddress ? (
        <div className="empty-state">
          <h2>Scan a wallet to view its allocation.</h2>
          <p>No wallet connection, signature, or private key required. CULLER only reads the public addresses you provide.</p>
          <form className="wallet-form" onSubmit={handleScanSubmit}>
            <div className="wallet-field">
              <label className="wallet-field-label" htmlFor="rewards-solana-wallet">Solana wallet</label>
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
              <label className="wallet-field-label" htmlFor="rewards-robinhood-wallet">Robinhood wallet (optional)</label>
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
            <button type="button" className="text-link" onClick={handleScanAnother}>Scan a different address</button>
          </div>

          {scanResult ? (
            <>
              <div className="rewards-grid">
                <div className="reward-card">
                  <span>Allocation</span>
                  <strong>{scanResult.reward.cullerAllocated} CULLER</strong>
                </div>
                <div className="reward-card">
                  <span>Status</span>
                  <strong>{scanResult.reward.status}</strong>
                </div>
                <div className="reward-card">
                  <span>Epoch</span>
                  <strong>{scanResult.reward.epochId ? `#${scanResult.reward.epochId}` : "—"}</strong>
                </div>
                <div className="reward-card">
                  <span>Ledger</span>
                  <strong>{scanResult.csvRecorded ? "Recorded" : "Not recorded"}</strong>
                </div>
              </div>
              <div className="reward-card" style={{ marginTop: "1.5rem" }}>
                <span>Wallet identity</span>
                <strong>{shortAddress(scanResult.solanaWallet)}</strong>
                <small>
                  {scanResult.robinhoodWallet
                    ? `Robinhood Chain included in the same scan (${scanResult.scan.robinhood.state.toLowerCase()}); it does not create a second allocation.`
                    : "Solana wallet is the primary leaderboard identity."}
                </small>
                {scanResult.recordError && <small className="wallet-form-error">{scanResult.recordError}</small>}
              </div>
              <p className="section-intro section-intro-tight">
                <Link href="/leaderboard" className="text-link">View the leaderboard →</Link>
              </p>
            </>
          ) : (
            <div className="empty-state">
              <h2>Scan this wallet to load its allocation.</h2>
              <p>Results are calculated from the authoritative scan and reward ledger.</p>
            </div>
          )}
        </>
      )}
    </main>
  );
}
