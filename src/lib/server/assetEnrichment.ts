import "server-only";
import { Asset } from "../types";
import { getSolanaEnrichmentConfig } from "./config";
import { AssetMetadata, getAssetsByOwner } from "./quicknodeProvider";
import { shortenAddress } from "../solana/format";

export type EnrichmentStatus = "AVAILABLE" | "UNAVAILABLE";

function classifyFungible(metadata: AssetMetadata, threshold: number): Asset["valueClassification"] {
  if (metadata.liquidityStatus === "NO_MARKET") return "FUNGIBLE_NO_LIQUIDITY";
  if (metadata.marketStatus === "NO_MARKET") return "FUNGIBLE_NO_MARKET";
  if (metadata.valueUsd === null) return "FUNGIBLE_UNKNOWN_VALUE";
  return metadata.valueUsd >= threshold ? "FUNGIBLE_VALUABLE" : "FUNGIBLE_LOW_VALUE";
}

function classifyNft(metadata: AssetMetadata, threshold: number): Asset["valueClassification"] {
  if (metadata.assetType === "OTHER") return "NFT_REVIEW";
  if (metadata.marketStatus === "NO_MARKET") return "NFT_NO_MARKET";
  if (metadata.valueUsd === null) return "NFT_UNKNOWN_VALUE";
  return metadata.valueUsd >= threshold ? "NFT_VALUABLE" : "NFT_LOW_VALUE";
}

export interface EnrichmentResult {
  assets: Asset[];
  status: EnrichmentStatus;
  reason?: string;
}

export async function enrichSolanaAssets(owner: string, assets: Asset[]): Promise<EnrichmentResult> {
  const result = await getAssetsByOwner(owner);
  if (result.status === "UNAVAILABLE") return { assets, status: "UNAVAILABLE", reason: result.reason };

  const { minTokenValueUsd } = getSolanaEnrichmentConfig();
  const byMint = new Map(result.assets.map((metadata) => [metadata.mint, metadata]));
  const rawMints = new Set(assets.map((asset) => asset.mint).filter((mint): mint is string => Boolean(mint)));
  const enrichedRawAssets = assets.map((asset) => {
      if (!asset.mint || asset.kind === "ACCOUNT") return asset;
      const metadata = byMint.get(asset.mint);
      if (!metadata) return asset;
      const nft =
        metadata.assetType === "NFT" ||
        metadata.assetType === "COMPRESSED_NFT" ||
        (metadata.assetType === "UNKNOWN" && asset.kind === "NFT");
      const valueClassification = nft ? classifyNft(metadata, minTokenValueUsd) : classifyFungible(metadata, minTokenValueUsd);
      const valueKnown = metadata.valueUsd !== null;
      return {
        ...asset,
        kind: nft ? "NFT" : metadata.assetType === "FUNGIBLE" ? "TOKEN" : asset.kind,
        name: metadata.name ?? asset.name,
        ticker: metadata.symbol ?? asset.ticker,
        value: valueKnown ? `$${metadata.valueUsd!.toFixed(2)}` : "UNKNOWN VALUE",
        valueKnown,
        valueClassification,
        metadata: {
          imageUrl: metadata.imageUrl,
          collection: metadata.collection,
          collectionAddress: metadata.collectionAddress,
          verifiedCollection: metadata.verifiedCollection,
          priceUsd: metadata.priceUsd,
          valueUsd: metadata.valueUsd,
          marketStatus: metadata.marketStatus,
          liquidityUsd: null,
          metadataStatus: metadata.metadataStatus,
          source: metadata.source,
        },
        reason: valueKnown ? `Enriched by ${metadata.source}; market status: ${metadata.marketStatus.toLowerCase()}.` : "Value data is unavailable; retained for review.",
      };
    });
  const dasOnlyAssets = result.assets
    .filter((metadata) => !rawMints.has(metadata.mint))
    .map((metadata): Asset => {
      const nft = metadata.assetType === "NFT" || metadata.assetType === "COMPRESSED_NFT";
      const valueKnown = metadata.valueUsd !== null;
      return {
        id: `das-${metadata.mint}`,
        name: metadata.name ?? (nft ? "NFT asset" : "Fungible token"),
        ticker: metadata.symbol ?? (nft ? "NFT" : metadata.mint.slice(0, 4).toUpperCase()),
        kind: nft ? "NFT" : "TOKEN",
        address: shortenAddress(metadata.mint),
        status: nft ? "WATCH" : "REVIEW",
        age: "—",
        value: valueKnown ? `$${metadata.valueUsd!.toFixed(2)}` : "UNKNOWN",
        valueKnown,
        reason: nft
          ? "DAS asset detected without a raw token account; retained for NFT review."
          : "DAS asset detected without a matching raw token account; retained for review.",
        action: nft ? "ADD TO WATCH" : "REVIEW",
        mint: metadata.mint,
        valueClassification: nft ? classifyNft(metadata, minTokenValueUsd) : classifyFungible(metadata, minTokenValueUsd),
        metadata: {
          imageUrl: metadata.imageUrl,
          collection: metadata.collection,
          collectionAddress: metadata.collectionAddress,
          verifiedCollection: metadata.verifiedCollection,
          priceUsd: metadata.priceUsd,
          valueUsd: metadata.valueUsd,
          marketStatus: metadata.marketStatus,
          metadataStatus: metadata.metadataStatus,
          source: metadata.source,
        },
      };
    });
  return {
    status: "AVAILABLE",
    assets: [...enrichedRawAssets, ...dasOnlyAssets],
  };
}
