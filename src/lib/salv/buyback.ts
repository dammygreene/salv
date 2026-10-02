import "server-only";
import { Db } from "../server/db/types";
import { BuybackDryRunRecord, recordBuybackDryRun } from "../server/repositories/buybackDryRunRepo";

/**
 * Dry-run-only buyback planner (Phase 5 Sections 14-15). This module
 * never executes a real swap, never holds a private key, and never
 * touches a live Solana connection — it only decides, given an explicit
 * policy and the current observed numbers, what a buyback *would* look
 * like, and whether it would even be allowed to proceed under the
 * configured safety rules. There is no code path anywhere in this
 * module (or called by it) that sends a transaction.
 */

export class BuybackPolicyError extends Error {}

/**
 * Hard ceiling on top of whatever `maxSpend` a policy configures: a
 * buyback can never be planned to spend more than 90% of the currently
 * observed fee balance, no matter how high maxSpend is set. This is the
 * literal enforcement of Section 14's "Never automatically spend the
 * entire treasury balance" — it does not depend on whoever configured
 * the policy remembering to leave a reserve.
 */
export const MAX_TREASURY_SPEND_RATIO = 0.9;

export interface BuybackPolicy {
  /** Maximum amount of the fee asset (e.g. SOL) this policy will ever
   * authorize spending in one planned buyback, before the treasury
   * reserve ceiling above is also applied. */
  maxSpend: number;
  /** Minimum acceptable SALV output, after slippage, for the plan to be
   * allowed at all. */
  minOutputSalv: number;
  /** Maximum acceptable slippage, in basis points (100 = 1%). */
  slippageLimitBps: number;
  /** The $SALV mint address this policy is allowed to buy. A plan whose
   * observed mint differs is rejected -- this is "verify SALV mint"
   * from Section 15. */
  expectedSalvMint: string;
  /** The address SALV must be routed to once bought (e.g. a burn address
   * or the treasury holding account). A plan whose observed destination
   * differs is rejected -- "verify destination". */
  expectedDestination: string;
  /** The asset this policy expects fees to be denominated in (e.g.
   * "SOL"). A plan whose observed fee asset differs is rejected --
   * "verify quote asset". */
  expectedQuoteAsset: string;
  /** The Solana cluster this policy is allowed to run on (e.g.
   * "devnet"). A plan whose observed network differs is rejected --
   * "verify route" / "wrong network" per Section 18's required tests. */
  expectedNetwork: "devnet" | "testnet" | "mainnet-beta";
}

export interface BuybackDryRunInput {
  feeBalance: number;
  feeAsset: string;
  /** How much $SALV one unit of the fee asset currently buys (e.g. SALV
   * per SOL), from a real observed quote. */
  currentSalvQuotePerUnit: number;
  observedSalvMint: string;
  observedDestination: string;
  observedNetwork: "devnet" | "testnet" | "mainnet-beta";
}

export interface PlannedBuyback {
  rejected: boolean;
  rejectionReason: string | null;
  feeBalance: number;
  feeAsset: string;
  /** What would actually be spent, after applying both the policy's
   * maxSpend and the hard treasury reserve ceiling. 0 if rejected. */
  plannedSpend: number;
  currentSalvQuotePerUnit: number;
  /** plannedSpend * currentSalvQuotePerUnit -- the "sticker price"
   * expected output before slippage. 0 if rejected. */
  expectedSalvOutput: number;
  slippageLimitBps: number;
  /** expectedSalvOutput with the configured slippage limit applied
   * against it (the worst case this plan tolerates). Must be >=
   * policy.minOutputSalv or the plan is rejected. */
  minOutputAfterSlippage: number;
}

function assertSanePolicy(policy: BuybackPolicy): void {
  if (!policy) {
    throw new BuybackPolicyError("A buyback requires an explicit configured policy; none was provided.");
  }
  if (!(policy.maxSpend > 0)) throw new BuybackPolicyError("Policy maxSpend must be a positive number.");
  if (!(policy.minOutputSalv >= 0)) throw new BuybackPolicyError("Policy minOutputSalv must be >= 0.");
  if (!(policy.slippageLimitBps >= 0 && policy.slippageLimitBps <= 10_000)) {
    throw new BuybackPolicyError("Policy slippageLimitBps must be between 0 and 10000.");
  }
  if (!policy.expectedSalvMint || !policy.expectedDestination || !policy.expectedQuoteAsset || !policy.expectedNetwork) {
    throw new BuybackPolicyError("Policy must specify expectedSalvMint, expectedDestination, expectedQuoteAsset, and expectedNetwork.");
  }
}

