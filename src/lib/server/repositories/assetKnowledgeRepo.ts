import "server-only";
import type { AssetMetadata } from "../quicknodeProvider";
import type { Db } from "../db/types";

export type AssetKnowledgeRecord = {
  assetType: AssetMetadata["assetType"];
  assetId: string;
  mintAddress: string | null;
  collectionAddress: string | null;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  tokenProgram: string | null;
  compressed: boolean | null;
  classification: string | null;
  eligibility: string | null;
  confidence: string | null;
  evidence: Record<string, unknown>;
  metadataStatus: string;
  providerStatus: string;
  lastCheckedAt: string | null;
  nextRefreshAt: string | null;
  coverageStatus: "CHECKED" | "DEFERRED" | "UNSUPPORTED" | "PROVIDER_UNAVAILABLE";
  nextRetryAt: string | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  scanCount?: number;
};

export async function findAssetKnowledge(
  db: Db,
  assets: Array<Pick<AssetMetadata, "assetType" | "assetId" | "mint">>
): Promise<Map<string, AssetKnowledgeRecord>> {
  if (!assets.length) return new Map();
  const result = await db.query<AssetKnowledgeRecord & { asset_type: AssetMetadata["assetType"]; asset_id: string; mint_address: string | null }>(
    `SELECT asset_type AS "assetType", asset_id AS "assetId", mint_address AS "mintAddress",
      collection_address AS "collectionAddress", name, symbol, decimals,
      token_program AS "tokenProgram", compressed, classification, eligibility,
      confidence, evidence, metadata_status AS "metadataStatus",
      provider_status AS "providerStatus", last_checked_at AS "lastCheckedAt",
      next_refresh_at AS "nextRefreshAt", coverage_status AS "coverageStatus",
      next_retry_at AS "nextRetryAt", first_seen_at AS "firstSeenAt",
      last_seen_at AS "lastSeenAt", scan_count AS "scanCount"
     FROM asset_knowledge
     WHERE network = 'solana'
       AND (asset_id = ANY($1) OR mint_address = ANY($1))`,
    [[...new Set(assets.flatMap((asset) => [asset.assetId, asset.mint]))].filter(Boolean)]
  );
  return new Map(result.rows.flatMap((row) => [
    [`${row.assetType}:${row.assetId}`, row],
    ...(row.mintAddress ? [[`${row.assetType}:${row.mintAddress}`, row] as const] : []),
  ]));
}

export async function findFreshAssetKnowledge(
  db: Db,
  assets: Array<Pick<AssetMetadata, "assetType" | "assetId" | "mint">>
): Promise<Map<string, AssetKnowledgeRecord>> {
  const all = await findAssetKnowledge(db, assets);
  const now = Date.now();
  return new Map([...all].filter(([, record]) =>
    record.coverageStatus === "CHECKED" &&
    record.nextRefreshAt !== null &&
    Date.parse(record.nextRefreshAt) > now
  ));
}

export async function upsertAssetKnowledge(db: Db, input: AssetKnowledgeRecord, ttlMs: number | null): Promise<"created" | "updated"> {
  const result = await upsertAssetKnowledgeBatch(db, [{ input, ttlMs }]);
  return result.updated > 0 ? "updated" : "created";
}

const BATCH_SIZE = 200;

export async function upsertAssetKnowledgeBatch(
  db: Db,
  records: Array<{ input: AssetKnowledgeRecord; ttlMs: number | null }>
): Promise<{ created: number; updated: number; operations: number }> {
  let created = 0;
  let updated = 0;
  let operations = 0;
  for (let offset = 0; offset < records.length; offset += BATCH_SIZE) {
    const chunk = records.slice(offset, offset + BATCH_SIZE);
    const values: unknown[] = [];
    const placeholders = chunk.map(({ input, ttlMs }, index) => {
      const base = index * 19;
      values.push(
        input.assetType, input.assetId, input.mintAddress, input.collectionAddress,
        input.name, input.symbol, input.decimals, input.tokenProgram, input.compressed,
        input.classification, input.eligibility, input.confidence, JSON.stringify(input.evidence),
        input.metadataStatus, input.providerStatus, input.lastCheckedAt, ttlMs,
        input.nextRetryAt, input.coverageStatus
      );
      return `('solana', $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5},
        $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11},
        $${base + 12}, $${base + 13}::jsonb, $${base + 14}, $${base + 15}, now(), $${base + 16},
        CASE WHEN $${base + 17}::bigint IS NULL THEN NULL ELSE now() + ($${base + 17}::bigint * interval '1 millisecond') END,
        $${base + 18}, $${base + 19}, 1, now())`;
    });
    const result = await db.query<{ created: boolean }>(
      `INSERT INTO asset_knowledge (
      network, asset_type, asset_id, mint_address, collection_address, name, symbol,
      decimals, token_program, compressed, classification, eligibility, confidence,
      evidence, metadata_status, provider_status, last_seen_at, last_checked_at,
      next_refresh_at, next_retry_at, coverage_status, scan_count, updated_at
    ) VALUES ${placeholders.join(",")}
    ON CONFLICT (network, asset_type, asset_id) DO UPDATE SET
      mint_address = EXCLUDED.mint_address, collection_address = EXCLUDED.collection_address,
      name = EXCLUDED.name, symbol = EXCLUDED.symbol, decimals = EXCLUDED.decimals,
      token_program = EXCLUDED.token_program, compressed = EXCLUDED.compressed,
      classification = EXCLUDED.classification, eligibility = EXCLUDED.eligibility,
      confidence = EXCLUDED.confidence, evidence = EXCLUDED.evidence,
      metadata_status = EXCLUDED.metadata_status, provider_status = EXCLUDED.provider_status,
      last_seen_at = now(), last_checked_at = EXCLUDED.last_checked_at,
      next_refresh_at = EXCLUDED.next_refresh_at, next_retry_at = EXCLUDED.next_retry_at,
      coverage_status = EXCLUDED.coverage_status, scan_count = asset_knowledge.scan_count + 1,
      updated_at = now()
    RETURNING (xmax = 0) AS created`,
      values
    );
    operations += 1;
    for (const row of result.rows) {
      if (row.created) created += 1;
      else updated += 1;
    }
  }
  return { created, updated, operations };
}

export async function listAssetKnowledge(db: Db): Promise<Array<Record<string, unknown>>> {
  const result = await db.query(`SELECT * FROM asset_knowledge ORDER BY network, asset_type, asset_id`);
  return result.rows;
}
