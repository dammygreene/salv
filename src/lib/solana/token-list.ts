export interface TokenListEntry {
  symbol: string;
  name: string;
}

const TOKEN_LIST_URL = "https://token.jup.ag/strict";
const CACHE_KEY = "cull_token_list_v1";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * A handful of mints that must resolve correctly even if the network
 * fetch for the full verified token list fails or is blocked. Everything
 * else that cannot be resolved is surfaced honestly as an unknown token
 * rather than guessed at.
 */
const FALLBACK_TOKENS: Record<string, TokenListEntry> = {
  So11111111111111111111111111111111111111112: { symbol: "wSOL", name: "Wrapped SOL" },
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: "USDC", name: "USD Coin" },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: "USDT", name: "Tether USD" },
};

let memoryCache: Map<string, TokenListEntry> | null = null;
let memoryCacheAt = 0;

function readSessionCache(): Map<string, TokenListEntry> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; entries: [string, TokenListEntry][] };
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return new Map(parsed.entries);
  } catch {
    return null;
  }
}

function writeSessionCache(map: Map<string, TokenListEntry>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), entries: Array.from(map.entries()) }));
  } catch {
    // storage disabled or full, safe to ignore
  }
}

/**
 * Fetches Jupiter's verified ("strict") token list for symbol/name
 * resolution. Never throws: a failed or blocked fetch just means every
 * non-fallback mint is labeled as an unknown token instead of crashing
 * the scan.
 */
export async function getTokenList(): Promise<Map<string, TokenListEntry>> {
  const now = Date.now();
  if (memoryCache && now - memoryCacheAt < CACHE_TTL_MS) return memoryCache;

  const cached = readSessionCache();
  if (cached) {
    memoryCache = cached;
    memoryCacheAt = now;
    return cached;
  }

  const map = new Map<string, TokenListEntry>(Object.entries(FALLBACK_TOKENS));

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(TOKEN_LIST_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const list = (await res.json()) as Array<{ address: string; symbol: string; name: string }>;
      for (const entry of list) {
        map.set(entry.address, { symbol: entry.symbol, name: entry.name });
      }
    }
  } catch {
    // network blocked or unavailable, fall back tokens above still apply
  }

  memoryCache = map;
  memoryCacheAt = now;
  writeSessionCache(map);
  return map;
}
