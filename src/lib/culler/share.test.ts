import { describe, expect, it } from "vitest";
import {
  buildCullerPostText,
  buildCullerShareCardSvg,
  formatCullerAllocation,
  hasCullerAllocation,
  shortenCullerWallet,
} from "./share";

describe("Culler share data", () => {
  it("formats decimal allocations without floating point or trailing zeroes", () => {
    expect(formatCullerAllocation("960.000000000")).toBe("960");
    expect(formatCullerAllocation("12480")).toBe("12,480");
    expect(formatCullerAllocation("0.125000000")).toBe("0.125");
  });

  it("accepts only positive decimal allocations", () => {
    expect(hasCullerAllocation("0")).toBe(false);
    expect(hasCullerAllocation("0.000000001")).toBe(true);
    expect(hasCullerAllocation("12.5")).toBe(true);
    expect(hasCullerAllocation("12e3")).toBe(false);
  });

  it("shortens a wallet for public sharing", () => {
    expect(shortenCullerWallet("8a2f1234567891c4")).toBe("8a2f...91c4");
  });

  it("builds an editable post from the authoritative allocation", () => {
    const post = buildCullerPostText({ allocation: "12480.000000000", verified: true });
    expect(post).toContain("+12,480 $CULLER");
    expect(post).toContain("cullerlabs.xyz");
  });

  it("renders the allocation, status, logo and canonical site into one card", () => {
    const card = buildCullerShareCardSvg({
      allocation: "12480.000000000",
      walletAddress: "8a2f1234567891c4",
      verified: true,
    });
    expect(card).toContain("+12,480");
    expect(card).toContain("ALLOCATION VERIFIED");
    expect(card).toContain("/brand/culler-logo-on-dark.svg");
    expect(card).toContain("cullerlabs.xyz");
  });
});
