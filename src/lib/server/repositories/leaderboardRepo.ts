import "server-only";
import { Db } from "../db/types";
import { baseUnitsToCullerDecimalString } from "../../culler/tokenSpec";

export interface LeaderboardRow {
  rank: number;
  allocation: string;
  walletAddress: string;
}

interface LeaderboardDbRow {
  rank: number;
  allocation: string;
  solana_wallet: string;
}

const ORDER = `
  ORDER BY total_allocation DESC, first_allocation_at ASC, solana_wallet ASC
`;

function shortenWallet(wallet: string): string {
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function mapRow(row: LeaderboardDbRow): LeaderboardRow {
  return {
    rank: Number(row.rank),
    allocation: baseUnitsToCullerDecimalString(BigInt(row.allocation)),
    walletAddress: shortenWallet(row.solana_wallet),
  };
}

export async function listLeaderboard(db: Db, limit = 100, offset = 0): Promise<LeaderboardRow[]> {
  const result = await db.query<LeaderboardDbRow>(
    `WITH totals AS (
       SELECT r.solana_wallet,
              SUM(CAST(r.salv_allocated_base_units AS numeric)) AS total_allocation,
              MIN(r.first_scanned_at) AS first_allocation_at
       FROM reward_ledger_entries r
       WHERE CAST(r.salv_allocated_base_units AS numeric) > 0
       GROUP BY r.solana_wallet
     )
     SELECT ROW_NUMBER() OVER (${ORDER}) AS rank,
            total_allocation::text AS allocation, solana_wallet
     FROM totals
     ${ORDER}
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows.map(mapRow);
}

export async function getLeaderboardRank(db: Db, wallet: string): Promise<LeaderboardRow | null> {
  const result = await db.query<LeaderboardDbRow>(
    `WITH totals AS (
       SELECT r.solana_wallet,
              SUM(CAST(r.salv_allocated_base_units AS numeric)) AS total_allocation,
              MIN(r.first_scanned_at) AS first_allocation_at
       FROM reward_ledger_entries r
       WHERE CAST(r.salv_allocated_base_units AS numeric) > 0
       GROUP BY r.solana_wallet
     ),
     ranked AS (
       SELECT ROW_NUMBER() OVER (${ORDER}) AS rank,
              total_allocation::text AS allocation, solana_wallet
       FROM totals
     )
     SELECT * FROM ranked WHERE solana_wallet = $1`,
    [wallet]
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}
