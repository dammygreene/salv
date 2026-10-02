import { Asset, AssetStatus, ScanState } from "@/lib/types";
import { AssetClassification, dispositionToAssetStatus, getRegistryEntry } from "@/lib/salvage/registry";
import { isValidSolanaAddress } from "../base58";
import { formatRecency, lamportsToSol, mapWithConcurrency, shortenAddress } from "../format";
import { classifyTokenEligibility, evaluateCloseAccountEligibility } from "../validation/eligibility";
import {
  getLatestActivityBlockTime,
  getTokenAccountsByOwner,
  SolanaRpcError,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TokenAccountEntry,
} from "./rpc";
import { getTokenList, TokenListEntry } from "../token-list";

export type ScanProgressStep = Exclude<ScanState, "READY">;

/** Hard caps so a wallet with thousands of token accounts cannot hang the
 * scan or hammer a free-tier public RPC endpoint into rate-limiting us. */
const MAX_ACCOUNTS_SCANNED = 60;
const MAX_ACTIVITY_LOOKUPS = 24;
const ACTIVITY_LOOKUP_CONCURRENCY = 5;

export class WalletScanError extends Error {}

const STATUS_SORT_ORDER: Record<AssetStatus, number> = {
  SALVAGEABLE: 0,
  REVIEW: 1,
  WATCH: 2,
  KEEP: 3,
};

/** Display-only action labels per classification, read straight off the
 * SALVAGE REGISTRY so the UI can never drift from what the backend
 * actually considers enabled. Disabled actions (burn paths) show a
 * label that makes clear nothing executes yet. */
function actionLabel(classification: AssetClassification): string {
  const entry = getRegistryEntry(classification);
  if (!entry.action) {
    return entry.disposition === "WATCH" ? "ADD TO WATCH" : entry.disposition;
  }
  if (!entry.enabled) return `${entry.action.replace(/_/g, " ")} (not yet enabled)`;
  return entry.action.replace(/_/g, " ");
}

interface TaggedTokenAccountEntry extends TokenAccountEntry {
  programId: string;
}

function classifyAccount(
  entry: TaggedTokenAccountEntry,
  walletOwner: string,
  tokenList: Map<string, TokenListEntry>,
  age: string
): Asset {
  const info = entry.account.data.parsed.info;
  const { mint, tokenAmount, owner } = info;
  const lamports = entry.account.lamports;
  const shortAddr = shortenAddress(entry.pubkey);
  const listed = tokenList.get(mint);

  const closeEligibility = evaluateCloseAccountEligibility({
    tokenAccountOwner: owner,
    walletOwner,
    programId: entry.programId,
    uiAmount: tokenAmount.uiAmount,
  });

  if (closeEligibility.eligible) {
    const classification: AssetClassification = "EMPTY_TOKEN_ACCOUNT";
    const registryEntry = getRegistryEntry(classification);
    return {
      id: entry.pubkey,
      name: listed ? `Empty ${listed.symbol} account` : "Empty token account",
      ticker: listed?.symbol ?? mint.slice(0, 4),
      kind: "ACCOUNT",
      address: shortAddr,
      status: dispositionToAssetStatus(registryEntry.disposition),
      age,
      value: `${lamportsToSol(lamports).toFixed(4)} SOL`,
      valueKnown: true,
      reason: closeEligibility.reason,
      action: actionLabel(classification),
      tokenAccount: entry.pubkey,
      programId: entry.programId,
      mint,
      lamports,
      classification,
    };
  }

  const classification = classifyTokenEligibility({
    mint,
    decimals: tokenAmount.decimals,
    uiAmount: tokenAmount.uiAmount,
    isVerifiedInTokenList: Boolean(listed),
  });
  const registryEntry = getRegistryEntry(classification);

  if (classification === "POTENTIALLY_REDEEMABLE_NFT") {
    return {
      id: entry.pubkey,
      name: listed?.name ?? `NFT ${shortenAddress(mint, 4, 4)}`,
      ticker: "NFT",
      kind: "NFT",
      address: shortAddr,
      status: dispositionToAssetStatus(registryEntry.disposition),
      age,
      value: "UNKNOWN",
      valueKnown: false,
      reason: "NFT detected. No burn/redemption signal exists yet, so it stays watch-only.",
      action: actionLabel(classification),
      tokenAccount: entry.pubkey,
      programId: entry.programId,
      mint,
      classification,
    };
  }

  if (classification === "ACTIVE_TOKEN" && listed) {
    return {
      id: entry.pubkey,
      name: listed.name,
      ticker: listed.symbol,
      kind: "TOKEN",
      address: shortAddr,
      status: dispositionToAssetStatus(registryEntry.disposition),
      age,
      value: `${tokenAmount.uiAmountString} ${listed.symbol}`,
      valueKnown: true,
      reason: "Active, verified balance. No salvage action suggested.",
      action: actionLabel(classification),
      tokenAccount: entry.pubkey,
      programId: entry.programId,
      mint,
      classification,
    };
  }

  return {
    id: entry.pubkey,
    name: "Unknown token",
    ticker: mint.slice(0, 4).toUpperCase(),
    kind: "TOKEN",
    address: shortAddr,
    status: dispositionToAssetStatus(registryEntry.disposition),
    age,
    value: "UNKNOWN",
    valueKnown: false,
    reason: "Unverified token, not in the known token registry. A missing price never makes this spam on its own.",
    action: actionLabel("UNKNOWN_TOKEN"),
    tokenAccount: entry.pubkey,
    programId: entry.programId,
    mint,
    classification: "UNKNOWN_TOKEN",
  };
}

