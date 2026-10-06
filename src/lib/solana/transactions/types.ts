import { CullActionType } from "@/lib/cull/registry";

export type { CullActionType };

export interface CullAction {
  type: CullActionType;
  /** The Asset.id this action came from, so the UI can map results back. */
  assetId: string;
  tokenAccount: string;
  programId: string;
  mint: string | null;
  /** Scan-time estimate only. The authoritative amount is whatever the
   * chain actually returns after confirmation (see executor/verify.ts). */
  expectedRecoveryLamports: number;
}

export interface CullTransactionPlan {
  wallet: string;
  network: "mainnet-beta" | "devnet" | "testnet";
  actions: CullAction[];
  /** Best-effort fee estimate in lamports, shown to the user before they
   * sign. The wallet/cluster determines the real fee at send time. */
  estimatedFeeLamports: number;
  totalExpectedRecoveryLamports: number;
}
