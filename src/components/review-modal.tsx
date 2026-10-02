"use client";

import { useMemo, useState } from "react";
import { useAppState } from "@/lib/app-state";

const STATUS_LABEL: Record<string, string> = {
  BUILDING: "Preparing transaction…",
  AWAITING_SIGNATURE: "Awaiting wallet signature…",
  CONFIRMING: "Confirming on-chain…",
  VERIFYING: "Verifying with backend…",
};

export function ReviewModal({ open, onClose, onConfirmed }: { open: boolean; onClose: () => void; onConfirmed: () => void }) {
  const { assets, selected, confirmSalvage, canSign, salvageStatus, salvageError } = useAppState();
  const [submitting, setSubmitting] = useState(false);
  const chosen = useMemo(() => assets.filter((asset) => selected.includes(asset.id)), [assets, selected]);
  const reward = chosen.length * 6 + 4;
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

  const busy = submitting || salvageStatus === "BUILDING" || salvageStatus === "AWAITING_SIGNATURE" || salvageStatus === "CONFIRMING" || salvageStatus === "VERIFYING";

  async function handleConfirm() {
    setSubmitting(true);
    const result = await confirmSalvage();
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
        <h2 id="review-title">Confirm salvage</h2>
        <div className="review-rows">
          <div className="review-row">
            <span>Assets</span>
            <strong>{chosen.map((asset) => asset.name).join(", ") || "None selected"}</strong>
          </div>
          <div className="review-row">
            <span>Network</span>
            <strong>Solana mainnet-beta</strong>
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
            <strong>+{reward} salvage score</strong>
          </div>
        </div>
        {canSign ? (
          <p className="review-note">
            Check the exact action before your wallet signs. The amount above is an estimate — the confirmed recovery is
            whatever the chain actually returns, verified independently after you sign.
          </p>
        ) : (
          <p className="review-note">
            This wallet is connected read-only (pasted address). Connect a real wallet from the scan screen to sign and
            execute a real transaction.
          </p>
        )}
        <div className="review-warning">
          <span>!</span> Account closure is permanent. Only proceed when you recognize every asset above.
        </div>
        {busy && <p className="review-note">{STATUS_LABEL[salvageStatus] ?? "Working…"}</p>}
        {!busy && salvageStatus === "ERROR" && salvageError && <p className="wallet-form-error">{salvageError}</p>}
        <button className="primary-button" onClick={handleConfirm} disabled={!canSign || busy || !chosen.length}>
          {busy ? STATUS_LABEL[salvageStatus] ?? "Working…" : "Confirm salvage"}
        </button>
      </section>
    </div>
  );
}
