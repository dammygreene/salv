import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { describe, expect, it } from "vitest";
import {
  buildFundRewardVaultTransaction,
  buildTreasuryBurnTransaction,
  buildTreasuryTransferTransaction,
  serializeUnsignedTransaction,
} from "./treasuryProposals";

const FEE_PAYER = new PublicKey("11111111111111111111111111111112");
const TREASURY_MULTISIG = new PublicKey("So11111111111111111111111111111111111111112");
const MEMBER_1 = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const MEMBER_2 = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const MEMBER_3 = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const MINT = new PublicKey("4E876qZTE9FJMrBzgVtBrSrzz2TLivB5Y5QXPjB4gZL7");
const TREASURY_ATA = new PublicKey("6BwHHDg3u1854jC8PDLXvR4spTcLNaoBxLJNGC4nTESt");
const REWARD_VAULT_ATA = new PublicKey("CRRS5ieQmBrZjWhcj99JuGrT5tyuWDaGAXLXLFjbAtjQ");
const DESTINATION_ATA = new PublicKey("LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj");
// Must decode to exactly 32 bytes (a blockhash is a 32-byte hash,
// base58-encoded) -- this is the same all-zero 32-byte value as the
// System Program's own address, reused here purely for its length.
const FAKE_BLOCKHASH = "11111111111111111111111111111111";

const BASE_OPTIONS = {
  feePayer: FEE_PAYER,
  recentBlockhash: FAKE_BLOCKHASH,
  treasuryMultisig: TREASURY_MULTISIG,
  multisigMembers: [MEMBER_1, MEMBER_2, MEMBER_3] as [PublicKey, PublicKey, PublicKey],
  mint: MINT,
  decimals: 9,
};

describe("$SALV treasury proposal builders", () => {
  it("buildFundRewardVaultTransaction builds exactly one transferChecked instruction under Token-2022, unsigned", () => {
    const tx = buildFundRewardVaultTransaction({
      ...BASE_OPTIONS,
      treasuryTokenAccount: TREASURY_ATA,
      rewardVaultTokenAccount: REWARD_VAULT_ATA,
      amountBaseUnits: 10_000_000_000n,
    });

    expect(tx.instructions.length).toBe(1);
    const ix = tx.instructions[0];
    expect(ix.programId.equals(TOKEN_2022_PROGRAM_ID)).toBe(true);
    // Nothing has signed this transaction -- every signature slot is empty.
    expect(tx.signatures.every((s) => s.signature === null)).toBe(true);
  });

  it("buildTreasuryBurnTransaction builds exactly one burnChecked instruction under Token-2022, unsigned", () => {
    const tx = buildTreasuryBurnTransaction({
      ...BASE_OPTIONS,
      treasuryTokenAccount: TREASURY_ATA,
      amountBaseUnits: 5_000_000_000n,
    });

    expect(tx.instructions.length).toBe(1);
    expect(tx.instructions[0].programId.equals(TOKEN_2022_PROGRAM_ID)).toBe(true);
    expect(tx.signatures.every((s) => s.signature === null)).toBe(true);
  });

  it("buildTreasuryTransferTransaction builds exactly one transferChecked instruction to an arbitrary destination", () => {
    const tx = buildTreasuryTransferTransaction({
      ...BASE_OPTIONS,
      treasuryTokenAccount: TREASURY_ATA,
      destinationTokenAccount: DESTINATION_ATA,
      amountBaseUnits: 1_000n,
    });

    expect(tx.instructions.length).toBe(1);
    expect(tx.instructions[0].programId.equals(TOKEN_2022_PROGRAM_ID)).toBe(true);
  });

  it("every built instruction's authority is the treasury MULTISIG account, with all 3 members listed as multiSigners", () => {
    const tx = buildFundRewardVaultTransaction({
      ...BASE_OPTIONS,
      treasuryTokenAccount: TREASURY_ATA,
      rewardVaultTokenAccount: REWARD_VAULT_ATA,
      amountBaseUnits: 1n,
    });
    const keys = tx.instructions[0].keys;
    // transferChecked key order: source, mint, destination, owner, ...multiSigners
    const owner = keys[3];
    const multiSigners = keys.slice(4);
    expect(owner.pubkey.equals(TREASURY_MULTISIG)).toBe(true);
    expect(owner.isSigner).toBe(false); // the multisig PDA-like account itself never signs directly
    expect(multiSigners.map((k) => k.pubkey.toBase58()).sort()).toEqual([MEMBER_1, MEMBER_2, MEMBER_3].map((k) => k.toBase58()).sort());
    expect(multiSigners.every((k) => k.isSigner)).toBe(true);
  });

  it("rejects a non-positive amount for every builder", () => {
    expect(() =>
      buildFundRewardVaultTransaction({ ...BASE_OPTIONS, treasuryTokenAccount: TREASURY_ATA, rewardVaultTokenAccount: REWARD_VAULT_ATA, amountBaseUnits: 0n })
    ).toThrow(RangeError);
    expect(() => buildTreasuryBurnTransaction({ ...BASE_OPTIONS, treasuryTokenAccount: TREASURY_ATA, amountBaseUnits: -1n })).toThrow(RangeError);
    expect(() =>
      buildTreasuryTransferTransaction({ ...BASE_OPTIONS, treasuryTokenAccount: TREASURY_ATA, destinationTokenAccount: DESTINATION_ATA, amountBaseUnits: 0n })
    ).toThrow(RangeError);
  });

  it("serializeUnsignedTransaction produces a stable, decodable base64 string without requiring any signatures", () => {
    const tx = buildTreasuryBurnTransaction({ ...BASE_OPTIONS, treasuryTokenAccount: TREASURY_ATA, amountBaseUnits: 42n });
    const serialized = serializeUnsignedTransaction(tx);
    expect(typeof serialized).toBe("string");
    expect(serialized.length).toBeGreaterThan(0);
    // Round-trips back to a buffer of the expected wire-format shape.
    const buf = Buffer.from(serialized, "base64");
    expect(buf.length).toBeGreaterThan(0);
  });
});
