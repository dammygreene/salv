"use client";

import { useMemo } from "react";
import { useAppState } from "@/lib/app-state";

export function SalvageBin({ onReview }: { onReview: () => void }) {
  const { assets, selected, canSign } = useAppState();
  const count = selected.length;
  const chosen = useMemo(() => assets.filter((asset) => selected.includes(asset.id)), [assets, selected]);
  const recoverableSol = useMemo(
    () =>
      chosen.reduce((total, asset) => {
        if (!asset.valueKnown || !asset.value.endsWith("SOL")) return total;
        const match = asset.value.match(/[\d.]+/);
        return match ? total + parseFloat(match[0]) : total;
      }, 0),
    [chosen]
  );
  const reward = count ? count * 6 + 4 : 0;

  return (
    <aside className={`salvage-bin ${count ? "is-active" : ""}`}>
      <div className="salvage-bin-head">
        <h3>Salvage bin</h3>
        <span className="salvage-bin-count">{count.toString().padStart(2, "0")}</span>
      </div>
      <div className="salvage-bin-chamber">
        <div className="salvage-bin-ring" />
        <span>{count ? `${count.toString().padStart(2, "0")} asset${count === 1 ? "" : "s"} ready` : "Insert an eligible asset"}</span>
      </div>
      <div className="salvage-bin-summary">
        <div>
          <span>Recoverable</span>
          <strong>{count ? `${recoverableSol.toFixed(4)} SOL` : "–"}</strong>
        </div>
        <div>
          <span>Reward</span>
          <strong>{count ? `+${reward}` : "+–"}</strong>
        </div>
      </div>
      <button className="salvage-bin-cta" disabled={!count} onClick={onReview}>
        Salvage selected
      </button>
      <small>
        {canSign
          ? "Only verified, allowlisted actions can enter the bin."
          : "Read-only address connected. Connect a real wallet to sign a live transaction."}
      </small>
    </aside>
  );
}
