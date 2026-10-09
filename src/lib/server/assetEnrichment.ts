import "server-only";
import { Asset } from "../types";
import { getSolanaEnrichmentConfig } from "./config";
import { AssetMetadata, getAssetsByMints, getAssetsByOwner } from "./quicknodeProvider";
import { shortenAddress } from "../solana/format";
import { getBatchTokenPrices, getTokenMarketData } from "./marketData";
import { evaluateAssetEligibility } from "../solana/validation/eligibility";
import type { EligibilityEvidence } from "../types";
import { classifyNftMarket, getNftMarketDataBatch } from "./openSeaProvider";
import { getMagicEdenMarketDataBatch } from "./magicEdenProvider";
import { getDb } from "./db/client";
import { findAssetKnowledge, upsertAssetKnowledgeBatch } from "./repositories/assetKnowledgeRepo";
import { getEnrichmentMetrics, recordDatabaseOperation, recordKnowledgeMetric, recordPhaseTiming, recordProviderRequestsAvoided, resetEnrichmentMetrics } from "./enrichmentMetrics";

export type EnrichmentStatus = "AVAILABLE" | "UNAVAILABLE";

function classifyFungible(metadata: AssetMetadata, threshold: number): NonNullable<Asset["valueClassification"]> {
  if (metadata.marketData?.routeStatus === "NO_ROUTE") return "FUNGIBLE_NO_LIQUIDITY";
  if (metadata.marketStatus === "NO_MARKET") return "FUNGIBLE_NO_MARKET";
  if (metadata.valueUsd === null) return "FUNGIBLE_UNKNOWN_VALUE";
  return metadata.valueUsd >= threshold ? "FUNGIBLE_VALUABLE" : "FUNGIBLE_LOW_VALUE";
}

function classifyNft(metadata: AssetMetadata, threshold: number): NonNullable<Asset["valueClassification"]> {
  if (!metadata.nftMarketData) return "NFT_UNKNOWN_VALUE";
  return classifyNftMarket(metadata.nftMarketData, threshold).classification;
}

export interface EnrichmentResult {
  assets: Asset[];
  status: EnrichmentStatus;
  reason?: string;
}

function eligibilityEvidence(
  classification: NonNullable<Asset["valueClassification"]>,
  marketData: AssetMetadata["marketData"],
  metadata?: { priceUsd: number | null; valueUsd: number | null; source: string }
): EligibilityEvidence {
  return {
    assetType:
      classification === "EMPTY_ACCOUNT"
        ? "EMPTY_ACCOUNT"
        : classification.startsWith("NFT_")
          ? "NFT"
          : "FUNGIBLE",
    classification,
    eligibility: evaluateAssetEligibility(classification),
    confidence: marketData?.confidence ?? "UNKNOWN",
    priceUsd: metadata?.priceUsd ?? null,
    estimatedValueUsd: metadata?.valueUsd ?? null,
    liquidityUsd: marketData?.liquidityUsd ?? null,
    priceSource:
      metadata?.priceUsd !== null && metadata?.priceUsd !== undefined
        ? marketData?.priceStatus === "AVAILABLE"
          ? marketData.source
          : metadata.source
        : null,
    liquiditySource: marketData?.routeStatus === "ROUTE_AVAILABLE" || marketData?.routeStatus === "NO_ROUTE" ? marketData.source : null,
    routeStatus: marketData?.routeStatus ?? null,
    priceImpactBps: marketData?.priceImpactBps ?? null,
    marketplace: null,
    floorUsd: null,
    bestListingUsd: null,
    bestOfferUsd: null,
    evidenceSources: [
      ...(metadata?.source ? [metadata.source] : []),
      ...(marketData?.source ? [marketData.source] : []),
    ],
    checkedAt: marketData?.checkedAt ?? null,
  };
}

function attachEligibility(asset: Asset): Asset {
  if (!asset.valueClassification) return asset;
  const eligibility = evaluateAssetEligibility(asset.valueClassification);
  return {
    ...asset,
    eligibility,
    eligibilityEvidence: eligibilityEvidence(asset.valueClassification, asset.metadata?.marketData, asset.metadata),
  };
}

