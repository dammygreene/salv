import { cullerToBaseUnits } from "./../culler/tokenSpec";

export const FIXED_ALLOCATION_POLICY_VERSION = "fixed-v1";

export function calculateFixedAllocationBaseUnits(points: number, cullerTokensPerPoint: bigint): bigint {
  if (!Number.isInteger(points) || points < 0) throw new Error("points must be a non-negative integer");
  if (cullerTokensPerPoint <= 0n) throw new Error("conversion rate must be a positive integer");
  return cullerToBaseUnits(BigInt(points) * cullerTokensPerPoint);
}
