import { Asset, AssetStatus, ScanState } from "@/lib/types";
import { AssetClassification, dispositionToAssetStatus, getRegistryEntry } from "@/lib/cull/registry";
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
const MAX_ACTIVITY_LOOKUPS = 24;
const ACTIVITY_LOOKUP_CONCURRENCY = 5;

export class WalletScanError extends Error {}

const STATUS_SORT_ORDER: Record<AssetStatus, number> = {
  CULLABLE: 0,
  REVIEW: 1,
  WATCH: 2,
  KEEP: 3,
};

/** Display-only action labels per classification, read straight off the
 * CULLER REGISTRY so the UI can never drift from what the backend
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

  if (tokenAmount.amount === "0") {
    const classification: AssetClassification = "EMPTY_TOKEN_ACCOUNT";
    const registryEntry = getRegistryEntry(classification);
    return {
      id: entry.pubkey,
      name: listed ? `Empty ${listed.symbol} account` : "Empty token account",
      ticker: listed?.symbol ?? mint.slice(0, 4),
      kind: "ACCOUNT",
      address: shortAddr,
      status: closeEligibility.eligible ? dispositionToAssetStatus(registryEntry.disposition) : "REVIEW",
      age,
      value: `${lamportsToSol(lamports).toFixed(4)} SOL`,
      valueKnown: true,
      reason: closeEligibility.reason,
      action: actionLabel(classification),
      tokenAccount: entry.pubkey,
      programId: entry.programId,
      mint,
      lamports,
      rawBalance: tokenAmount.amount,
      decimals: tokenAmount.decimals,
      recoverableLamports: closeEligibility.eligible ? lamports : undefined,
      valueClassification: "EMPTY_ACCOUNT",
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
      rawBalance: tokenAmount.amount,
      decimals: tokenAmount.decimals,
      valueClassification: "NFT_UNKNOWN_VALUE",
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
      rawBalance: tokenAmount.amount,
      decimals: tokenAmount.decimals,
      valueClassification: "FUNGIBLE_VALUABLE",
      reason: "Active, verified balance. No cull action suggested.",
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
    rawBalance: tokenAmount.amount,
    decimals: tokenAmount.decimals,
    valueClassification: "FUNGIBLE_UNKNOWN_VALUE",
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
  accountsTotal: number;
  accountsScanned: number;
  accountsProcessed: number;
  accountsRemaining: number;
  truncated: boolean;
  summary: {
    empty: number;
    nonEmpty: number;
    fungible: number;
    nftShaped: number;
  };
  programStatus: {
    splToken: "available" | "unavailable";
    token2022: "available" | "unavailable";
  };
}

/**
 * Reads real, public, read-only chain data for a wallet from both the
 * classic SPL Token and Token-2022 programs. Every discovered account is
 * surfaced and classified; unknown value is kept conservative rather than
 * treated as worthless. No signature is requested and nothing is written
 * on-chain.
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
  const uniqueAccounts = Array.from(
    new Map(rawAccounts.map((entry) => [`${entry.programId}:${entry.pubkey}`, entry])).values()
  );

  onProgress?.("MAPPING ASSETS");
  const tokenList = await getTokenList();

  onProgress?.("CHECKING RECOVERY PATHS");
  const scanned = uniqueAccounts;
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
    accountsFound: uniqueAccounts.length,
    accountsTotal: uniqueAccounts.length,
    accountsScanned: scanned.length,
    accountsProcessed: scanned.length,
    accountsRemaining: 0,
    truncated: false,
    summary: {
      empty: assets.filter((asset) => asset.valueClassification === "EMPTY_ACCOUNT").length,
      nonEmpty: assets.filter((asset) => asset.valueClassification !== "EMPTY_ACCOUNT").length,
      fungible: assets.filter((asset) => asset.kind === "TOKEN").length,
      nftShaped: assets.filter((asset) => asset.kind === "NFT").length,
    },
    programStatus: {
      splToken: legacy.status === "fulfilled" ? "available" : "unavailable",
      token2022: token2022.status === "fulfilled" ? "available" : "unavailable",
    },
  };
}
