import { TokenEligibility } from "@/lib/types";
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
 * account" salvage path. This is the ONLY gate the frontend is allowed to
 * use to call something salvageable; the executor re-runs an equivalent
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
 * Classifies a non-empty token balance into SAFE_TO_BURN / REVIEW / KEEP /
 * UNKNOWN. This is deliberately conservative: nothing currently returns
 * SAFE_TO_BURN, because none of the strong-evidence signals the spec
 * requires (known spam registry, collection activity, redemption paths,
 * on-chain metadata inspection) are wired up yet. A token simply lacking
 * a known price or symbol must never be enough to make it burnable, so
 * the worst case for an unresolved token is REVIEW, never a burn
 * suggestion. Automatic burning stays unreachable from the UI until a
 * real SAFE_TO_BURN signal exists.
 */
export function classifyTokenEligibility(input: TokenEligibilityInput): TokenEligibility {
  const isNftLike = input.decimals === 0 && input.uiAmount === 1;
  if (isNftLike) return "UNKNOWN"; // handled separately as an NFT, see scanner/scan.ts

  if (input.isVerifiedInTokenList) return "KEEP";

  return "REVIEW";
}
