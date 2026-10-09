export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/server/db/client";
import { DevAuthError, assertDevAuthorized } from "@/lib/server/devAuth";
import { listAssetKnowledge } from "@/lib/server/repositories/assetKnowledgeRepo";

function csvValue(value: unknown): string {
  const text = value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(req: NextRequest) {
  try {
    assertDevAuthorized(req);
  } catch (error) {
    if (error instanceof DevAuthError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }

  const db = await getDb();
  const rows = await listAssetKnowledge(db);
  const columns = [
    "network", "asset_type", "asset_id", "mint_address", "collection_address",
    "name", "symbol", "classification", "eligibility", "confidence", "evidence",
    "coverage_status", "metadata_status", "provider_status", "first_seen_at", "last_seen_at",
    "last_checked_at", "next_refresh_at", "scan_count",
  ];
  const csv = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvValue(row[column])).join(",")),
  ].join("\n");

  return new NextResponse(`${csv}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="culler-asset-knowledge-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
