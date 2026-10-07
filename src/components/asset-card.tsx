"use client";

import { useAppState } from "@/lib/app-state";
import { Asset } from "@/lib/types";
import { StatusBadge } from "./status-badge";

const KIND_GLYPH: Record<Asset["kind"], string> = {
  TOKEN: "◈",
  NFT: "◇",
  POSITION: "▣",
  ACCOUNT: "○",
};

export function AssetCard({ asset, variant = "default" }: { asset: Asset; variant?: "default" | "wide" }) {
  const { addToWatch } = useAppState();

  return (
    <article className={`asset-card ${variant === "wide" ? "asset-card-wide" : ""}`}>
      <div className="asset-card-top">
        <span className="asset-glyph">{KIND_GLYPH[asset.kind]}</span>
        <StatusBadge status={asset.status} />
      </div>
      <h3>{asset.name}</h3>
      <span className="asset-address">
        {asset.kind.toLowerCase()}
        <i className="meta-rule" /> {asset.address}
      </span>
      <div className="asset-detail">
        <span>
          Age <strong>{asset.age}</strong>
        </span>
        <span>
          Value <strong className={!asset.valueKnown ? "is-unknown" : ""}>{asset.value}</strong>
        </span>
      </div>
      <p>{asset.reason}</p>
      {asset.status === "CULLABLE" && <span className="asset-static">Eligible activity found</span>}
      {asset.status === "WATCH" && (
        <button className="asset-action" onClick={() => addToWatch(asset.id)}>
          Watch this
        </button>
      )}
      {asset.status === "REVIEW" && <span className="asset-static">Needs analysis</span>}
      {asset.status === "KEEP" && <span className="asset-static">No action needed</span>}
    </article>
  );
}
