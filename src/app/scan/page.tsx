"use client";

import { FormEvent, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { SalvageMachine } from "@/components/salvage-machine";
import { StatModule } from "@/components/stat-module";
import { AssetCard } from "@/components/asset-card";
import { SalvageBin } from "@/components/salvage-bin";
import { ReviewModal } from "@/components/review-modal";
import { shortAddress, useAppState } from "@/lib/app-state";
import { scanStateLabel } from "@/lib/data";
import { isValidSolanaAddress } from "@/lib/solana/base58";

export default function ScanPage() {
  const {
    connected,
    walletAddress,
    connectError,
    canSign,
    availableWallets,
    connectExtensionWallet,
    scanState,
    scanError,
    hasScanned,
    accountsFound,
    accountsTruncated,
    assets,
    startScan,
    connectWallet,
    disconnectWallet,
  } = useAppState();
  const [showReview, setShowReview] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [addressInput, setAddressInput] = useState("");
  const addressValid = isValidSolanaAddress(addressInput.trim());

  function handleConnectSubmit(event: FormEvent) {
    event.preventDefault();
    if (!addressValid) return;
    connectWallet(addressInput.trim());
  }

  const scanning = scanState !== "READY" && scanState !== "SCAN COMPLETE";
  const salvageable = assets.filter((a) => a.status === "SALVAGEABLE");
  const watch = assets.filter((a) => a.status === "WATCH");
  const review = assets.filter((a) => a.status === "REVIEW");
  const recoverableSol = useMemo(
    () =>
      salvageable.reduce((total, asset) => {
        if (!asset.valueKnown || !asset.value.endsWith("SOL")) return total;
        const match = asset.value.match(/[\d.]+/);
        return match ? total + parseFloat(match[0]) : total;
      }, 0),
    [salvageable]
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
            : "Connect a wallet and run a scan. Nothing moves until you tell it to."
        }
        meta={
          <>
            <span>{connected ? shortAddress(walletAddress) : "Not connected"}</span>
            <span className="meta-rule" />
            <span>{connected ? (canSign ? "Wallet signer" : "Read-only") : "Solana"}</span>
            {connected && (
              <>
                <span className="meta-rule" />
                <button type="button" className="text-link" onClick={disconnectWallet}>
                  Disconnect
                </button>
              </>
            )}
          </>
        }
      />

      <div className="scan-console">
        <div className="scan-console-machine">
          <SalvageMachine />
        </div>
        <div className="scan-console-controls">
          {!connected && (
            <>
              <h2>Connect a wallet to begin.</h2>
              <p>SALVAGE never asks for a seed phrase or private key. Paste any public wallet address below, it is read-only.</p>
              <form className="wallet-form" onSubmit={handleConnectSubmit}>
                <input
                  type="text"
                  className="wallet-input code"
                  placeholder="Paste a Solana wallet address"
                  value={addressInput}
                  onChange={(event) => setAddressInput(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Wallet address"
                />
                <button type="submit" className="primary-button" disabled={!addressValid}>
                  Connect
                </button>
              </form>
              {connectError && <small className="wallet-form-error">{connectError}</small>}
              <button type="button" className="text-link" onClick={() => connectWallet()}>
                Or use a demo wallet →
              </button>
              <small className="wallet-form-note">Read-only: balances and token accounts are fetched live from Solana.</small>

              <p className="wallet-form-note">
                Want to actually recover assets, not just preview them? Connect a wallet extension — SALVAGE only ever
                requests its public key, never a seed phrase or private key.
              </p>
              {availableWallets.length > 0 ? (
                <div className="wallet-picker-list">
                  {availableWallets.map((w) => (
                    <button
                      key={w.adapter.name}
                      type="button"
                      className="ghost-button"
                      onClick={() => connectExtensionWallet(w.adapter.name)}
                    >
                      Connect {w.adapter.name}
                    </button>
                  ))}
                </div>
              ) : (
                <small className="wallet-form-note">
                  No Solana wallet extension detected in this browser (Phantom, Solflare, Backpack, etc.).
                </small>
              )}
            </>
          )}
          {connected && !hasScanned && scanError && (
            <>
              <h2>Scan failed.</h2>
              <p>{scanError}</p>
              <button className="primary-button" onClick={startScan}>
                Try again
              </button>
            </>
          )}
          {connected && !hasScanned && !scanError && (
            <>
              <h2>{scanning ? scanStateLabel[scanState] : "Wallet connected. Ready to scan."}</h2>
              <p>
                {scanning
                  ? "Reading balances and token accounts live from Solana. This takes a few seconds."
                  : "The scan only reads public onchain data. It never requests a signature."}
              </p>
              <button className="primary-button" onClick={startScan} disabled={scanning}>
                {scanning ? "Scanning" : "Scan my wallet"}
              </button>
            </>
          )}
          {connected && hasScanned && (
            <>
              <h2>Scan complete.</h2>
              <p>
                {accountsFound} token account{accountsFound === 1 ? "" : "s"} found
                {accountsTruncated ? `, first ${assets.length} indexed` : ""}. {salvageable.length} are allowlisted
                for salvage right now.
              </p>
              <button className="ghost-button" onClick={startScan}>
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
            <StatModule tone="salvage" label="Salvage" value={String(salvageable.length).padStart(2, "0")} unit="assets" caption="Allowlisted" />
            <StatModule tone="watch" label="Watch" value={String(watch.length).padStart(2, "0")} unit="assets" caption="Uncertain" />
            <StatModule tone="unknown" label="Review" value={String(review.length).padStart(2, "0")} unit="assets" caption="Needs analysis" />
          </div>

          <div className="scan-results-layout">
            <div className="asset-grid">
              {assets.map((asset) => (
                <AssetCard key={asset.id} asset={asset} />
              ))}
            </div>
            <SalvageBin onReview={() => setShowReview(true)} />
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
          <span>✓</span> Salvage confirmed. Proof verified, check your rewards.
        </div>
      )}
    </main>
  );
}
