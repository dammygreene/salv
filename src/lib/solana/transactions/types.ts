export type SalvageActionType = "CLOSE_TOKEN_ACCOUNT";

export interface SalvageAction {
  type: SalvageActionType;
  /** The Asset.id this action came from, so the UI can map results back. */
  assetId: string;
  tokenAccount: string;
  programId: string;
  mint: string | null;
  /** Scan-time estimate only. The authoritative amount is whatever the
   * chain actually returns after confirmation (see executor/verify.ts). */
  expectedRecoveryLamports: number;
}

export interface SalvageTransactionPlan {
  wallet: string;
  network: "mainnet-beta" | "devnet" | "testnet";
  actions: SalvageAction[];
  /** Best-effort fee estimate in lamports, shown to the user before they
   * sign. The wallet/cluster determines the real fee at send time. */
  estimatedFeeLamports: number;
  totalExpectedRecoveryLamports: number;
}
