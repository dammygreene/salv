import { describe, expect, it, vi } from "vitest";
import { TOKEN_PROGRAM_ID, getTokenAccountsByOwner } from "./rpc";
import { getTokenList } from "../token-list";
import { scanWallet } from "./scan";

vi.mock("./rpc", async () => {
  const actual = await vi.importActual<typeof import("./rpc")>("./rpc");
  return { ...actual, getTokenAccountsByOwner: vi.fn(), getLatestActivityBlockTime: vi.fn() };
});

vi.mock("../token-list", () => ({ getTokenList: vi.fn() }));

const WALLET = "FAucetgjU1jYWsiL8BfdTrpLNt2U8kqdVfgvbnGqG5sG";
const MINT_EMPTY = "So11111111111111111111111111111111111111112";
const MINT_NFT = "NFT1111111111111111111111111111111111111111";
const MINT_UNKNOWN = "Unknown111111111111111111111111111111111111";

function tokenAccount(pubkey: string, mint: string, amount: string, decimals: number, lamports: number) {
  return {
    pubkey,
    account: {
      lamports,
      data: {
        program: "spl-token",
        parsed: {
          type: "account",
          info: {
            mint,
            owner: WALLET,
            state: "initialized",
            tokenAmount: {
              amount,
              decimals,
              uiAmount: amount === "0" ? 0 : decimals === 0 ? 1 : 12.5,
              uiAmountString: amount === "0" ? "0" : decimals === 0 ? "1" : "12.5",
            },
          },
        },
      },
    },
  };
}

describe("Solana asset discovery", () => {
  it("returns empty accounts, fungible tokens, NFTs, and unknown assets from both token programs", async () => {
    vi.mocked(getTokenAccountsByOwner).mockImplementation(async (_owner, programId) =>
      programId === TOKEN_PROGRAM_ID
        ? [tokenAccount("empty-account", MINT_EMPTY, "0", 9, 2039280)]
        : [
            tokenAccount("nft-account", MINT_NFT, "1", 0, 2039280),
            tokenAccount("unknown-account", MINT_UNKNOWN, "12500000", 6, 2039280),
          ]
    );
    vi.mocked(getTokenList).mockResolvedValue(
      new Map([[MINT_EMPTY, { symbol: "wSOL", name: "Wrapped SOL" }]])
    );

    const result = await scanWallet(WALLET);

    expect(result.accountsFound).toBe(3);
    expect(result.assets).toHaveLength(3);
    expect(result.assets.map((asset) => asset.kind)).toEqual(expect.arrayContaining(["ACCOUNT", "NFT", "TOKEN"]));
    expect(result.assets.find((asset) => asset.kind === "ACCOUNT")?.valueClassification).toBe("EMPTY_ACCOUNT");
    expect(result.assets.find((asset) => asset.kind === "NFT")?.valueClassification).toBe("NFT_UNKNOWN_VALUE");
    expect(result.assets.find((asset) => asset.kind === "TOKEN")?.valueClassification).toBe("FUNGIBLE_UNKNOWN_VALUE");
    expect(result.programStatus).toEqual({ splToken: "available", token2022: "available" });
  });

  it("reports partial provider failure without claiming the wallet is empty", async () => {
    vi.mocked(getTokenAccountsByOwner).mockImplementation(async (_owner, programId) => {
      if (programId === TOKEN_PROGRAM_ID) return [tokenAccount("empty-account", MINT_EMPTY, "0", 9, 2039280)];
      throw new Error("Token-2022 unavailable");
    });
    vi.mocked(getTokenList).mockResolvedValue(new Map());

    const result = await scanWallet(WALLET);

    expect(result.assets).toHaveLength(1);
    expect(result.accountsFound).toBe(1);
    expect(result.programStatus).toEqual({ splToken: "available", token2022: "unavailable" });
  });

  it("processes more than the former 60-account limit", async () => {
    vi.mocked(getTokenAccountsByOwner).mockImplementation(async (_owner, programId) =>
      Array.from({ length: programId === TOKEN_PROGRAM_ID ? 61 : 2 }, (_, index) =>
        tokenAccount(`account-${programId}-${index}`, `Mint-${programId}-${index}`, "1", 6, 2039280)
      )
    );
    vi.mocked(getTokenList).mockResolvedValue(new Map());

    const result = await scanWallet(WALLET);

    expect(result.accountsTotal).toBe(63);
    expect(result.accountsProcessed).toBe(63);
    expect(result.accountsRemaining).toBe(0);
    expect(result.truncated).toBe(false);
    expect(result.assets).toHaveLength(63);
    expect(result.summary.nonEmpty).toBe(63);
  });

  it("processes a 252-account wallet without truncation", async () => {
    vi.mocked(getTokenAccountsByOwner).mockImplementation(async (_owner, programId) =>
      Array.from({ length: programId === TOKEN_PROGRAM_ID ? 231 : 21 }, (_, index) => {
        const isEmpty = index < (programId === TOKEN_PROGRAM_ID ? 6 : 0);
        const isNft = programId === TOKEN_PROGRAM_ID && !isEmpty && index < 34;
        return tokenAccount(
          `wallet-252-${programId}-${index}`,
          `Mint-252-${programId}-${index}`,
          isEmpty ? "0" : "1",
          isNft ? 0 : 6,
          2039280
        );
      })
    );
    vi.mocked(getTokenList).mockResolvedValue(new Map());

    const result = await scanWallet(WALLET);

    expect(result).toMatchObject({
      accountsTotal: 252,
      accountsProcessed: 252,
      accountsRemaining: 0,
      truncated: false,
      summary: { empty: 6, nonEmpty: 246, fungible: 218, nftShaped: 28 },
    });
    expect(result.assets).toHaveLength(252);
  });
});
