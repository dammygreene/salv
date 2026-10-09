export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/server/db/client";
import { DevAuthError, assertDevAuthorized } from "@/lib/server/devAuth";
import { createEpoch, listEpochs } from "@/lib/server/repositories/epochRepo";
import { DEFAULT_ALLOCATION_POLICY } from "@/lib/cull/allocationPolicy";
import { getCullerTokensPerPoint } from "@/lib/server/config";

export async function GET(req: NextRequest) {
  try {
    assertDevAuthorized(req);
  } catch (err) {
    if (err instanceof DevAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const db = await getDb();
  const epochs = await listEpochs(db);
  return NextResponse.json({ epochs });
}

export async function POST(req: NextRequest) {
  try {
    assertDevAuthorized(req);
  } catch (err) {
    if (err instanceof DevAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { number, startsAt, endsAt, rewardPoolPoints, allocationPolicy, conversionRate: requestedConversionRate } = (body ?? {}) as {
    number?: number;
    startsAt?: string;
    endsAt?: string;
    rewardPoolPoints?: number;
    allocationPolicy?: typeof DEFAULT_ALLOCATION_POLICY;
    conversionRate?: number;
  };
  const configuredConversionRate = getCullerTokensPerPoint();
  const conversionRate = requestedConversionRate ?? (configuredConversionRate === null ? undefined : Number(configuredConversionRate));

  if (typeof number !== "number" || !Number.isInteger(number) || number <= 0) {
    return NextResponse.json({ error: "number must be a positive integer." }, { status: 400 });
  }
  if (!startsAt || Number.isNaN(Date.parse(startsAt)) || !endsAt || Number.isNaN(Date.parse(endsAt))) {
    return NextResponse.json({ error: "startsAt and endsAt must be valid ISO timestamps." }, { status: 400 });
  }
  if (new Date(endsAt) <= new Date(startsAt)) {
    return NextResponse.json({ error: "endsAt must be after startsAt." }, { status: 400 });
  }
  if (typeof rewardPoolPoints !== "number" || rewardPoolPoints < 0) {
    return NextResponse.json({ error: "rewardPoolPoints must be a non-negative number." }, { status: 400 });
  }
  if (typeof conversionRate !== "number" || !Number.isSafeInteger(conversionRate) || conversionRate <= 0) {
    return NextResponse.json({ error: "conversionRate must be a positive whole CULLER amount per point." }, { status: 400 });
  }

  const db = await getDb();
  try {
    const epoch = await createEpoch(db, {
      number, startsAt, endsAt, rewardPoolPoints, conversionRate,
      allocationPolicy: allocationPolicy ?? DEFAULT_ALLOCATION_POLICY,
    });
    return NextResponse.json({ epoch }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not create epoch." }, { status: 409 });
  }
}
