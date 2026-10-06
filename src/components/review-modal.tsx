"use client";

import { useMemo, useState } from "react";
import { shortAddress, useAppState } from "@/lib/app-state";
import { SOLANA_NETWORK } from "@/lib/solana/constants";
import { CULLER_REGISTRY } from "@/lib/cull/registry";

const NETWORK_LABEL: Record<string, string> = {
  "mainnet-beta": "Solana mainnet-beta",
  devnet: "Solana Devnet",
  testnet: "Solana Testnet",
};

const STATUS_LABEL: Record<string, string> = {
  BUILDING: "Preparing transaction…",
  AWAITING_SIGNATURE: "Awaiting wallet signature…",
  CONFIRMING: "Confirming on-chain…",
  VERIFYING: "Verifying with backend…",
};

export function ReviewModal({ open, onClose, onConfirmed }: { open: boolean; onClose: () => void; onConfirmed: () => void }) {
  const { assets, selected, confirmCull, canSign, walletAddress, availableWallets, connectExtensionWallet, addressError, cullStatus, cullError } =
    useAppState();
  const [submitting, setSubmitting] = useState(false);
  const chosen = useMemo(() => assets.filter((asset) => selected.includes(asset.id)), [assets, selected]);
  // Pre-verification estimate only: base points per the registry, times
  // the number of accounts. The real total (base + any recovery bonus
  // tier) is only known once the backend verifies the transaction.
  const closeBasePoints = CULLER_REGISTRY.EMPTY_TOKEN_ACCOUNT.basePoints ?? 0;
  const reward = chosen.length * closeBasePoints;
  const recoveredSol = useMemo(
    () =>
      chosen.reduce((total, asset) => {
        if (!asset.valueKnown || !asset.value.endsWith("SOL")) return total;
        const match = asset.value.match(/[\d.]+/);
        return match ? total + parseFloat(match[0]) : total;
      }, 0),
    [chosen]
  );

  if (!open) return null;

  const busy = submitting || cullStatus === "BUILDING" || cullStatus === "AWAITING_SIGNATURE" || cullStatus === "CONFIRMING" || cullStatus === "VERIFYING";

  async function handleConfirm() {
    setSubmitting(true);
    const result = await confirmCull();
    setSubmitting(false);
    if (result) onConfirmed();
  }

  return (
    <div className="modal-veil" role="presentation" onClick={busy ? undefined : onClose}>
      <section
        className="review-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close review" disabled={busy}>
          ×
        </button>
        <h2 id="review-title">Confirm cull</h2>
        <div className="review-rows">
          <div className="review-row">
            <span>Assets</span>
            <strong>{chosen.map((asset) => asset.name).join(", ") || "None selected"}</strong>
          </div>
          <div className="review-row">
            <span>Network</span>
            <strong>{NETWORK_LABEL[SOLANA_NETWORK] ?? SOLANA_NETWORK}</strong>
          </div>
          <div className="review-row">
            <span>Action</span>
            <strong>Close {chosen.length} empty token account{chosen.length === 1 ? "" : "s"}</strong>
          </div>
          <div className="review-row">
            <span>Estimated recovery</span>
            <strong>{recoveredSol.toFixed(4)} SOL</strong>
          </div>
          <div className="review-row">
            <span>Reward (if verified)</span>
            <strong>+{reward} cull score</strong>
          </div>
        </div>
        {canSign ? (
          <p className="review-note">
            Check the exact action before your wallet signs. The amount above is an estimate — the confirmed recovery is
            whatever the chain actually returns, verified independently after you sign.
          </p>
        ) : (
          <div className="review-signer">
            <p className="review-note">
              This is a preview of a pasted address. Executing this action for real requires a signature from the wallet
              extension that holds {shortAddress(walletAddress)}&rsquo;s own key — CULLER only ever requests its public key
              here, never a seed phrase or private key.
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
                    Use {w.adapter.name} to sign
                  </button>
                ))}
              </div>
            ) : (
              <small className="wallet-form-note">
                No Solana wallet extension detected in this browser (Phantom, Solflare, Backpack, etc.).
              </small>
            )}
            {addressError && <small className="wallet-form-error">{addressError}</small>}
          </div>
        )}
        <div className="review-warning">
          <span>!</span> Account closure is permanent. Only proceed when you recognize every asset above.
        </div>
        {busy && <p className="review-note">{STATUS_LABEL[cullStatus] ?? "Working…"}</p>}
        {!busy && cullStatus === "ERROR" && cullError && <p className="wallet-form-error">{cullError}</p>}
        <button className="primary-button" onClick={handleConfirm} disabled={!canSign || busy || !chosen.length}>
          {busy ? STATUS_LABEL[cullStatus] ?? "Working…" : "Confirm cull"}
        </button>
      </section>
    </div>
  );
}
