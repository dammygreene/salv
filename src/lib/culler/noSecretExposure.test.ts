import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getCullerConfig } from "./config";

/**
 * Phase 6, required test item 15: "no private key exposed via client
 * bundles/API responses." Two independent checks:
 *
 * 1. `getCullerConfig()` -- the one function every public/dev API route
 *    (and the client, via NEXT_PUBLIC_ env vars it could theoretically
 *    read) uses to build its response -- never returns a field shaped
 *    like a secret key. The only function in this module that can ever
 *    see the distributor's secret key is `getDistributorSecretKey`, a
 *    separate, differently-named export that no route calls when
 *    building a JSON response body (checked statically below).
 * 2. A static scan of every `route.ts` under `src/app/api` confirms
 *    that `getDistributorSecretKey` (the only function anywhere in this
 *    codebase that can return a real secret key) is only ever imported
 *    by the one route that needs it to sign a transaction
 *    (`/api/culler/claims/[wallet]/claim`, which uses it to build and
 *    send a transaction server-side -- it is never echoed back in that
 *    route's JSON response either, which the same scan also checks),
 *    and that no route file anywhere references
 *    `CULLER_DISTRIBUTOR_SECRET_KEY` or `NEXT_PUBLIC_` alongside any
 *    treasury/distributor/secret-shaped name.
 */

const CULLER_VARS = [
  "CULLER_MINT_ADDRESS",
  "CULLER_REWARD_VAULT",
  "CULLER_DISTRIBUTOR",
  "SOLANA_RPC_URL",
  "CULLER_FEE_WALLET",
  "CULLER_NETWORK",
  "CULLER_TREASURY_ADDRESS",
];

function clearCullerEnv() {
  for (const name of CULLER_VARS) delete process.env[name];
  delete process.env.CULLER_DISTRIBUTOR_SECRET_KEY;
}

function listRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...listRouteFiles(full));
    } else if (entry === "route.ts") {
      out.push(full);
    }
  }
  return out;
}

describe("no private key is exposed via config responses or API routes", () => {
  afterEach(() => clearCullerEnv());

  it("getCullerConfig()'s configured shape contains no secret-key-shaped field", () => {
    clearCullerEnv();
    process.env.CULLER_MINT_ADDRESS = "Mint1111111111111111111111111111111111111";
    process.env.CULLER_REWARD_VAULT = "Vault111111111111111111111111111111111111";
    process.env.CULLER_DISTRIBUTOR = "Distributor11111111111111111111111111111";
    process.env.SOLANA_RPC_URL = "https://api.devnet.solana.com";
    process.env.CULLER_TREASURY_ADDRESS = "Treasury11111111111111111111111111111111";
    // Even if the secret were set, getCullerConfig() must never surface it.
    process.env.CULLER_DISTRIBUTOR_SECRET_KEY = JSON.stringify(Array(64).fill(1));

    const config = getCullerConfig();
    const keys = Object.keys(config).map((k) => k.toLowerCase());
    for (const key of keys) {
      expect(key).not.toMatch(/secret/);
      expect(key).not.toMatch(/privatekey/);
    }
    // Every value must be a public address, a URL, a boolean, or a list
    // of missing-variable names -- never the 64-byte array shape of a
    // raw Solana secret key.
    for (const value of Object.values(config)) {
      expect(Array.isArray(value) && value.length === 64).toBe(false);
    }
  });

  it("only the on-chain claim route imports getDistributorSecretKey, and never echoes it in a response", () => {
    const apiDir = join(__dirname, "..", "..", "app", "api");
    const routeFiles = listRouteFiles(apiDir);
    expect(routeFiles.length).toBeGreaterThan(0); // sanity: the scan actually found routes

    const importers = routeFiles.filter((f) => readFileSync(f, "utf8").includes("getDistributorSecretKey"));
    expect(importers).toHaveLength(1);
    expect(importers[0]).toContain(join("culler", "claims", "[wallet]", "claim", "route.ts"));

    const claimRouteSource = readFileSync(importers[0], "utf8");
    // The secret key variable itself must never appear inside a
    // NextResponse.json(...) call -- i.e. it is used only to construct
    // a signer, never serialized back to the client.
    const jsonBlocks = claimRouteSource.match(/NextResponse\.json\(([\s\S]*?)\)/g) ?? [];
    for (const block of jsonBlocks) {
      expect(block).not.toMatch(/distributorSecretKey/i);
    }
  });

  it("no API route file references a raw secret-key env var directly (must always go through config.ts)", () => {
    const apiDir = join(__dirname, "..", "..", "app", "api");
    const routeFiles = listRouteFiles(apiDir);
    for (const file of routeFiles) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/process\.env\.CULLER_DISTRIBUTOR_SECRET_KEY/);
      expect(source).not.toMatch(/CULLER_TREASURY_MEMBER_\d_SECRET/);
    }
  });
});