function classificationReason(
  classification: NonNullable<Asset["valueClassification"]>,
  source: string,
  valueKnown: boolean
): string {
  if (classification === "EMPTY_ACCOUNT") return "Empty token account; recoverable rent is shown when the account is closeable.";
  if (classification === "FUNGIBLE_NO_LIQUIDITY") return "No executable market route found; retained as eligible evidence.";
  if (classification === "FUNGIBLE_LOW_VALUE" || classification === "NFT_LOW_VALUE") {
    return valueKnown ? `Estimated value is below the configured threshold; enriched by ${source}.` : "Estimated value is below the configured threshold.";
  }
  if (classification === "FUNGIBLE_VALUABLE" || classification === "NFT_VALUABLE") {
    return `Estimated value available from ${source}; not eligible under the conservative rules.`;
  }
  if (classification === "NFT_NO_MARKET") return "No NFT market evidence was found; retained as a candidate for review.";
  if (classification.includes("UNKNOWN")) return "Market data unavailable; unknown assets are never counted toward allocation.";
  return "Retained for review under the conservative eligibility rules.";
}

export async function enrichSolanaAssets(owner: string, assets: Asset[]): Promise<EnrichmentResult> {
  resetEnrichmentMetrics();
  const result = await getAssetsByOwner(owner);
  if (result.status === "UNAVAILABLE") {
    return { assets: assets.map(attachEligibility), status: "UNAVAILABLE", reason: result.reason };
  }

  const {
    minTokenValueUsd,
    maxQuoteCandidates,
    openSeaApiKey,
    magicEdenApiKey,
    tokenMarketTtlMs,
    nftMarketTtlMs,
    maxNftMarketCandidates,
    enrichmentTimeBudgetMs,
  } = getSolanaEnrichmentConfig();
  const enrichmentStartedAt = Date.now();
  const phaseStartedAt = enrichmentStartedAt;
  const rawTokenMints = assets
    .filter((asset) => asset.kind === "TOKEN" && asset.mint)
    .map((asset) => asset.mint as string);
  const fallback = await getAssetsByMints(rawTokenMints.filter((mint) => !result.assets.some((asset) => asset.mint === mint)));
  const byMint = new Map([...result.assets, ...fallback.assets].map((metadata) => [metadata.mint, metadata]));
  const cacheDb = process.env.NODE_ENV === "test" ? null : await getDb();
  const cachedKnowledge = cacheDb
    ? await findAssetKnowledge(cacheDb, [...byMint.values()].map((metadata) => ({
        assetType: metadata.assetType,
        assetId: metadata.assetId,
        mint: metadata.mint,
      })))
    : new Map();
  recordPhaseTiming("knowledge_lookup", Date.now() - phaseStartedAt);
  const freshKnowledge = new Set<string>();
  let cacheHits = 0;
  for (const metadata of byMint.values()) {
    const cached = cachedKnowledge.get(`${metadata.assetType}:${metadata.assetType === "FUNGIBLE" ? metadata.mint : metadata.assetId}`);
    if (!cached) continue;
    cacheHits += 1;
    recordKnowledgeMetric("knowledge_hits");
    if (cached.coverageStatus === "DEFERRED") {
      recordKnowledgeMetric("deferred_hits");
      continue;
    }
    if (cached.coverageStatus === "UNSUPPORTED") {
      recordKnowledgeMetric("unsupported_hits");
      continue;
    }
    if (cached.coverageStatus === "PROVIDER_UNAVAILABLE" && cached.nextRetryAt && Date.parse(cached.nextRetryAt) > Date.now()) {
      recordKnowledgeMetric("provider_unavailable_hits");
      continue;
    }
    const ttlMs = metadata.assetType === "FUNGIBLE" ? tokenMarketTtlMs : nftMarketTtlMs;
    const isFresh = cached.coverageStatus === "CHECKED" &&
      cached.lastCheckedAt !== null &&
      Date.parse(cached.lastCheckedAt) + ttlMs > Date.now();
    if (!isFresh) {
      recordKnowledgeMetric("stale_records");
      metadata.marketData = undefined;
      metadata.nftMarketData = undefined;
      continue;
    }
    freshKnowledge.add(`${metadata.assetType}:${metadata.assetType === "FUNGIBLE" ? metadata.mint : metadata.assetId}`);
    recordKnowledgeMetric("fresh_hits");
    const evidence = cached.evidence;
    if (evidence.marketData) metadata.marketData = evidence.marketData as AssetMetadata["marketData"];
    if (evidence.nftMarketData) metadata.nftMarketData = evidence.nftMarketData as AssetMetadata["nftMarketData"];
    if (typeof evidence.priceUsd === "number" || evidence.priceUsd === null) metadata.priceUsd = evidence.priceUsd as number | null;
    if (typeof evidence.valueUsd === "number" || evidence.valueUsd === null) metadata.valueUsd = evidence.valueUsd as number | null;
    if (typeof evidence.marketStatus === "string") metadata.marketStatus = evidence.marketStatus as AssetMetadata["marketStatus"];
  }
  const fungibleMetadata = [...byMint.values()].filter((metadata) => metadata.assetType === "FUNGIBLE");
  const uncachedFungibles = fungibleMetadata.filter((metadata) =>
    !freshKnowledge.has(`FUNGIBLE:${metadata.mint}`) && !metadata.marketData
  );
  const pricesStartedAt = Date.now();
  const prices = Date.now() - enrichmentStartedAt < enrichmentTimeBudgetMs
    ? await getBatchTokenPrices(uncachedFungibles.map((metadata) => metadata.mint))
    : new Map<string, number>();
  recordPhaseTiming("jupiter_prices", Date.now() - pricesStartedAt);
  const quoteCandidates = [...new Map(
    assets
      .filter((asset) => asset.kind === "TOKEN" && asset.rawBalance !== "0" && asset.decimals !== undefined && asset.mint)
      .map((asset) => [asset.mint, asset])
  ).values()].filter((asset) =>
    !freshKnowledge.has(`FUNGIBLE:${asset.mint}`) &&
    !byMint.get(asset.mint!)?.marketData
  )
    .sort((a, b) => {
      const score = (asset: Asset) =>
        (byMint.get(asset.mint!)?.priceUsd !== null ? 4 : 0) +
        (byMint.get(asset.mint!)?.name ? 2 : 0) +
        (byMint.get(asset.mint!)?.symbol ? 1 : 0) +
        (asset.rawBalance && asset.rawBalance !== "0" ? 1 : 0);
      return score(b) - score(a) || (a.mint ?? "").localeCompare(b.mint ?? "");
    })
    .slice(0, maxQuoteCandidates);
  const marketByMint = new Map<string, Awaited<ReturnType<typeof getTokenMarketData>>>();
  let quoteCursor = 0;
  const quotesStartedAt = Date.now();
  if (Date.now() - enrichmentStartedAt < enrichmentTimeBudgetMs) await Promise.all(
    Array.from({ length: Math.min(4, quoteCandidates.length) }, async () => {
      while (quoteCursor < quoteCandidates.length) {
        const asset = quoteCandidates[quoteCursor++];
        const market = await getTokenMarketData(asset.mint as string, asset.decimals as number);
        marketByMint.set(asset.mint as string, market);
      }
    })
  );
  recordPhaseTiming("jupiter_quotes", Date.now() - quotesStartedAt);
  const nftMints = [...byMint.values()].filter(
    (metadata) => metadata.assetType === "NFT" || metadata.assetType === "COMPRESSED_NFT"
  );
  const rankedNfts = [...nftMints].sort((a, b) =>
    (Number(Boolean(b.verifiedCollection)) - Number(Boolean(a.verifiedCollection))) ||
    (Number(Boolean(b.collectionAddress)) - Number(Boolean(a.collectionAddress))) ||
    a.assetId.localeCompare(b.assetId)
  );
  const eligibleNfts = rankedNfts.filter((metadata) => {
    const key = `${metadata.assetType}:${metadata.assetId}`;
    if (freshKnowledge.has(key)) return false;
    const cached = cachedKnowledge.get(key);
    return !(cached?.coverageStatus === "UNSUPPORTED" ||
    ((cached?.coverageStatus === "PROVIDER_UNAVAILABLE" || cached?.coverageStatus === "DEFERRED") &&
      cached.nextRetryAt && Date.parse(cached.nextRetryAt) > Date.now()));
  });
  const selectedNfts = eligibleNfts.slice(0, maxNftMarketCandidates);
  const uncachedNfts = selectedNfts.filter((metadata) => !metadata.nftMarketData);
  const regularNfts = uncachedNfts.filter((metadata) => metadata.assetType === "NFT");
  const compressedNfts = uncachedNfts.filter((metadata) => metadata.assetType === "COMPRESSED_NFT");
  const nftStartedAt = Date.now();
  const nftMarketByAssetId = Date.now() - enrichmentStartedAt < enrichmentTimeBudgetMs
    ? await getNftMarketDataBatch(
    regularNfts.map((metadata) => ({
      assetId: metadata.assetId,
      mint: metadata.mint,
      assetType: metadata.assetType,
      collectionAddress: metadata.collectionAddress,
      compression: metadata.compression,
    })),
    openSeaApiKey
  )
    : new Map();
  const magicEdenMarketByAssetId = Date.now() - enrichmentStartedAt < enrichmentTimeBudgetMs
    ? await getMagicEdenMarketDataBatch(
    compressedNfts.map((metadata) => ({ assetId: metadata.assetId, assetType: metadata.assetType })),
    magicEdenApiKey
  )
    : new Map();
  recordPhaseTiming("nft_marketplaces", Date.now() - nftStartedAt);
  for (const metadata of nftMints) {
    metadata.nftMarketData ??= metadata.assetType === "COMPRESSED_NFT"
      ? magicEdenMarketByAssetId.get(metadata.assetId)
      : nftMarketByAssetId.get(metadata.assetId);
    const marketClassification = metadata.nftMarketData
      ? classifyNftMarket(metadata.nftMarketData, minTokenValueUsd)
      : { classification: "NFT_UNKNOWN_VALUE" as const, valueUsd: null };
    metadata.valueUsd = marketClassification.valueUsd;
    metadata.marketStatus =
      metadata.nftMarketData?.status === "NO_MARKET" ? "NO_MARKET" : metadata.nftMarketData?.status === "PROVIDER_UNAVAILABLE" ? "ERROR" : metadata.nftMarketData?.status === "AVAILABLE" ? "AVAILABLE" : "UNKNOWN";
  }
  for (const metadata of fungibleMetadata) {
    const priceUsd = prices.get(metadata.mint) ?? metadata.priceUsd;
    const marketData = metadata.marketData ?? marketByMint.get(metadata.mint);
    if (priceUsd !== undefined || marketData) {
      metadata.priceUsd = priceUsd ?? null;
      metadata.valueUsd = priceUsd !== null && priceUsd !== undefined ? priceUsd : metadata.valueUsd;
      metadata.marketData = marketData
        ? {
            ...marketData,
            priceUsd: priceUsd ?? marketData.priceUsd,
            priceStatus: priceUsd !== undefined && priceUsd !== null ? "AVAILABLE" : marketData.priceStatus,
          }
        : undefined;
    }
  }
  if (cacheDb) {
    const records = [];
    for (const metadata of byMint.values()) {
    const isNft = metadata.assetType === "NFT" || metadata.assetType === "COMPRESSED_NFT";
    const cached = cachedKnowledge.get(`${metadata.assetType}:${metadata.assetType === "FUNGIBLE" ? metadata.mint : metadata.assetId}`);
    const providerUnavailable = metadata.nftMarketData?.status === "PROVIDER_UNAVAILABLE" ||
      metadata.marketData?.routeStatus === "PROVIDER_UNAVAILABLE";
    const coverageStatus: "CHECKED" | "DEFERRED" | "UNSUPPORTED" | "PROVIDER_UNAVAILABLE" =
      metadata.assetType === "OTHER" || metadata.assetType === "UNKNOWN"
      ? "UNSUPPORTED"
      : providerUnavailable
        ? "PROVIDER_UNAVAILABLE"
        : isNft && !metadata.nftMarketData && cached?.coverageStatus !== "CHECKED"
          ? "DEFERRED"
          : "CHECKED";
    const classification = coverageStatus === "DEFERRED" || coverageStatus === "UNSUPPORTED" || coverageStatus === "PROVIDER_UNAVAILABLE"
      ? null
      : metadata.assetType === "FUNGIBLE"
      ? classifyFungible(metadata, minTokenValueUsd)
      : classifyNft(metadata, minTokenValueUsd);
    records.push({
      input: {
      assetType: metadata.assetType,
      assetId: metadata.assetId,
      mintAddress: metadata.mint,
      collectionAddress: metadata.collectionAddress,
      name: metadata.name,
      symbol: metadata.symbol,
      decimals: null,
      tokenProgram: null,
      compressed: metadata.compression?.compressed ?? null,
      classification,
      eligibility: classification ? evaluateAssetEligibility(classification) : "NOT_ELIGIBLE",
      confidence: metadata.nftMarketData?.confidence ?? metadata.marketData?.confidence ?? "UNKNOWN",
      evidence: {
        priceUsd: metadata.priceUsd,
        valueUsd: metadata.valueUsd,
        marketStatus: metadata.marketStatus,
        marketData: metadata.marketData ?? null,
        nftMarketData: metadata.nftMarketData ?? null,
      },
      metadataStatus: metadata.metadataStatus,
      providerStatus: providerUnavailable ? "UNAVAILABLE" : "SUCCESS",
      lastCheckedAt: coverageStatus === "CHECKED"
        ? metadata.nftMarketData?.checkedAt ?? metadata.marketData?.checkedAt ?? new Date().toISOString()
        : cached?.lastCheckedAt ?? null,
      nextRefreshAt: null,
      coverageStatus,
      nextRetryAt: providerUnavailable || coverageStatus === "DEFERRED"
        ? new Date(Date.now() + 5 * 60_000).toISOString()
        : null,
      },
      ttlMs: coverageStatus === "CHECKED"
      ? metadata.assetType === "FUNGIBLE" ? tokenMarketTtlMs : nftMarketTtlMs
      : null,
    });
    }
    const persistenceStartedAt = Date.now();
    const result = await upsertAssetKnowledgeBatch(cacheDb, records);
    recordDatabaseOperation();
    recordPhaseTiming("knowledge_persistence", Date.now() - persistenceStartedAt);
    for (let i = 0; i < result.created; i += 1) recordKnowledgeMetric("records_created");
    for (let i = 0; i < result.updated; i += 1) recordKnowledgeMetric("records_updated");
    for (let i = cacheHits; i < byMint.size; i += 1) recordKnowledgeMetric("knowledge_misses");
    recordProviderRequestsAvoided([...freshKnowledge].length);
    console.info("[asset-knowledge] coverage", {
    hits: cacheHits,
    total: byMint.size,
    misses: byMint.size - cacheHits,
    providerRequests: getEnrichmentMetrics(),
    });
    recordPhaseTiming("total_enrichment", Date.now() - enrichmentStartedAt);
  }
  const rawMints = new Set(assets.map((asset) => asset.mint).filter((mint): mint is string => Boolean(mint)));
  const enrichedRawAssets = assets.map((asset): Asset => {
      if (!asset.mint || asset.kind === "ACCOUNT") return asset;
      const sourceMetadata = byMint.get(asset.mint);
      if (!sourceMetadata) return asset;
      const metadata = { ...sourceMetadata };
      const priceUsd = prices.get(metadata.mint) ?? metadata.priceUsd;
      if (priceUsd !== null && priceUsd !== undefined && asset.rawBalance && asset.decimals !== undefined) {
        const units = Number(asset.rawBalance) / 10 ** asset.decimals;
        metadata.priceUsd = priceUsd;
        metadata.valueUsd = Number.isFinite(units) ? units * priceUsd : null;
      }
      metadata.marketData = metadata.marketData ?? marketByMint.get(asset.mint);
      const nft =
        metadata.assetType === "NFT" ||
        metadata.assetType === "COMPRESSED_NFT" ||
        (metadata.assetType === "UNKNOWN" && asset.kind === "NFT");
      const valueClassification = nft ? classifyNft(metadata, minTokenValueUsd) : classifyFungible(metadata, minTokenValueUsd);
      const eligibility = evaluateAssetEligibility(valueClassification);
      const allocationCandidate =
        valueClassification === "FUNGIBLE_UNKNOWN_VALUE" ||
        valueClassification === "NFT_UNKNOWN_VALUE" ||
        valueClassification === "NFT_REVIEW";
      const valueKnown = metadata.valueUsd !== null;
      return {
        ...asset,
        status: allocationCandidate ? "CULLABLE" : asset.status,
        kind: nft ? "NFT" : metadata.assetType === "FUNGIBLE" ? "TOKEN" : asset.kind,
        name: metadata.name ?? asset.name,
        ticker: metadata.symbol ?? asset.ticker,
        value: valueKnown ? `$${metadata.valueUsd!.toFixed(2)}` : "UNKNOWN VALUE",
        valueKnown,
        valueClassification,
        eligibility,
        eligibilityEvidence: {
          ...eligibilityEvidence(valueClassification, metadata.marketData, metadata),
          assetType: nft ? (metadata.assetType === "COMPRESSED_NFT" ? "COMPRESSED_NFT" : "NFT") : "FUNGIBLE",
          confidence: metadata.nftMarketData?.confidence ?? metadata.marketData?.confidence ?? "UNKNOWN",
          marketplace: metadata.nftMarketData?.source ?? null,
          floorUsd: metadata.nftMarketData?.floorPriceUsd ?? null,
          bestListingUsd: metadata.nftMarketData?.bestListing ?? null,
          bestOfferUsd: metadata.nftMarketData?.bestOffer ?? null,
          evidenceSources: [
            metadata.source,
            ...(metadata.marketData?.source ? [metadata.marketData.source] : []),
            ...(metadata.nftMarketData?.source ? [metadata.nftMarketData.source] : []),
          ],
        },
        metadata: {
          assetType: metadata.assetType,
          imageUrl: metadata.imageUrl,
          collection: metadata.collection,
          collectionAddress: metadata.collectionAddress,
          verifiedCollection: metadata.verifiedCollection,
          priceUsd: metadata.priceUsd,
          valueUsd: metadata.valueUsd,
          marketStatus: metadata.marketStatus,
          marketData: metadata.marketData,
          nftMarketData: metadata.nftMarketData,
          liquidityUsd: null,
          metadataStatus: metadata.metadataStatus,
          source: metadata.source,
        },
        reason: classificationReason(valueClassification, metadata.source, valueKnown),
      };
    });
  const dasOnlyAssets = result.assets
    .filter((metadata) => !rawMints.has(metadata.mint))
    .map((metadata): Asset => {
      const nft = metadata.assetType === "NFT" || metadata.assetType === "COMPRESSED_NFT";
      const valueKnown = metadata.valueUsd !== null;
      const valueClassification = nft ? classifyNft(metadata, minTokenValueUsd) : classifyFungible(metadata, minTokenValueUsd);
      const eligibility = evaluateAssetEligibility(valueClassification);
      const allocationCandidate =
        valueClassification === "FUNGIBLE_UNKNOWN_VALUE" ||
        valueClassification === "NFT_UNKNOWN_VALUE" ||
        valueClassification === "NFT_REVIEW";
      return {
        id: `das-${metadata.mint}`,
        name: metadata.name ?? (nft ? "NFT asset" : "Fungible token"),
        ticker: metadata.symbol ?? (nft ? "NFT" : metadata.mint.slice(0, 4).toUpperCase()),
        kind: nft ? "NFT" : "TOKEN",
        address: shortenAddress(metadata.mint),
        status: allocationCandidate ? "CULLABLE" : nft ? "WATCH" : "REVIEW",
        age: "—",
        value: valueKnown ? `$${metadata.valueUsd!.toFixed(2)}` : "UNKNOWN",
        valueKnown,
        reason: `${classificationReason(valueClassification, metadata.source, valueKnown)} DAS asset has no matching raw token account.`,
        action: nft ? "ADD TO WATCH" : "REVIEW",
        mint: metadata.mint,
        valueClassification,
        eligibility,
        eligibilityEvidence: {
          ...eligibilityEvidence(valueClassification, metadata.marketData, metadata),
          assetType: nft ? (metadata.assetType === "COMPRESSED_NFT" ? "COMPRESSED_NFT" : "NFT") : "FUNGIBLE",
          confidence: metadata.nftMarketData?.confidence ?? metadata.marketData?.confidence ?? "UNKNOWN",
          marketplace: metadata.nftMarketData?.source ?? null,
          floorUsd: metadata.nftMarketData?.floorPriceUsd ?? null,
          bestListingUsd: metadata.nftMarketData?.bestListing ?? null,
          bestOfferUsd: metadata.nftMarketData?.bestOffer ?? null,
          evidenceSources: [
            metadata.source,
            ...(metadata.marketData?.source ? [metadata.marketData.source] : []),
            ...(metadata.nftMarketData?.source ? [metadata.nftMarketData.source] : []),
          ],
        },
        metadata: {
          assetType: metadata.assetType,
          imageUrl: metadata.imageUrl,
          collection: metadata.collection,
          collectionAddress: metadata.collectionAddress,
          verifiedCollection: metadata.verifiedCollection,
          priceUsd: metadata.priceUsd,
          valueUsd: metadata.valueUsd,
          marketStatus: metadata.marketStatus,
          marketData: metadata.marketData,
          nftMarketData: metadata.nftMarketData,
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
