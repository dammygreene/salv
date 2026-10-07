export type AssetStatus = "CULLABLE" | "WATCH" | "REVIEW" | "KEEP";

export type ScanState =
  | "READY"
  | "SCANNING WALLET"
  | "MAPPING ASSETS"
  | "CHECKING RECOVERY PATHS"
  | "SORTING"
  | "SCAN COMPLETE";

export type AssetKind = "TOKEN" | "NFT" | "POSITION" | "ACCOUNT";

export type AssetClassification =
  | "EMPTY_ACCOUNT"
  | "FUNGIBLE_UNKNOWN_VALUE"
  | "FUNGIBLE_NO_MARKET"
  | "FUNGIBLE_NO_LIQUIDITY"
  | "FUNGIBLE_LOW_VALUE"
  | "FUNGIBLE_NEGLIGIBLE_VALUE"
  | "FUNGIBLE_VALUABLE"
  | "NFT_UNKNOWN_VALUE"
  | "NFT_NO_MARKET"
  | "NFT_LOW_VALUE"
  | "NFT_VALUABLE"
  | "NFT_REVIEW";

export type MarketDataStatus = "AVAILABLE" | "NO_MARKET" | "UNKNOWN" | "ERROR";

export type TokenMarketData = {
  priceUsd: number | null;
  liquidityUsd: number | null;
  marketAvailable: boolean | null;
  status: MarketDataStatus;
  source: string;
};

export type AssetMetadata = {
  imageUrl: string | null;
  collection: string | null;
  collectionAddress: string | null;
  verifiedCollection: boolean | null;
  priceUsd: number | null;
  valueUsd: number | null;
  liquidityUsd?: number | null;
  marketStatus: "AVAILABLE" | "NO_MARKET" | "UNKNOWN";
  metadataStatus: "AVAILABLE" | "UNAVAILABLE";
  source: string;
};

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
  /** CULLER REGISTRY classification this asset currently carries. See
   * src/lib/cull/registry.ts for the full classification -> action
   * -> disposition mapping. */
  classification?: import("./cull/registry").AssetClassification;
  /** Conservative market/value classification. Missing data is never
   * treated as zero value. */
  valueClassification?: AssetClassification;
  rawBalance?: string;
  decimals?: number;
  recoverableLamports?: number;
  metadata?: AssetMetadata;
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
  kind: "SCAN" | "CULLER" | "WATCH" | "REWARD";
  label: string;
  detail: string;
  timestamp: string;
};

export type CullEventStatus = "PENDING" | "VERIFIED" | "FAILED" | "REVERSED";

/** One row returned by the backend for a single verified-or-not cull
 * action. Mirrors a `salvage_actions` database row (see
 * src/lib/server/repositories). Only the backend can ever produce one
 * with status VERIFIED and a non-zero `points` value. */
export type CullEvent = {
  eventId: string;
  idempotencyKey: string;
  wallet: string;
  signature: string;
  slot: number;
  action: import("./cull/registry").CullActionType;
  chain: "solana";
  timestamp: string;
  tokenAccount: string;
  mint: string | null;
  programId: string | null;
  expectedRecoveryLamports: number;
  actualRecoveryLamports: number | null;
  status: CullEventStatus;
  reason?: string;
  /** Points actually credited to the wallet's ledger for this action.
   * Always 0 unless status is VERIFIED and the action passed every
   * anti-farming check. */
  points: number;
};
