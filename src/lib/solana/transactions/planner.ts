import { Asset } from "@/lib/types";
import { SalvageAction, SalvageTransactionPlan } from "./types";

export class PlanningError extends Error {}

export interface BuildPlanParams {
  wallet: string;
  network: SalvageTransactionPlan["network"];
  assets: Asset[];
  estimatedFeeLamports: number;
}

/**
 * Builds a deterministic SalvageTransactionPlan from user-selected
 * assets. "Deterministic" here means: given the same set of eligible
 * assets, the plan's action list is always produced in the same order
 * (sorted by token account address) regardless of the order the caller
 * selected them in, and no action is ever silently dropped or
 * substituted — an ineligible asset throws rather than being skipped, so
 * a caller can never end up signing a different plan than the one it
 * reviewed.
 *
 * Only CLOSE_TOKEN_ACCOUNT actions are supported right now (empty token
 * account rent recovery). Nothing else automatically enters a plan: NFTs
 * stay WATCH/REVIEW-only and no token is ever burned automatically.
 */
export function buildSalvageTransactionPlan(params: BuildPlanParams): SalvageTransactionPlan {
  const { wallet, network, assets, estimatedFeeLamports } = params;

  if (!assets.length) {
    throw new PlanningError("No assets selected.");
  }

  const actions: SalvageAction[] = assets.map((asset) => {
    if (asset.status !== "SALVAGEABLE" || asset.kind !== "ACCOUNT") {
      throw new PlanningError(`Asset ${asset.id} is not eligible for an automatic close-account action.`);
    }
    if (!asset.tokenAccount || !asset.programId) {
      throw new PlanningError(`Asset ${asset.id} is missing on-chain identifiers required to build a transaction.`);
    }

    return {
      type: "CLOSE_TOKEN_ACCOUNT",
      assetId: asset.id,
      tokenAccount: asset.tokenAccount,
      programId: asset.programId,
      mint: asset.mint ?? null,
      expectedRecoveryLamports: asset.lamports ?? 0,
    };
  });

  actions.sort((a, b) => a.tokenAccount.localeCompare(b.tokenAccount));

  const totalExpectedRecoveryLamports = actions.reduce((sum, action) => sum + action.expectedRecoveryLamports, 0);

  return {
    wallet,
    network,
    actions,
    estimatedFeeLamports,
    totalExpectedRecoveryLamports,
  };
}
