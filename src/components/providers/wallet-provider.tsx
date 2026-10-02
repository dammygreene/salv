"use client";

import "@/lib/polyfills";
import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { SOLANA_RPC_ENDPOINT } from "@/lib/solana/connection";

/**
 * Wallet Standard auto-detection: passing an empty adapter list lets
 * @solana/wallet-adapter-react discover any Wallet-Standard-compliant
 * extension the browser already has installed (Phantom, Solflare,
 * Backpack, etc.) without pulling in the legacy per-wallet adapter
 * packages. No wallet is ever asked for anything beyond its public key.
 */
export function SolanaWalletProvider({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={SOLANA_RPC_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