/**
 * Plans (never executes) a buyback. Requires an explicit `policy` — this
 * function throws BuybackPolicyError rather than falling back to any
 * default if the policy is missing or malformed, satisfying "The system
 * must require an explicit configured policy before execution."
 */
export function planBuyback(policy: BuybackPolicy, input: BuybackDryRunInput): PlannedBuyback {
  assertSanePolicy(policy);

  const reject = (reason: string): PlannedBuyback => ({
    rejected: true,
    rejectionReason: reason,
    feeBalance: input.feeBalance,
    feeAsset: input.feeAsset,
    plannedSpend: 0,
    currentSalvQuotePerUnit: input.currentSalvQuotePerUnit,
    expectedSalvOutput: 0,
    slippageLimitBps: policy.slippageLimitBps,
    minOutputAfterSlippage: 0,
  });

  if (input.observedNetwork !== policy.expectedNetwork) {
    return reject(`Wrong network: observed ${input.observedNetwork}, policy requires ${policy.expectedNetwork}.`);
  }
  if (input.observedSalvMint !== policy.expectedSalvMint) {
    return reject(`Wrong $SALV mint: observed ${input.observedSalvMint}, policy requires ${policy.expectedSalvMint}.`);
  }
  if (input.observedDestination !== policy.expectedDestination) {
    return reject(`Wrong destination: observed ${input.observedDestination}, policy requires ${policy.expectedDestination}.`);
  }
  if (input.feeAsset !== policy.expectedQuoteAsset) {
    return reject(`Wrong quote asset: observed ${input.feeAsset}, policy requires ${policy.expectedQuoteAsset}.`);
  }
  if (!(input.feeBalance > 0)) {
    return reject("No fee balance available to fund a buyback.");
  }
  if (!(input.currentSalvQuotePerUnit > 0)) {
    return reject("No valid $SALV quote available.");
  }

  const treasuryCeiling = input.feeBalance * MAX_TREASURY_SPEND_RATIO;
  const plannedSpend = Math.min(policy.maxSpend, input.feeBalance, treasuryCeiling);

  const expectedSalvOutput = plannedSpend * input.currentSalvQuotePerUnit;
  const minOutputAfterSlippage = expectedSalvOutput * (1 - policy.slippageLimitBps / 10_000);

  if (minOutputAfterSlippage < policy.minOutputSalv) {
    return {
      rejected: true,
      rejectionReason: `Slippage rejection: worst-case output ${minOutputAfterSlippage} $SALV is below the required minimum ${policy.minOutputSalv} $SALV at a ${policy.slippageLimitBps}bps slippage limit.`,
      feeBalance: input.feeBalance,
      feeAsset: input.feeAsset,
      plannedSpend: 0,
      currentSalvQuotePerUnit: input.currentSalvQuotePerUnit,
      expectedSalvOutput: 0,
      slippageLimitBps: policy.slippageLimitBps,
      minOutputAfterSlippage: 0,
    };
  }

  return {
    rejected: false,
    rejectionReason: null,
    feeBalance: input.feeBalance,
    feeAsset: input.feeAsset,
    plannedSpend,
    currentSalvQuotePerUnit: input.currentSalvQuotePerUnit,
    expectedSalvOutput,
    slippageLimitBps: policy.slippageLimitBps,
    minOutputAfterSlippage,
  };
}

/** Plans a buyback and durably logs the plan (rejected or not) to the
 * append-only buyback_dry_runs table, for public transparency. Still
 * never executes anything. */
export async function planAndRecordBuyback(db: Db, policy: BuybackPolicy, input: BuybackDryRunInput): Promise<BuybackDryRunRecord> {
  const plan = planBuyback(policy, input);
  return recordBuybackDryRun(db, {
    feeBalance: plan.feeBalance,
    feeAsset: plan.feeAsset,
    currentSalvQuote: plan.currentSalvQuotePerUnit,
    maxSpend: policy.maxSpend,
    minOutput: policy.minOutputSalv,
    slippageLimitBps: plan.slippageLimitBps,
    plannedSpend: plan.plannedSpend,
    expectedSalvOutput: plan.expectedSalvOutput,
    rejected: plan.rejected,
    rejectionReason: plan.rejectionReason,
  });
}
