import { isValidSolanaAddress } from "@/lib/solana/validation/address";

export type PublicCullerNetwork = "devnet" | "testnet" | "mainnet-beta";
export type PublicCullerMintStatus = "prelaunch" | "live" | "invalid";

export interface PublicCullerConfig {
  network: PublicCullerNetwork;
  siteUrl: string;
  tokenName: string;
  tokenSymbol: string;
  mintAddress: string | null;
  mintStatus: PublicCullerMintStatus;
  configurationError: string | null;
}

const NETWORKS: PublicCullerNetwork[] = ["devnet", "testnet", "mainnet-beta"];
const MINT_ENV_ORDER = ["NEXT_PUBLIC_CULLER_MINT_ADDRESS", "CULLER_MINT_ADDRESS"] as const;

function readNetwork(value: string | undefined): PublicCullerNetwork {
  const normalized = value?.trim();
  return NETWORKS.includes(normalized as PublicCullerNetwork) ? (normalized as PublicCullerNetwork) : "mainnet-beta";
}

export function getPublicCullerConfig(): PublicCullerConfig {
  let rawMintAddress = "";
  let mintEnvSource: (typeof MINT_ENV_ORDER)[number] = MINT_ENV_ORDER[0];
  for (const name of MINT_ENV_ORDER) {
    const value = process.env[name]?.trim() ?? "";
    if (value) {
      rawMintAddress = value;
      mintEnvSource = name;
      break;
    }
  }
  const network = readNetwork(process.env.NEXT_PUBLIC_CULLER_NETWORK);
  const tokenName = process.env.NEXT_PUBLIC_CULLER_TOKEN_NAME?.trim() || "CULLER";
  const tokenSymbol = process.env.NEXT_PUBLIC_CULLER_TOKEN_SYMBOL?.trim() || "CULLER";
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://cullerlabs.xyz";

  if (!rawMintAddress) {
    return { network, siteUrl, tokenName, tokenSymbol, mintAddress: null, mintStatus: "prelaunch", configurationError: null };
  }

  if (!isValidSolanaAddress(rawMintAddress)) {
    return {
      network,
      siteUrl,
      tokenName,
      tokenSymbol,
      mintAddress: null,
      mintStatus: "invalid",
      configurationError: `${mintEnvSource} is not a valid Solana address.`,
    };
  }

  return { network, siteUrl, tokenName, tokenSymbol, mintAddress: rawMintAddress, mintStatus: "live", configurationError: null };
}

export function getCullerExplorerUrl(config: PublicCullerConfig): string | null {
  if (!config.mintAddress) return null;
  const cluster = config.network === "mainnet-beta" ? "" : `?cluster=${config.network}`;
  return `https://solscan.io/token/${config.mintAddress}${cluster}`;
}

export function shortenCullerMint(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
