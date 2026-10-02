import "server-only";
import { AssetClassification } from "@/lib/salvage/registry";
import { Db } from "../db/types";

export async function ensureAsset(db: Db, input: { mint: string; kind: "TOKEN" | "NFT"; chain?: string }): Promise<{ id: string }> {
  const chain = input.chain ?? "solana";
  const result = await db.query<{ id: string }>(
    `INSERT INTO assets (chain, mint, kind) VALUES ($1, $2, $3)
     ON CONFLICT (chain, mint) DO UPDATE SET chain = EXCLUDED.chain
     RETURNING id`,
    [chain, input.mint, input.kind]
  );
  return { id: result.rows[0].id };
}

export async function recordClassification(
  db: Db,
  input: { assetId: string; classification: AssetClassification; source: string; confidence?: number }
): Promise<void> {
  await db.query(
    `INSERT INTO asset_classifications (asset_id, classification, source, confidence) VALUES ($1, $2, $3, $4)`,
    [input.assetId, input.classification, input.source, input.confidence ?? 1.0]
  );
}
