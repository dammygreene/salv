import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { SalvageEvent } from "@/lib/types";

/**
 * MVP persistence: a single JSON file on disk, guarded by an in-process
 * write queue so concurrent requests can't race and clobber each other.
 * This is NOT a production datastore — it has no multi-instance
 * consistency, no transactions, and resets if the file is deleted. Before
 * shipping this for real, swap the four functions below for a real
 * database-backed repository (e.g. Postgres with a unique constraint on
 * idempotency_key); every call site here only depends on these function
 * signatures, not on the storage mechanism.
 */
// SALVAGE_DATA_FILE lets tests point this at a scratch file instead of
// the real dev store; production never sets it.
const DATA_FILE = process.env.SALVAGE_DATA_FILE || path.join(process.cwd(), ".data", "salvage-events.json");
const DATA_DIR = path.dirname(DATA_FILE);

let writeQueue: Promise<unknown> = Promise.resolve();

async function readAll(): Promise<SalvageEvent[]> {
  try {
    const raw = await fs.readFile(/* turbopackIgnore: true */ DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SalvageEvent[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeAll(events: SalvageEvent[]): Promise<void> {
  await fs.mkdir(/* turbopackIgnore: true */ DATA_DIR, { recursive: true });
  const tmpFile = path.join(DATA_DIR, `.salvage-events.${process.pid}.${Date.now()}.tmp`);
  await fs.writeFile(/* turbopackIgnore: true */ tmpFile, JSON.stringify(events, null, 2), "utf8");
  await fs.rename(/* turbopackIgnore: true */ tmpFile, DATA_FILE);
}

function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(fn, fn);
  writeQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

export async function findEventByIdempotencyKey(key: string): Promise<SalvageEvent | null> {
  const events = await readAll();
  return events.find((event) => event.idempotencyKey === key) ?? null;
}

export async function listEventsForWallet(wallet: string): Promise<SalvageEvent[]> {
  const events = await readAll();
  return events
    .filter((event) => event.wallet === wallet)
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0));
}

/**
 * Idempotent insert. If an event already exists for this idempotency key
 * (signature + action type + token account), the existing stored event is
 * returned unchanged and nothing new is written — this is what makes
 * "refresh the page / resubmit verification" safe to call any number of
 * times without duplicating history.
 */
export async function recordEventIfAbsent(event: SalvageEvent): Promise<{ event: SalvageEvent; created: boolean }> {
  return withWriteLock(async () => {
    const events = await readAll();
    const existing = events.find((e) => e.idempotencyKey === event.idempotencyKey);
    if (existing) {
      return { event: existing, created: false };
    }
    events.push(event);
    await writeAll(events);
    return { event, created: true };
  });
}
