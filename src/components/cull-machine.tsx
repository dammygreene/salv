"use client";

import { useMemo } from "react";
import { useAppState, shortAddress } from "@/lib/app-state";
import { scanStateLabel } from "@/lib/data";

export function CullMachine() {
  const { scanState, scanProgress, hasScanned, walletAddress, assets } = useAppState();
  const hasWallet = Boolean(walletAddress);
  const active = scanState !== "READY";
  const label = scanStateLabel[scanState] ?? "Ready to scan";

  const cullable = useMemo(() => assets.filter((asset) => asset.status === "CULLABLE").length, [assets]);
  const watch = useMemo(() => assets.filter((asset) => asset.status === "WATCH").length, [assets]);
  const keep = useMemo(() => assets.filter((asset) => asset.status === "KEEP" || asset.status === "REVIEW").length, [assets]);
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
          <span>Sort</span>
        </div>
        <div className="node-tally">
          <span>
            <b className="num">{hasScanned ? cullable : "–"}</b> cullable
          </span>
          <span>
            <b className="num">{hasScanned ? watch : "–"}</b> watch
          </span>
          <span>
            <b className="num">{hasScanned ? keep : "–"}</b> keep
          </span>
        </div>
      </div>

      <span className="node-wire" aria-hidden="true" />

      <div className="node node-output">
        <div className="node-head">
          <span className="node-dot is-accent" />
          <span>Reward</span>
        </div>
        <div className="node-body">
          <strong className="node-figure num">{recoverable.toFixed(4)} SOL</strong>
          <span className="node-line">recoverable this scan</span>
        </div>
      </div>
    </div>
  );
}
