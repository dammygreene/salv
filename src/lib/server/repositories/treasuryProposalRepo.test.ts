import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Db } from "../db/types";
import { createTestDb, resetTestDb } from "../db/testDb";
import { listTreasuryProposals, recordTreasuryProposal, TreasuryProposalError } from "./treasuryProposalRepo";

describe("treasuryProposalRepo", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30_000);

  beforeEach(async () => {
    await resetTestDb(db);
  });

  it("records a built (never executed) proposal", async () => {
    const proposal = await recordTreasuryProposal(db, {
      proposalType: "FUND_REWARD_VAULT",
      amountBaseUnits: 10_000_000_000n,
      destinationAddress: "RewardVault1111111111111111111111111111111",
      memo: "Q1 epoch funding tranche",
      unsignedTransactionBase64: "dW5zaWduZWQtdHgtcGxhY2Vob2xkZXI=",
      createdBy: "dev-admin",
    });
    expect(proposal.proposalType).toBe("FUND_REWARD_VAULT");
    expect(proposal.amountBaseUnits).toBe(10_000_000_000n);
    expect(proposal.unsignedTransactionBase64).toBeTruthy();
  });

  it("the record has no status/executed field whatsoever -- proposal creation can never be confused with execution", async () => {
    const proposal = await recordTreasuryProposal(db, {
      proposalType: "BURN",
      amountBaseUnits: 1_000n,
      destinationAddress: "BurnTarget111111111111111111111111111111",
    });
    expect(Object.keys(proposal)).not.toContain("status");
    expect(Object.keys(proposal)).not.toContain("executed");
    expect(Object.keys(proposal)).not.toContain("executedAt");
  });

  it("rejects a non-positive amount", async () => {
    await expect(
      recordTreasuryProposal(db, { proposalType: "TRANSFER", amountBaseUnits: 0n, destinationAddress: "X111111111111111111111111111111111111111" })
    ).rejects.toBeInstanceOf(TreasuryProposalError);
  });

  it("rejects an empty destination address", async () => {
    await expect(recordTreasuryProposal(db, { proposalType: "TRANSFER", amountBaseUnits: 1n, destinationAddress: "   " })).rejects.toBeInstanceOf(
      TreasuryProposalError
    );
  });

  it("listTreasuryProposals returns every proposal, most recent first", async () => {
    await recordTreasuryProposal(db, { proposalType: "BURN", amountBaseUnits: 1n, destinationAddress: "A1111111111111111111111111111111111111111" });
    await recordTreasuryProposal(db, { proposalType: "TRANSFER", amountBaseUnits: 2n, destinationAddress: "B1111111111111111111111111111111111111111" });
    const proposals = await listTreasuryProposals(db);
    expect(proposals.length).toBe(2);
    expect(proposals[0].proposalType).toBe("TRANSFER");
  });

  it("the append-only trigger rejects any attempt to mutate a recorded proposal", async () => {
    const proposal = await recordTreasuryProposal(db, {
      proposalType: "BURN",
      amountBaseUnits: 1_000n,
      destinationAddress: "Immutable1111111111111111111111111111111",
    });
    await expect(db.query("UPDATE treasury_proposals SET memo = 'tampered' WHERE id = $1", [proposal.id])).rejects.toThrow();
    await expect(db.query("DELETE FROM treasury_proposals WHERE id = $1", [proposal.id])).rejects.toThrow();
  });
});
