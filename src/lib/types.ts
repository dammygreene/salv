export type AssetStatus = "SALVAGEABLE" | "WATCH" | "REVIEW" | "KEEP";

export type ScanState =
  | "READY"
  | "SCANNING WALLET"
  | "MAPPING ASSETS"
  | "CHECKING RECOVERY PATHS"
  | "SORTING"
  | "SCAN COMPLETE";

export type AssetKind = "TOKEN" | "NFT" | "POSITION" | "ACCOUNT";

export type Asset = {
  id: string;
  name: string;
  ticker: string;
  kind: AssetKind;
  address: string;
  status: AssetStatus;
  age: string;
  value: string;
  valueKnown: boolean;
  reason: string;
  action: string;
  /** Full (non-shortened) token account pubkey, when this asset came from
   * a real chain scan. Required to build a real transaction later. */
  tokenAccount?: string;
  /** SPL token program that owns this account (legacy or Token-2022). */
  programId?: string;
  /** Mint address, when known. */
  mint?: string;
  /** Exact lamports held by the account, for ACCOUNT-kind assets. */
  lamports?: number;
};

export type WatchItem = {
  id: string;
  assetId: string;
  name: string;
  reason: string;
  lastChecked: string;
  trigger: string;
  notify: boolean;
};

export type ProofEvent = {
  id: string;
  label: string;
  assets: string[];
  recovered: string;
  reward: number;
  status: "Confirmed" | "Pending";
  chain: "Solana";
  timestamp: string;
  /** Present once this event is backed by a real on-chain transaction. */
  signature?: string;
};

export type HistoryEvent = {
  id: string;
  kind: "SCAN" | "SALVAGE" | "WATCH" | "REWARD";
  label: string;
  detail: string;
  timestamp: string;
};

/** Token classification used to gate automatic burn eligibility. Nothing
 * currently reaches SAFE_TO_BURN automatically; see validation/eligibility. */
export type TokenEligibility = "SAFE_TO_BURN" | "REVIEW" | "KEEP" | "UNKNOWN";

export type SalvageActionType = "CLOSE_TOKEN_ACCOUNT";

export type SalvageEventStatus = "PENDING" | "VERIFIED" | "FAILED" | "REVERSED";

export type SalvageEvent = {
  eventId: string;
  idempotencyKey: string;
  wallet: string;
  signature: string;
  slot: number;
  action: SalvageActionType;
  chain: "solana";
  timestamp: string;
  tokenAccount: string;
  mint: string | null;
  programId: string | null;
  expectedRecoveryLamports: number;
  actualRecoveryLamports: number | null;
  status: SalvageEventStatus;
  reason?: string;
};

