import { describe, expect, it } from "vitest";
import { TOKEN_2022_PROGRAM_ID_STR, TOKEN_PROGRAM_ID_STR } from "../constants";
import { classifyTokenEligibility, evaluateCloseAccountEligibility } from "./eligibility";

const WALLET = "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T";

describe("evaluateCloseAccountEligibility", () => {
  it("accepts an empty, owner-matched, legacy-program account", () => {
    const result = evaluateCloseAccountEligibility({
      tokenAccountOwner: WALLET,
      walletOwner: WALLET,
      programId: TOKEN_PROGRAM_ID_STR,
      uiAmount: 0,
    });
    expect(result.eligible).toBe(true);
  });

  it("accepts an empty Token-2022 account", () => {
    const result = evaluateCloseAccountEligibility({
      tokenAccountOwner: WALLET,
      walletOwner: WALLET,
      programId: TOKEN_2022_PROGRAM_ID_STR,
      uiAmount: 0,
    });
    expect(result.eligible).toBe(true);
  });

  it("rejects an unrecognized program id", () => {
    const result = evaluateCloseAccountEligibility({
      tokenAccountOwner: WALLET,
      walletOwner: WALLET,
      programId: "11111111111111111111111111111111111111111",
      uiAmount: 0,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/program/i);
  });

  it("rejects when the token account owner does not match the scanned wallet (spoof defense)", () => {
    const result = evaluateCloseAccountEligibility({
      tokenAccountOwner: "SomeoneElse11111111111111111111111111111",
      walletOwner: WALLET,
      programId: TOKEN_PROGRAM_ID_STR,
      uiAmount: 0,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/owner/i);
  });

  it("rejects a non-empty account", () => {
    const result = evaluateCloseAccountEligibility({
      tokenAccountOwner: WALLET,
      walletOwner: WALLET,
      programId: TOKEN_PROGRAM_ID_STR,
      uiAmount: 1.5,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/balance/i);
  });

  it("rejects a frozen account even if empty", () => {
    const result = evaluateCloseAccountEligibility({
      tokenAccountOwner: WALLET,
      walletOwner: WALLET,
      programId: TOKEN_PROGRAM_ID_STR,
      uiAmount: 0,
      isFrozen: true,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/frozen/i);
  });

  it("treats a null uiAmount as zero (empty)", () => {
    const result = evaluateCloseAccountEligibility({
      tokenAccountOwner: WALLET,
      walletOwner: WALLET,
      programId: TOKEN_PROGRAM_ID_STR,
      uiAmount: null,
    });
    expect(result.eligible).toBe(true);
  });
});

describe("classifyTokenEligibility", () => {
  it("never returns SAFE_TO_BURN (no strong-evidence signal is wired up yet)", () => {
    const cases = [
      { mint: "A", decimals: 6, uiAmount: 100, isVerifiedInTokenList: true },
      { mint: "B", decimals: 6, uiAmount: 100, isVerifiedInTokenList: false },
      { mint: "C", decimals: 9, uiAmount: 0.0001, isVerifiedInTokenList: false },
      { mint: "D", decimals: 0, uiAmount: 1, isVerifiedInTokenList: false },
    ];
    for (const input of cases) {
      expect(classifyTokenEligibility(input)).not.toBe("SAFE_TO_BURN");
    }
  });

  it("classifies a verified, listed token as KEEP", () => {
    expect(
      classifyTokenEligibility({ mint: "listed-mint", decimals: 6, uiAmount: 50, isVerifiedInTokenList: true })
    ).toBe("KEEP");
  });

  it("classifies an unverified token as REVIEW, never auto-burnable, even though its price is unknown", () => {
    const result = classifyTokenEligibility({
      mint: "unknown-mint",
      decimals: 6,
      uiAmount: 50,
      isVerifiedInTokenList: false,
    });
    expect(result).toBe("REVIEW");
    expect(result).not.toBe("SAFE_TO_BURN");
  });

  it("classifies an NFT-shaped balance (decimals=0, amount=1) as UNKNOWN, not a fungible bucket", () => {
    expect(
      classifyTokenEligibility({ mint: "nft-mint", decimals: 0, uiAmount: 1, isVerifiedInTokenList: false })
    ).toBe("UNKNOWN");
  });
});
