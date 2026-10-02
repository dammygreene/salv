import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Db } from "../db/types";
import { createTestDb, resetTestDb } from "../db/testDb";
import { listTokenDeployments, recordTokenDeployment } from "./tokenDeploymentRepo";

function baseInput(overrides: Partial<Parameters<typeof recordTokenDeployment>[1]> = {}) {
  return {
    network: "devnet" as const,
    mintAddress: "Mint1111111111111111111111111111111111111",
    tokenProgram: "TOKEN_PROGRAM_ID",
    decimals: 9,
    mintAuthority: "Deployer111111111111111111111111111111111",
    freezeAuthority: "Deployer111111111111111111111111111111111",
    rewardVaultAddress: "Vault1111111111111111111111111111111111111",
    distributorAddress: "Deployer111111111111111111111111111111111",
    marketHoldingAddress: "Market111111111111111111111111111111111111",
    ...overrides,
  };
}

describe("tokenDeploymentRepo", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30_000);

  beforeEach(async () => {
    await resetTestDb(db);
  });

  it("records a deployment with every documented field, including both (unrevoked) authorities", async () => {
    const record = await recordTokenDeployment(db, baseInput());
    expect(record.network).toBe("devnet");
    expect(record.mintAuthority).toBe("Deployer111111111111111111111111111111111");
    expect(record.freezeAuthority).toBe("Deployer111111111111111111111111111111111");
    expect(record.rewardVaultAddress).toBe("Vault1111111111111111111111111111111111111");
  });

  it("records revoked authorities as null, never as an empty string or placeholder", async () => {
    const record = await recordTokenDeployment(db, baseInput({ mintAuthority: null, freezeAuthority: null }));
    expect(record.mintAuthority).toBeNull();
    expect(record.freezeAuthority).toBeNull();
  });

  it("upserts on (network, mint_address): re-recording the same mint updates authority state in place instead of creating a duplicate row", async () => {
    const first = await recordTokenDeployment(db, baseInput());
    const second = await recordTokenDeployment(db, baseInput({ mintAuthority: null, freezeAuthority: null, notes: "authorities revoked" }));

    expect(second.id).toBe(first.id); // same row, not a new deployment entry
    expect(second.mintAuthority).toBeNull();
    expect(second.notes).toBe("authorities revoked");

    const all = await listTokenDeployments(db);
    expect(all).toHaveLength(1);
  });

  it("a different mint address on the same network is a distinct deployment row", async () => {
    await recordTokenDeployment(db, baseInput());
    await recordTokenDeployment(db, baseInput({ mintAddress: "Mint2222222222222222222222222222222222222" }));

    const all = await listTokenDeployments(db);
    expect(all).toHaveLength(2);
  });

  it("the same mint address recorded on a different network is also a distinct row (network is part of the identity)", async () => {
    await recordTokenDeployment(db, baseInput({ network: "devnet" }));
    await recordTokenDeployment(db, baseInput({ network: "testnet" }));

    const all = await listTokenDeployments(db);
    expect(all).toHaveLength(2);
  });

  it("listTokenDeployments orders most-recently-deployed first", async () => {
    await recordTokenDeployment(db, baseInput({ mintAddress: "MintOld11111111111111111111111111111111111" }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    await recordTokenDeployment(db, baseInput({ mintAddress: "MintNew11111111111111111111111111111111111" }));

    const all = await listTokenDeployments(db);
    expect(all[0].mintAddress).toBe("MintNew11111111111111111111111111111111111");
  });
});
