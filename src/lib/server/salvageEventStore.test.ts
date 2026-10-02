import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { SalvageEvent } from "@/lib/types";

let scratchFile: string;

function makeEvent(overrides: Partial<SalvageEvent> = {}): SalvageEvent {
  return {
    eventId: "SALV-TEST-0",
    idempotencyKey: "sig1:CLOSE_TOKEN_ACCOUNT:acct1",
    wallet: "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T",
    signature: "sig1",
    slot: 1,
    action: "CLOSE_TOKEN_ACCOUNT",
    chain: "solana",
    timestamp: new Date().toISOString(),
    tokenAccount: "acct1",
    mint: null,
    programId: null,
    expectedRecoveryLamports: 2_039_280,
    actualRecoveryLamports: 2_039_280,
    status: "VERIFIED",
    ...overrides,
  };
}

beforeEach(async () => {
  scratchFile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "salvage-test-")), "events.json");
  process.env.SALVAGE_DATA_FILE = scratchFile;
  vi.resetModules();
});

afterEach(async () => {
  delete process.env.SALVAGE_DATA_FILE;
  await fs.rm(path.dirname(scratchFile), { recursive: true, force: true });
});

describe("salvageEventStore", () => {
  it("records a brand new event and returns created=true", async () => {
    const { recordEventIfAbsent } = await import("./salvageEventStore");
    const { created, event } = await recordEventIfAbsent(makeEvent());
    expect(created).toBe(true);
    expect(event.idempotencyKey).toBe("sig1:CLOSE_TOKEN_ACCOUNT:acct1");
  });

  it("is idempotent: recording the same idempotency key twice never creates a duplicate", async () => {
    const { recordEventIfAbsent, listEventsForWallet } = await import("./salvageEventStore");
    const event = makeEvent();

    const first = await recordEventIfAbsent(event);
    const second = await recordEventIfAbsent({ ...event, actualRecoveryLamports: 999 }); // even if payload differs

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.event.actualRecoveryLamports).toBe(2_039_280); // original value wins, not the resubmit

    const all = await listEventsForWallet(event.wallet);
    expect(all).toHaveLength(1);
  });

  it("stays idempotent across concurrent/racing writes (simulating a page refresh firing twice)", async () => {
    const { recordEventIfAbsent, listEventsForWallet } = await import("./salvageEventStore");
    const event = makeEvent();

    const [a, b] = await Promise.all([recordEventIfAbsent(event), recordEventIfAbsent(event)]);
    const createdCount = [a.created, b.created].filter(Boolean).length;
    expect(createdCount).toBe(1);

    const all = await listEventsForWallet(event.wallet);
    expect(all).toHaveLength(1);
  });

  it("findEventByIdempotencyKey finds a stored event and returns null for an unknown one", async () => {
    const { recordEventIfAbsent, findEventByIdempotencyKey } = await import("./salvageEventStore");
    await recordEventIfAbsent(makeEvent());

    expect(await findEventByIdempotencyKey("sig1:CLOSE_TOKEN_ACCOUNT:acct1")).not.toBeNull();
    expect(await findEventByIdempotencyKey("does-not-exist")).toBeNull();
  });

  it("listEventsForWallet only returns events for that wallet, newest first", async () => {
    const { recordEventIfAbsent, listEventsForWallet } = await import("./salvageEventStore");
    const walletA = "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T";
    const walletB = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";

    await recordEventIfAbsent(makeEvent({ wallet: walletA, idempotencyKey: "a1", timestamp: "2024-01-01T00:00:00.000Z" }));
    await recordEventIfAbsent(makeEvent({ wallet: walletA, idempotencyKey: "a2", timestamp: "2024-01-02T00:00:00.000Z" }));
    await recordEventIfAbsent(makeEvent({ wallet: walletB, idempotencyKey: "b1", timestamp: "2024-01-01T00:00:00.000Z" }));

    const eventsForA = await listEventsForWallet(walletA);
    expect(eventsForA.map((e) => e.idempotencyKey)).toEqual(["a2", "a1"]);
  });
});
