import { CULLER_REGISTRY, CullActionType } from "./registry";

/**
 * Stepped (non-linear) recovery bonus tiers. Deliberately NOT a direct
 * multiple of the recovered lamports: a reward strictly proportional to
 * recovered SOL would let someone fund a single empty account with just
 * enough rent to hit a chosen payout, or treat cull as a yield
 * instrument rather than genuine cleanup. Tiers are evaluated highest
 * first and are mutually exclusive.
 */
const RECOVERY_BONUS_TIERS: Array<{ minLamports: number; bonus: number }> = [
  { minLamports: 100_000_000, bonus: 100 }, // >= 0.1 SOL
  { minLamports: 50_000_000, bonus: 50 }, //  >= 0.05 SOL
  { minLamports: 10_000_000, bonus: 20 }, //  >= 0.01 SOL
];

export function calculateRecoveryBonus(actualRecoveryLamports: number): number {
  if (!Number.isFinite(actualRecoveryLamports) || actualRecoveryLamports <= 0) return 0;
  for (const tier of RECOVERY_BONUS_TIERS) {
    if (actualRecoveryLamports >= tier.minLamports) return tier.bonus;
  }
  return 0;
}

export interface PointableAction {
  action: CullActionType;
  actualRecoveryLamports: number;
}

/**
 * The single deterministic point calculation for V1. Intentionally
 * simple: no reputation multipliers, streak bonuses, wallet scoring,
 * social bonuses, or referral rewards. Same inputs always produce the
 * same output, with no hidden state.
 */
export function calculateCullPoints(input: PointableAction): number {
  const entry = Object.values(CULLER_REGISTRY).find((e) => e.action === input.action);
  const basePoints = entry?.basePoints ?? 0;
  const bonus = calculateRecoveryBonus(input.actualRecoveryLamports);
  return basePoints + bonus;
}
