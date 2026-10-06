import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phase 8: static structural checks for the combined Solana+Robinhood
 * scan form on /scan and /rewards. Mirrors the approach of
 * noWalletConnectUI.test.ts -- these assertions read the actual page
 * source rather than rendering it, so they catch a regression (a second
 * Scan button reappearing, a "Connect Wallet" control sneaking back in,
 * the required/optional copy being dropped or edited) even without a
 * full component-test harness in this repo.
 */

const CONNECT_LANGUAGE = /connect\s*wallet/i;
const REQUIRED_COPY = "Solana wallet required for $CULLER rewards.";
const OPTIONAL_COPY = "Optional. Add your Robinhood wallet to scan both.";

function read(relativePath: string): string {
  return readFileSync(join(__dirname, "..", "..", "app", relativePath), "utf8");
}

/** Counts `<button type="submit"` occurrences -- the one true "Scan
 * Wallet" affordance per form. Other buttons on these pages (e.g. "Scan
 * a different address", "Or scan a demo wallet", "Rescan wallet",
 * "Claim CULLER") are all `type="button"`, not submit, and are not part of
 * the combined-submission form itself. */
function countSubmitButtons(source: string): number {
  return (source.match(/<button\s+type="submit"/g) ?? []).length;
}

describe.each([
  ["scan/page.tsx", join("scan", "page.tsx")],
  ["rewards/page.tsx", join("rewards", "page.tsx")],
])("combined Solana+Robinhood wallet form in %s", (_label, relativePath) => {
  const source = read(relativePath);

  it("never renders 'Connect Wallet'-style language", () => {
    expect(source).not.toMatch(CONNECT_LANGUAGE);
  });

  it("has a Solana wallet input", () => {
    expect(source).toMatch(/Solana wallet address/i);
  });

  it("has a Robinhood wallet input", () => {
    expect(source).toMatch(/Robinhood wallet address/i);
  });

  it("marks the Solana input as required", () => {
    // The Solana <input> block includes `required` as a literal JSX prop.
    const solanaInputBlock = source.slice(source.indexOf("Solana wallet address"), source.indexOf("Solana wallet address") + 400);
    expect(solanaInputBlock).toMatch(/\brequired\b/);
  });

  it("marks the Robinhood input as optional (placeholder/label says so, and no `required` prop on it)", () => {
    const idx = source.indexOf("Robinhood wallet address");
    const robinhoodInputBlock = source.slice(idx, idx + 400);
    expect(source).toMatch(/Robinhood wallet \(optional\)/i);
    expect(robinhoodInputBlock).not.toMatch(/\brequired\b/);
  });

  it("renders the exact required copy: Solana is required for $CULLER rewards", () => {
    expect(source).toContain(REQUIRED_COPY);
  });

  it("renders the exact required copy: Robinhood is optional and scans both", () => {
    expect(source).toContain(OPTIONAL_COPY);
  });

  it("has exactly ONE submit ('Scan Wallet') button -- no second Scan button for Robinhood", () => {
    expect(countSubmitButtons(source)).toBe(1);
  });

  it("validates via validateCombinedWalletSubmission, which always rejects a Robinhood-only submission", () => {
    expect(source).toContain("validateCombinedWalletSubmission");
  });

  it("both addresses are submitted together in one request body (a single fetch('/api/culler/scan', ...) call per submit)", () => {
    const scanCalls = (source.match(/fetch\(\s*"\/api\/culler\/scan"/g) ?? []).length;
    expect(scanCalls).toBe(1);
  });
});
