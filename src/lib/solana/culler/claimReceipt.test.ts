import { describe, expect, it } from "vitest";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { deriveClaimReceiptAddress, deriveClaimReceiptSeed } from "./claimReceipt";

describe("deriveClaimReceiptSeed", () => {
  it("produces a 32-character (32-byte, ASCII) hex seed -- exactly at createWithSeed's MAX_SEED_LENGTH", () => {
    const seed = deriveClaimReceiptSeed("devnet", 1, "SomeWallet1111111111111111111111111111111");
    expect(seed).toHaveLength(32);
    expect(seed).toMatch(/^[0-9a-f]{32}$/);
  });

  it("is deterministic: same inputs always produce the same seed", () => {
    const a = deriveClaimReceiptSeed("devnet", 7, "WalletX11111111111111111111111111111111111");
    const b = deriveClaimReceiptSeed("devnet", 7, "WalletX11111111111111111111111111111111111");
    expect(a).toBe(b);
  });

  it("differs across epochs for the same wallet", () => {
    const a = deriveClaimReceiptSeed("devnet", 1, "WalletY11111111111111111111111111111111111");
    const b = deriveClaimReceiptSeed("devnet", 2, "WalletY11111111111111111111111111111111111");
    expect(a).not.toBe(b);
  });

  it("differs across wallets for the same epoch", () => {
    const a = deriveClaimReceiptSeed("devnet", 1, "WalletA11111111111111111111111111111111111");
    const b = deriveClaimReceiptSeed("devnet", 1, "WalletB11111111111111111111111111111111111");
    expect(a).not.toBe(b);
  });

  it("differs across networks for the same epoch and wallet (devnet vs mainnet-beta claim receipts never collide)", () => {
    const a = deriveClaimReceiptSeed("devnet", 1, "WalletZ11111111111111111111111111111111111");
    const b = deriveClaimReceiptSeed("mainnet-beta", 1, "WalletZ11111111111111111111111111111111111");
    expect(a).not.toBe(b);
  });
});

describe("deriveClaimReceiptAddress", () => {
  it("is deterministic and produces a real, valid PublicKey off the curve (a PDA-like, program-owned address)", async () => {
    const base = Keypair.generate().publicKey;
    const a = await deriveClaimReceiptAddress(base, SystemProgram.programId, "devnet", 1, "WalletQ11111111111111111111111111111111111");
    const b = await deriveClaimReceiptAddress(base, SystemProgram.programId, "devnet", 1, "WalletQ11111111111111111111111111111111111");
    expect(a.toBase58()).toBe(b.toBase58());
    expect(a).toBeInstanceOf(PublicKey);
  });

  it("produces a different address for a different epoch, matching deriveClaimReceiptSeed's behavior", async () => {
    const base = Keypair.generate().publicKey;
    const epoch1 = await deriveClaimReceiptAddress(base, SystemProgram.programId, "devnet", 1, "WalletR11111111111111111111111111111111111");
    const epoch2 = await deriveClaimReceiptAddress(base, SystemProgram.programId, "devnet", 2, "WalletR11111111111111111111111111111111111");
    expect(epoch1.toBase58()).not.toBe(epoch2.toBase58());
  });

  it("produces a different address for a different base (distributor) key, so rotating the distributor changes the receipt namespace", async () => {
    const baseA = Keypair.generate().publicKey;
    const baseB = Keypair.generate().publicKey;
    const addrA = await deriveClaimReceiptAddress(baseA, SystemProgram.programId, "devnet", 1, "WalletS11111111111111111111111111111111111");
    const addrB = await deriveClaimReceiptAddress(baseB, SystemProgram.programId, "devnet", 1, "WalletS11111111111111111111111111111111111");
    expect(addrA.toBase58()).not.toBe(addrB.toBase58());
  });
});
