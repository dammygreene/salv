import { AssetClassification } from "@/lib/cull/registry";
export { evaluateAssetEligibility } from "@/lib/eligibility";
import { TOKEN_2022_PROGRAM_ID_STR, TOKEN_PROGRAM_ID_STR } from "../constants";

const KNOWN_TOKEN_PROGRAMS = new Set([TOKEN_PROGRAM_ID_STR, TOKEN_2022_PROGRAM_ID_STR]);

export interface CloseAccountEligibilityInput {
  tokenAccountOwner: string;
  walletOwner: string;
  programId: string;
  uiAmount: number | null;
  isFrozen?: boolean;
}

export interface EligibilityResult {
  eligible: boolean;
  reason: string;
}


/**
 * Decides whether a token account can enter the automatic "close empty
 * account" cull path (classification: EMPTY_TOKEN_ACCOUNT in the
 * CULLER REGISTRY). This is the ONLY gate the frontend is allowed to use
 * to call something cullable; the executor re-runs an equivalent
 * check against fresh on-chain state immediately before building a
 * transaction (see recovery/closeAccount.ts), so a stale or spoofed scan
 * result can never reach a real instruction.
 */
export function evaluateCloseAccountEligibility(input: CloseAccountEligibilityInput): EligibilityResult {
  if (!KNOWN_TOKEN_PROGRAMS.has(input.programId)) {
    return { eligible: false, reason: "Not an SPL Token or Token-2022 program account." };
  }
  if (input.tokenAccountOwner !== input.walletOwner) {
    return { eligible: false, reason: "Token account owner does not match the scanned wallet." };
  }
  if ((input.uiAmount ?? 0) !== 0) {
    return { eligible: false, reason: "Account still holds a balance." };
  }
  if (input.isFrozen) {
    return { eligible: false, reason: "Account is frozen and cannot be closed." };
  }
  return { eligible: true, reason: "Empty token account, owner verified, zero balance confirmed." };
}

export interface TokenEligibilityInput {
  mint: string;
  decimals: number;
  uiAmount: number | null;
  isVerifiedInTokenList: boolean;
}

/**
 * Classifies a token balance into the CULLER REGISTRY's asset
 * classification vocabulary. This is deliberately conservative: nothing
 * returned here can ever be KNOWN_SPAM_TOKEN or KNOWN_SPAM_NFT, because
 * none of the strong-evidence signals a real spam/burn registry would
 * need (a maintained spam list, collection activity, redemption paths,
 * on-chain metadata inspection) are wired up yet. A token simply lacking
 * a known price or symbol must never be enough to make it burnable, so
 * the worst case for an unresolved fungible token is UNKNOWN_TOKEN
 * (-> REVIEW), and every NFT-shaped balance is POTENTIALLY_REDEEMABLE_NFT
 * (-> WATCH). Automatic burning stays unreachable until a real spam
 * signal exists (see cull/registry.ts's `enabled` flags).
 */
export function classifyTokenEligibility(input: TokenEligibilityInput): AssetClassification {
  const isNftLike = input.decimals === 0 && input.uiAmount === 1;
  if (isNftLike) return "POTENTIALLY_REDEEMABLE_NFT";

  if (input.isVerifiedInTokenList) return "ACTIVE_TOKEN";

  return "UNKNOWN_TOKEN";
}
