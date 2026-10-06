import "server-only";
import { Db } from "../db/types";

export interface WalletRecord {
  id: string;
  userId: string;
  address: string;
  chain: string;
}

interface WalletRow {
  id: string;
  user_id: string;
  address: string;
  chain: string;
}

function mapRow(row: WalletRow): WalletRecord {
  return { id: row.id, userId: row.user_id, address: row.address, chain: row.chain };
}

/**
 * Finds or creates the wallet (and its backing user, 1:1 for V1 — there
 * is no multi-wallet-per-user auth system yet) for an address. Safe to
 * call on every request; concurrent first-time calls for the same new
 * address may create more than one `users` row, but the `wallets` table's
 * (chain, address) unique constraint guarantees exactly one wallet row
 * ever exists, which is what every other table keys off.
 */
export async function ensureWallet(db: Db, address: string, chain = "solana"): Promise<WalletRecord> {
  const existing = await db.query<WalletRow>("SELECT id, user_id, address, chain FROM wallets WHERE chain = $1 AND address = $2", [
    chain,
    address,
  ]);
  if (existing.rows[0]) {
    await db.query("UPDATE wallets SET last_seen_at = now() WHERE id = $1", [existing.rows[0].id]);
    return mapRow(existing.rows[0]);
  }

  return db.transaction(async (tx) => {
    const user = await tx.query<{ id: string }>("INSERT INTO users DEFAULT VALUES RETURNING id");
    const inserted = await tx.query<WalletRow>(
      `INSERT INTO wallets (user_id, chain, address) VALUES ($1, $2, $3)
       ON CONFLICT (chain, address) DO UPDATE SET last_seen_at = now()
       RETURNING id, user_id, address, chain`,
      [user.rows[0].id, chain, address]
    );
    return mapRow(inserted.rows[0]);
  });
}
