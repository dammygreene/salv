import "server-only";

export interface RobinhoodChainConfig {
  rpcUrl: string | null;
  chainId: number;
  configured: boolean;
  configurationError: string | null;
}

const ROBINHOOD_CHAIN_ID = 4663;
function readRpcUrl(value: string | undefined): { url: string | null; error: string | null } {
  const raw = value?.trim();
  if (!raw) return { url: null, error: null };
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { url: null, error: "ROBINHOOD_RPC_URL must use http or https." };
    }
    return { url: parsed.toString(), error: null };
  } catch {
    return { url: null, error: "ROBINHOOD_RPC_URL is not a valid URL." };
  }
}

export function getRobinhoodChainConfig(): RobinhoodChainConfig {
  const configuredRpc = process.env.ROBINHOOD_RPC_URL?.trim();
  const rpc = readRpcUrl(configuredRpc);
  const rawChainId = process.env.ROBINHOOD_CHAIN_ID?.trim() || String(ROBINHOOD_CHAIN_ID);
  const chainId = Number(rawChainId);

  if (!Number.isInteger(chainId) || chainId !== ROBINHOOD_CHAIN_ID) {
    return {
      rpcUrl: rpc.url,
      chainId,
      configured: false,
      configurationError: `ROBINHOOD_CHAIN_ID must be ${ROBINHOOD_CHAIN_ID}.`,
    };
  }

  return {
    rpcUrl: rpc.url,
    chainId,
    configured: Boolean(configuredRpc) && !rpc.error,
    configurationError: rpc.error,
  };
}

export { ROBINHOOD_CHAIN_ID };
