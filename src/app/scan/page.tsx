"use client";

import { FormEvent, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { CullMachine } from "@/components/cull-machine";
import { StatModule } from "@/components/stat-module";
import { AssetCard } from "@/components/asset-card";
import { CullBin } from "@/components/cull-bin";
import { ReviewModal } from "@/components/review-modal";
import { DEMO_ADDRESS, shortAddress, useAppState } from "@/lib/app-state";
import { scanStateLabel } from "@/lib/data";
import { validateCombinedWalletSubmission } from "@/lib/walletAddress";

/** Response shape of POST /api/culler/scan — see that route for the full
 * contract. This is the authoritative, server-computed reward-ledger
 * result for a combined Solana(+optional Robinhood) submission; it is
 * never derived from anything on the client, and the Solana wallet is
 * always its sole reward identity. */
interface LedgerScanResult {
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

export default function ScanPage() {
  const {
    walletAddress,
    addressError,
    canSign,
    scanState,
    scanError,
    hasScanned,
    accountsFound,
    accountsTruncated,
    assets,
    startScan,
    clearWallet,
  } = useAppState();
  const [showReview, setShowReview] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [addressInput, setAddressInput] = useState("");
  const [robinhoodInput, setRobinhoodInput] = useState("");
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [ledgerResult, setLedgerResult] = useState<LedgerScanResult | null>(null);
  const [ledgerScanning, setLedgerScanning] = useState(false);
  const validation = validateCombinedWalletSubmission({ solanaWallet: addressInput, robinhoodWallet: robinhoodInput });
  const hasWallet = Boolean(walletAddress);

  // One form, one "Scan wallet" click performs TWO independent things:
  // (1) the existing live, read-only Solana recovery scan (unchanged,
  // via `startScan`, Solana-only, drives the asset grid below), and
  // (2) a combined Solana+Robinhood submission to the $CULLER reward
  // ledger (`/api/culler/scan`) — Solana is the sole reward identity in
  // both cases, and Robinhood (optional) never gets its own scan or its
  // own button.
  async function handleScanSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validation.valid) {
      setLedgerError(validation.error);
      return;
    }
    setLedgerError(null);
    const { solanaWallet, robinhoodWallet } = validation.submission;
    startScan(solanaWallet);

    setLedgerScanning(true);
    setLedgerResult(null);
    try {
      const res = await fetch("/api/culler/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solanaWallet, robinhoodWallet }),
      });
      const data = (await res.json()) as LedgerScanResult & { error?: string };
      if (!res.ok) {
        setLedgerError(data.error ?? "Could not record this scan for $CULLER rewards.");
        return;
      }
      setLedgerResult(data);
    } catch {
      setLedgerError("Could not reach the reward ledger. Try again shortly.");
    } finally {
      setLedgerScanning(false);
    }
  }

  const scanning = scanState !== "READY" && scanState !== "SCAN COMPLETE";
  const cullable = assets.filter((a) => a.status === "CULLABLE");
  const watch = assets.filter((a) => a.status === "WATCH");
  const review = assets.filter((a) => a.status === "REVIEW");
  const recoverableSol = useMemo(
    () =>
      cullable.reduce((total, asset) => {
        if (!asset.valueKnown || !asset.value.endsWith("SOL")) return total;
        const match = asset.value.match(/[\d.]+/);
        return match ? total + parseFloat(match[0]) : total;
      }, 0),
    [cullable]
  );

  return (
    <main className="scan-page">
      <PageHeader
        title={hasScanned ? (assets.length ? `${assets.length} assets found.` : "No token accounts found.") : "Open the machine bay."}
        support={
          hasScanned
            ? assets.length
              ? "Here's everything attached to this wallet, sorted with a reason for every call."
              : "This wallet has no SPL token accounts to show. Try another address."
            : "Paste a wallet address and run a scan. Nothing moves until you tell it to."
        }
        meta={
          <>
            <span>{hasWallet ? shortAddress(walletAddress) : "No address entered"}</span>
            <span className="meta-rule" />
            <span>{hasWallet ? (canSign ? "Wallet signer" : "Read-only") : "Solana"}</span>
            {hasWallet && (
              <>
                <span className="meta-rule" />
                <button type="button" className="text-link" onClick={clearWallet}>
                  Scan a different address
                </button>
              </>
            )}
          </>
        }
      />

      <div className="scan-console">
        <div className="scan-console-machine">
          <CullMachine />
        </div>
        <div className="scan-console-controls">
          {!hasWallet && (
            <>
              <h2>Paste a wallet address to begin.</h2>
              <p>CULLER never asks for a seed phrase or private key. Paste any public wallet address below — it is read-only.</p>
              <form className="wallet-form" onSubmit={handleScanSubmit}>
                <div className="wallet-field">
                  <label className="wallet-field-label" htmlFor="scan-solana-wallet">
                    Solana wallet
                  </label>
                  <input
                    id="scan-solana-wallet"
                    type="text"
                    className="wallet-input code"
                    placeholder="Paste a Solana wallet address"
                    value={addressInput}
                    onChange={(event) => setAddressInput(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="Solana wallet address"
                    required
                  />
                </div>
                <div className="wallet-field">
                  <label className="wallet-field-label" htmlFor="scan-robinhood-wallet">
                    Robinhood wallet (optional)
                  </label>
                  <input
                    id="scan-robinhood-wallet"
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
                <button type="submit" className="primary-button" disabled={ledgerScanning || !validation.valid}>
                  {ledgerScanning ? "Scanning…" : "Scan wallet"}
                </button>
              </form>
              <small className="wallet-form-note">Solana wallet required for $CULLER rewards.</small>
              <small className="wallet-form-note">Optional. Add your Robinhood wallet to scan both.</small>
              {(addressError || ledgerError) && <small className="wallet-form-error">{ledgerError ?? addressError}</small>}
              <button type="button" className="text-link" onClick={() => startScan(DEMO_ADDRESS)}>
                Or scan a demo wallet →
              </button>
              <small className="wallet-form-note">Read-only: balances and token accounts are fetched live from Solana.</small>

              <p className="wallet-form-note">
                Want to actually recover assets, not just preview them? You&rsquo;ll be asked for a wallet extension signature
                only at the final confirm step — CULLER only ever requests a public key there, never a seed phrase or private
                key.
              </p>

              {ledgerResult && (
                <div className="reward-card" style={{ marginTop: "0.5rem" }}>
                  <span>$CULLER reward ledger</span>
                  <strong>
                    {ledgerResult.reward.cullerAllocated} CULLER <small>{ledgerResult.reward.status}</small>
                  </strong>
                  <small>Epoch {ledgerResult.reward.epochId ?? "none"}</small>
                  {ledgerResult.robinhoodWallet ? (
                    <small>Robinhood linked · asset scanning not yet available ({ledgerResult.scan.robinhood.state})</small>
                  ) : (
                    <small>No Robinhood wallet linked for this scan.</small>
                  )}
                  {ledgerResult.csvRecorded ? (
                    <small>✓ Recorded in the reward ledger.</small>
                  ) : (
                    <small className="wallet-form-error">Not recorded ({ledgerResult.recordError ?? "unknown error"}).</small>
                  )}
                </div>
              )}
            </>
          )}
          {hasWallet && !hasScanned && scanError && (
            <>
              <h2>Scan failed.</h2>
              <p>{scanError}</p>
              <button className="primary-button" onClick={() => startScan()}>
                Try again
              </button>
            </>
          )}
          {hasWallet && !hasScanned && !scanError && (
            <>
              <h2>{scanning ? scanStateLabel[scanState] : "Address entered. Ready to scan."}</h2>
              <p>
                {scanning
                  ? "Reading balances and token accounts live from Solana. This takes a few seconds."
                  : "The scan only reads public onchain data. It never requests a signature."}
              </p>
              <button className="primary-button" onClick={() => startScan()} disabled={scanning}>
                {scanning ? "Scanning" : "Scan my wallet"}
              </button>
            </>
          )}
          {hasWallet && hasScanned && (
            <>
              <h2>Scan complete.</h2>
              <p>
                {accountsFound} token account{accountsFound === 1 ? "" : "s"} found
                {accountsTruncated ? `, first ${assets.length} indexed` : ""}. {cullable.length} are allowlisted
                for cull right now.
              </p>
              <button className="ghost-button" onClick={() => startScan()}>
                Rescan wallet
              </button>
            </>
          )}
        </div>
      </div>

      {hasScanned && (
        <>
          <div className="result-compartments">
            <StatModule tone="recover" label="Recover" value={recoverableSol.toFixed(4)} unit="SOL" caption="Value detected" />
            <StatModule tone="cull" label="Cull" value={String(cullable.length).padStart(2, "0")} unit="assets" caption="Allowlisted" />
            <StatModule tone="watch" label="Watch" value={String(watch.length).padStart(2, "0")} unit="assets" caption="Uncertain" />
            <StatModule tone="unknown" label="Review" value={String(review.length).padStart(2, "0")} unit="assets" caption="Needs analysis" />
          </div>

          <div className="scan-results-layout">
            <div className="asset-grid">
              {assets.map((asset) => (
                <AssetCard key={asset.id} asset={asset} />
              ))}
            </div>
            <CullBin onReview={() => setShowReview(true)} />
          </div>
        </>
      )}

      <ReviewModal
        open={showReview}
        onClose={() => setShowReview(false)}
        onConfirmed={() => {
          setShowReview(false);
          setJustCompleted(true);
          window.setTimeout(() => setJustCompleted(false), 4000);
        }}
      />

      {justCompleted && (
        <div className="toast-confirm" role="status">
          <span>✓</span> Cull confirmed. Proof verified, check your rewards.
        </div>
      )}
    </main>
  );
}
