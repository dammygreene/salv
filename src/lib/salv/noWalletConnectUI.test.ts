import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phase 7, required test item 16: "no wallet-adapter UI in the primary
 * scan flow." The primary flow is paste-address-only (no Phantom/
 * Solflare/Backpack connect button, no "Connect Wallet" language)
 * end-to-end: /scan (the SPL token-account recovery tool) and /rewards
 * (the new paste -> scan -> SALV allocation flow).
 *
 * Wallet-adapter *signing* is still a real, necessary feature (actually
 * confirming/sending a recovery transaction requires a real signature)
 * -- it is intentionally relocated to review-modal.tsx, which only
 * renders at the moment a transaction is actually about to be signed,
 * never on the primary scan/paste screen. This test asserts that
 * confinement statically, the same way noSecretExposure.test.ts statically
 * confines the distributor secret key to one file.
 */

const WALLET_ADAPTER_SYMBOLS = ["availableWallets", "connectExtensionWallet"];
const CONNECT_LANGUAGE = /connect\s*wallet/i;

function read(relativePath: string): string {
  return readFileSync(join(__dirname, "..", "..", "app", relativePath), "utf8");
}

describe("no wallet-adapter UI in the primary scan/rewards flow", () => {
  it("scan/page.tsx never references wallet-adapter connect symbols", () => {
    const source = read(join("scan", "page.tsx"));
    for (const symbol of WALLET_ADAPTER_SYMBOLS) {
      expect(source).not.toContain(symbol);
    }
  });

  it("rewards/page.tsx never references wallet-adapter connect symbols", () => {
    const source = read(join("rewards", "page.tsx"));
    for (const symbol of WALLET_ADAPTER_SYMBOLS) {
      expect(source).not.toContain(symbol);
    }
  });

  it("scan/page.tsx never uses 'Connect Wallet'-style language", () => {
    const source = read(join("scan", "page.tsx"));
    expect(source).not.toMatch(CONNECT_LANGUAGE);
  });

  it("rewards/page.tsx never uses 'Connect Wallet'-style language", () => {
    const source = read(join("rewards", "page.tsx"));
    expect(source).not.toMatch(CONNECT_LANGUAGE);
  });

  it("the extension-connect control is confined to review-modal.tsx (the real sign-a-transaction step)", () => {
    const reviewModalSource = readFileSync(join(__dirname, "..", "..", "components", "review-modal.tsx"), "utf8");
    expect(reviewModalSource).toContain("connectExtensionWallet");
  });

  it("the global nav no longer renders any wallet connect/disconnect control", () => {
    const navSource = readFileSync(join(__dirname, "..", "..", "components", "nav-capsule.tsx"), "utf8");
    expect(navSource).not.toMatch(CONNECT_LANGUAGE);
    for (const symbol of WALLET_ADAPTER_SYMBOLS) {
      expect(navSource).not.toContain(symbol);
    }
  });
});
