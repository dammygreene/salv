"use client";

import { useAppState } from "@/lib/app-state";
import { Asset } from "@/lib/types";
import { Coins } from "@phosphor-icons/react";
import { StatusBadge } from "./status-badge";

export function AssetCard({ asset, variant = "default" }: { asset: Asset; variant?: "default" | "wide" }) {
  const { addToWatch } = useAppState();

  return (
    <article className={`asset-card ${variant === "wide" ? "asset-card-wide" : ""}`}>
      <div className="asset-card-top">
        {asset.kind === "TOKEN" ? (
          <Coins className="asset-kind-icon" size={24} weight="duotone" aria-label="Token" />
        ) : asset.kind === "NFT" && asset.metadata?.imageUrl ? (
          // Provider image hosts are dynamic, so Next Image cannot optimize them without unsafe wildcard configuration.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="asset-nft-image" src={asset.metadata.imageUrl} alt="" loading="lazy" />
        ) : null}
        <StatusBadge status={asset.status} />
      </div>
      <h3>{asset.name}</h3>
      <span className="asset-address">
        {asset.kind.toLowerCase()}
        <i className="meta-rule" /> {asset.address}
      </span>
      {asset.metadata?.assetType === "COMPRESSED_NFT" && <span className="asset-static">COMPRESSED NFT</span>}
      <div className="asset-detail">
        <span>
          Age <strong>{asset.age}</strong>
        </span>
        <span>
          Value <strong className={!asset.valueKnown ? "is-unknown" : ""}>{asset.value}</strong>
        </span>
      </div>
      {asset.valueClassification && (
        <span className="asset-static">
          {asset.valueClassification === "EMPTY_ACCOUNT"
            ? "EMPTY ACCOUNT"
            : asset.valueClassification === "FUNGIBLE_NO_LIQUIDITY"
              ? "NO LIQUIDITY"
              : asset.valueClassification.includes("UNKNOWN")
                ? "UNKNOWN"
                : asset.valueClassification.includes("VALUABLE")
                  ? "VALUABLE"
                  : asset.valueClassification.includes("LOW_VALUE")
                    ? "LOW VALUE"
                    : asset.eligibility === "CANDIDATE"
                      ? "CANDIDATE"
                      : "NOT ELIGIBLE"}
        </span>
      )}
      {asset.kind === "ACCOUNT" && asset.recoverableLamports !== undefined && (
        <p>Recoverable rent: {(asset.recoverableLamports / 1_000_000_000).toFixed(6)} SOL</p>
      )}
      <p>{asset.reason}</p>
      {asset.metadata?.nftMarketData && asset.metadata.nftMarketData.marketExists && (
        <p>
          Market evidence · {asset.metadata.nftMarketData.source}
          {asset.metadata.nftMarketData.activityCount !== null && asset.metadata.nftMarketData.activityCount !== undefined
            ? ` · ${asset.metadata.nftMarketData.activityCount} recent activities`
            : ""}
        </p>
      )}
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
