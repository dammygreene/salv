"use client";

import { useMemo } from "react";
import { useAppState, shortAddress } from "@/lib/app-state";
import { scanStateLabel } from "@/lib/data";

export function CullMachine() {
  const { scanState, scanProgress, hasScanned, walletAddress, assets } = useAppState();
  const hasWallet = Boolean(walletAddress);
  const active = scanState !== "READY";
  const label = scanStateLabel[scanState] ?? "Ready to scan";

  const cullable = useMemo(() => assets.filter((asset) => asset.eligibility === "ELIGIBLE").length, [assets]);
  const candidates = useMemo(() => assets.filter((asset) => asset.eligibility === "CANDIDATE").length, [assets]);
  const notEligible = useMemo(() => assets.filter((asset) => asset.eligibility === "NOT_ELIGIBLE").length, [assets]);
  const recoverable = useMemo(
    () =>
      assets.reduce((total, asset) => {
        if (!asset.valueKnown || !asset.value.endsWith("SOL")) return total;
        const match = asset.value.match(/[\d.]+/);
        return match ? total + parseFloat(match[0]) : total;
      }, 0),
    [assets]
  );

  return (
    <div className="node-flow" role="status" aria-live="polite">
      <div className="node">
        <div className="node-head">
          <span className={`node-dot ${hasWallet ? "is-live" : ""}`} />
          <span>Wallet</span>
        </div>
        <div className="node-body">
          <span className="node-line code">{hasWallet ? shortAddress(walletAddress) : "No address entered"}</span>
        </div>
      </div>

      <span className="node-wire" aria-hidden="true" />

      <div className={`node ${active ? "is-live" : ""}`}>
        <div className="node-head">
          <span className={`node-dot ${active ? "is-live" : ""}`} />
          <span>Scan</span>
          <span className="node-status">{hasScanned ? "Complete" : label}</span>
        </div>
        <div className="node-progress">
          <span style={{ width: `${hasScanned ? 100 : scanProgress}%` }} />
        </div>
      </div>

      <span className="node-wire" aria-hidden="true" />

      <div className="node">
        <div className="node-head">
          <span className="node-dot" />
          <span>Classify</span>
        </div>
        <div className="node-tally">
          <span>
            <b className="num">{hasScanned ? cullable : "–"}</b> eligible
          </span>
          <span>
            <b className="num">{hasScanned ? candidates : "–"}</b> candidates
          </span>
          <span>
            <b className="num">{hasScanned ? notEligible : "–"}</b> not eligible
          </span>
        </div>
      </div>

      <span className="node-wire" aria-hidden="true" />

      <div className="node node-output">
        <div className="node-head">
          <span className="node-dot is-accent" />
          <span>Result</span>
        </div>
        <div className="node-body">
          <strong className="node-figure num">{recoverable.toFixed(4)} SOL</strong>
          <span className="node-line">SOL value detected</span>
        </div>
      </div>
    </div>
  );
}