export interface ScanResult {
  assets: Asset[];
  accountsFound: number;
  accountsScanned: number;
  truncated: boolean;
}

/**
 * Reads real, public, read-only chain data for a wallet: every SPL /
 * Token-2022 token account it owns, classified against the SALVAGE
 * REGISTRY (src/lib/salvage/registry.ts) into the same salvageable /
 * watch / review / keep buckets the UI already expects. No signature is
 * ever requested and nothing is written on-chain. This only determines
 * what is POTENTIALLY actionable; the executor independently re-verifies
 * everything against fresh on-chain state before it will build a real
 * transaction (see recovery/closeAccount.ts), and the backend
 * independently re-derives classification/points from chain truth, never
 * from this scan result.
 */
export async function scanWallet(
  address: string,
  onProgress?: (step: ScanProgressStep) => void
): Promise<ScanResult> {
  const trimmed = address.trim();
  if (!isValidSolanaAddress(trimmed)) {
    throw new WalletScanError("That does not look like a valid Solana wallet address.");
  }

  onProgress?.("SCANNING WALLET");
  const [legacy, token2022] = await Promise.allSettled([
    getTokenAccountsByOwner(trimmed, TOKEN_PROGRAM_ID),
    getTokenAccountsByOwner(trimmed, TOKEN_2022_PROGRAM_ID),
  ]);

  if (legacy.status === "rejected" && token2022.status === "rejected") {
    const reason = legacy.reason instanceof SolanaRpcError ? legacy.reason.message : "Could not reach Solana RPC.";
    throw new WalletScanError(reason);
  }

  const rawAccounts: TaggedTokenAccountEntry[] = [
    ...(legacy.status === "fulfilled" ? legacy.value.map((e) => ({ ...e, programId: TOKEN_PROGRAM_ID })) : []),
    ...(token2022.status === "fulfilled" ? token2022.value.map((e) => ({ ...e, programId: TOKEN_2022_PROGRAM_ID })) : []),
  ];

  onProgress?.("MAPPING ASSETS");
  const tokenList = await getTokenList();

  onProgress?.("CHECKING RECOVERY PATHS");
  const scanned = rawAccounts.slice(0, MAX_ACCOUNTS_SCANNED);
  const lookupTargets = scanned.slice(0, MAX_ACTIVITY_LOOKUPS);
  const ages = await mapWithConcurrency(lookupTargets, ACTIVITY_LOOKUP_CONCURRENCY, async (entry) => {
    try {
      const blockTime = await getLatestActivityBlockTime(entry.pubkey);
      return formatRecency(blockTime);
    } catch {
      return "\u2014";
    }
  });

  const assets = scanned.map((entry, index) => classifyAccount(entry, trimmed, tokenList, ages[index] ?? "\u2014"));

  onProgress?.("SORTING");
  assets.sort((a, b) => STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status]);

  onProgress?.("SCAN COMPLETE");

  return {
    assets,
    accountsFound: rawAccounts.length,
    accountsScanned: scanned.length,
    truncated: rawAccounts.length > scanned.length,
  };
}
