"use client";

import { useWallet, Wallet } from "@solana/wallet-adapter-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { scanSteps } from "./data";
import { getConnection } from "./solana/connection";
import { SOLANA_NETWORK } from "./solana/constants";
import { isValidSolanaAddress } from "./solana/base58";
import { ExecutionError } from "./solana/executor/sendAndConfirm";
import { runSalvagePlan } from "./solana/executor/runSalvage";
import { submitForVerification } from "./solana/executor/verify";
import { RecoveryValidationError } from "./solana/recovery/closeAccount";
import { scanWallet, WalletScanError } from "./solana/scanner/scan";
import { buildSalvageTransactionPlan, PlanningError } from "./solana/transactions/planner";
import { Asset, HistoryEvent, ProofEvent, ScanState, WatchItem } from "./types";

export type SalvageStatus =
  | "IDLE"
  | "BUILDING"
  | "AWAITING_SIGNATURE"
  | "CONFIRMING"
  | "VERIFYING"
  | "DONE"
  | "ERROR";

type AppState = {
  connected: boolean;
  walletAddress: string;
  connectError: string | null;
  /** True only when walletAddress came from a real wallet-adapter
   * connection (the wallet itself holds the key and can sign). Pasted or
   * demo addresses are read-only previews and can never sign. */
  canSign: boolean;
  availableWallets: Wallet[];
  connectExtensionWallet: (walletName: string) => void;
  scanState: ScanState;
  scanProgress: number;
  scanError: string | null;
  assets: Asset[];
  hasScanned: boolean;
  accountsFound: number;
  accountsTruncated: boolean;
  selected: string[];
  watchItems: WatchItem[];
  proofEvents: ProofEvent[];
  history: HistoryEvent[];
  rewardScore: number;
  salvageStatus: SalvageStatus;
  salvageError: string | null;
  connectWallet: (address?: string) => void;
  disconnectWallet: () => void;
  startScan: () => void;
  toggleSelected: (id: string) => void;
  clearSelected: () => void;
  addToWatch: (assetId: string) => void;
  confirmSalvage: () => Promise<ProofEvent | null>;
};

const AppStateContext = createContext<AppState | null>(null);

// A real, publicly documented Solana address (the solfaucet.net faucet
// treasury) used only as a one-click "try it" shortcut. It is scanned
// through the same live, read-only RPC path as any pasted address. It is
// always read-only: nobody here holds its private key.
const DEMO_ADDRESS = "FAucetgjU1jYWsiL8BfdTrpLNt2U8kqdVfgvbnGqG5sG";

function shortAddress(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const wallet = useWallet();
  const { publicKey, connected: extensionConnected, wallets, select, connect, disconnect, sendTransaction } = wallet;

  // Read-only "preview" session, from a pasted address or the demo
  // shortcut. Mutually exclusive in the UI with a real signer connection.
  const [pastedConnected, setPastedConnected] = useState(false);
  const [pastedAddress, setPastedAddress] = useState("");
  const [connectError, setConnectError] = useState<string | null>(null);

  const [scanState, setScanState] = useState<ScanState>("READY");
  const [scanError, setScanError] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  const [accountsFound, setAccountsFound] = useState(0);
  const [accountsTruncated, setAccountsTruncated] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [watchItems, setWatchItems] = useState<WatchItem[]>([]);
  const [proofEvents, setProofEvents] = useState<ProofEvent[]>([]);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [rewardScore, setRewardScore] = useState(0);
  const [salvageStatus, setSalvageStatus] = useState<SalvageStatus>("IDLE");
  const [salvageError, setSalvageError] = useState<string | null>(null);
  const connectingExtension = useRef(false);

  // A real wallet-adapter connection always wins over a read-only pasted
  // session, and is the only way canSign can ever be true.
  const canSign = extensionConnected && Boolean(publicKey);
  const connected = canSign || pastedConnected;
  const walletAddress = canSign && publicKey ? publicKey.toBase58() : pastedAddress;

  const pushHistory = useCallback((event: Omit<HistoryEvent, "id" | "timestamp">) => {
    setHistory((current) => [
      { ...event, id: `${event.kind}-${Date.now()}-${current.length}`, timestamp: nowLabel() },
      ...current,
    ]);
  }, []);

  const resetScanState = useCallback(() => {
    setScanState("READY");
    setScanError(null);
    setHasScanned(false);
    setAssets([]);
    setAccountsFound(0);
    setAccountsTruncated(false);
    setSelected([]);
  }, []);

  // React-recommended "adjust state while rendering" pattern (see
  // https://react.dev/learn/you-might-not-need-an-effect): this reacts to
  // a change in the derived `canSign` value within the same render pass,
  // instead of mirroring it into state from inside a useEffect.
  const [prevCanSign, setPrevCanSign] = useState(canSign);
  if (prevCanSign !== canSign) {
    setPrevCanSign(canSign);
    if (canSign && publicKey) {
      pushHistory({ kind: "SCAN", label: "Wallet connected", detail: shortAddress(publicKey.toBase58()) });
    } else {
      // The extension-held session ended (disconnected from the wallet
      // itself, or via disconnectWallet()). Always drop stale scan state.
      resetScanState();
    }
  }

  const connectExtensionWallet = useCallback(
    (walletName: string) => {
      connectingExtension.current = true;
      setConnectError(null);
      select(walletName as never);
    },
    [select]
  );

  // select() only chooses the adapter; it still needs an explicit
  // connect() once it is ready. The setState call below runs inside an
  // async .catch() callback, not synchronously within the effect body.
  useEffect(() => {
    if (!connectingExtension.current) return;
    if (!wallet.wallet) return;
    connectingExtension.current = false;
    connect().catch((err: unknown) => {
      setConnectError(err instanceof Error ? err.message : "Could not connect to that wallet.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.wallet]);

  const connectWallet = useCallback(
    (address?: string) => {
      const resolved = address?.trim() || DEMO_ADDRESS;
      if (!isValidSolanaAddress(resolved)) {
        setConnectError("That does not look like a valid Solana wallet address.");
        return;
      }
      setConnectError(null);
      setPastedConnected(true);
      setPastedAddress(resolved);
      pushHistory({ kind: "SCAN", label: "Wallet connected (read-only)", detail: shortAddress(resolved) });
    },
    [pushHistory]
  );

  const disconnectWallet = useCallback(() => {
    if (canSign) {
      disconnect().catch(() => undefined);
    }
    setPastedConnected(false);
    setPastedAddress("");
    setConnectError(null);
    resetScanState();
  }, [canSign, disconnect, resetScanState]);

  const scanProgress = useMemo(() => {
    if (scanState === "READY") return 0;
    if (scanState === "SCAN COMPLETE") return 100;
    return ((scanSteps.indexOf(scanState) + 1) / scanSteps.length) * 100;
  }, [scanState]);

  const startScan = useCallback(() => {
    if (!connected) {
      connectWallet();
      return;
    }

    setSelected([]);
    setScanError(null);
    setSalvageStatus("IDLE");
    setSalvageError(null);
    setScanState("SCANNING WALLET");
    const address = walletAddress || DEMO_ADDRESS;
    pushHistory({ kind: "SCAN", label: "Scan started", detail: shortAddress(address) });

    scanWallet(address, (step) => setScanState(step))
      .then((result) => {
        setAssets(result.assets);
        setAccountsFound(result.accountsFound);
        setAccountsTruncated(result.truncated);
        setHasScanned(true);
        setScanState("SCAN COMPLETE");
        pushHistory({ kind: "SCAN", label: "Scan complete", detail: `${result.assets.length} assets indexed` });
      })
      .catch((err: unknown) => {
        const message = err instanceof WalletScanError ? err.message : "Scan failed. Try again in a moment.";
        setScanError(message);
        setScanState("READY");
      });
  }, [connected, connectWallet, pushHistory, walletAddress]);

  const toggleSelected = useCallback((id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }, []);

  const clearSelected = useCallback(() => setSelected([]), []);

  const addToWatch = useCallback(
    (assetId: string) => {
      const asset = assets.find((item) => item.id === assetId);
      if (!asset) return;
      setWatchItems((current) => {
        if (current.some((item) => item.assetId === assetId)) return current;
        return [
          ...current,
          {
            id: `watch-${assetId}`,
            assetId,
            name: asset.name,
            reason: asset.reason,
            lastChecked: "Just now",
            trigger: "Recovery path becomes verified",
            notify: true,
          },
        ];
      });
      pushHistory({ kind: "WATCH", label: "Added to watch", detail: asset.name });
    },
    [assets, pushHistory]
  );

  /**
   * The real end-to-end salvage flow for CLOSE_EMPTY_TOKEN_ACCOUNT actions:
   * build a deterministic plan -> re-verify on chain -> wallet signs ->
   * send -> confirm -> ask the backend to independently verify the
   * resulting signature. A ProofEvent is only ever created from a
   * backend-VERIFIED event; nothing here fabricates a success state.
   */
  const confirmSalvage = useCallback(async (): Promise<ProofEvent | null> => {
    if (!selected.length) return null;
    const chosen = assets.filter((asset) => selected.includes(asset.id));

    if (!canSign || !publicKey) {
      setSalvageStatus("ERROR");
      setSalvageError("Connect a real wallet (not a pasted address) to sign a transaction.");
      return null;
    }

    setSalvageError(null);
    setSalvageStatus("BUILDING");

    try {
      const plan = buildSalvageTransactionPlan({
        wallet: walletAddress,
        network: SOLANA_NETWORK,
        assets: chosen,
        estimatedFeeLamports: 5000,
      });

      setSalvageStatus("AWAITING_SIGNATURE");
      const connection = getConnection();
      const result = await runSalvagePlan(connection, publicKey, plan, sendTransaction);

      setSalvageStatus("VERIFYING");
      const { events } = await submitForVerification(result);

      const verified = events.filter((event) => event.status === "VERIFIED");
      const failed = events.filter((event) => event.status !== "VERIFIED");

      if (!verified.length) {
        setSalvageStatus("ERROR");
        setSalvageError(failed[0]?.reason ?? "The backend could not verify this transaction.");
        return null;
      }

      const recoveredLamports = verified.reduce((sum, event) => sum + (event.actualRecoveryLamports ?? 0), 0);
      const recoveredSol = recoveredLamports / 1_000_000_000;
      // Real points, as computed and awarded by the backend's
      // deterministic calculateSalvagePoints() — never invented here.
      const reward = verified.reduce((sum, e) => sum + (e.points ?? 0), 0);

      const verifiedAssetIds = new Set(
        plan.actions.filter((action) => verified.some((e) => e.tokenAccount === action.tokenAccount)).map((a) => a.assetId)
      );
      const verifiedAssetNames = chosen.filter((a) => verifiedAssetIds.has(a.id)).map((a) => a.name);

      const event: ProofEvent = {
        id: `proof-${Date.now()}`,
        label: `Event ${(8917 + proofEvents.length + 1).toString().padStart(7, "0")}`,
        assets: verifiedAssetNames,
        recovered: `${recoveredSol.toFixed(4)} SOL`,
        reward,
        status: "Confirmed",
        chain: "Solana",
        timestamp: nowLabel(),
        signature: result.signature,
      };

      setProofEvents((current) => [event, ...current]);
      setRewardScore((current) => current + reward);
      setAssets((current) => current.filter((asset) => !verifiedAssetIds.has(asset.id)));
      setSelected((current) => current.filter((id) => !verifiedAssetIds.has(id)));
      pushHistory({
        kind: "SALVAGE",
        label: "Salvage confirmed on-chain",
        detail: `${verified.length} asset(s), ${recoveredSol.toFixed(4)} SOL, tx ${shortAddress(result.signature)}`,
      });
      pushHistory({ kind: "REWARD", label: "Proof verified", detail: `+${reward} salvage score` });

      if (failed.length) {
        setSalvageStatus("ERROR");
        setSalvageError(`${failed.length} of ${events.length} actions could not be verified: ${failed[0]?.reason ?? ""}`);
      } else {
        setSalvageStatus("DONE");
      }

      return event;
    } catch (err) {
      setSalvageStatus("ERROR");
      if (err instanceof PlanningError) {
        setSalvageError(err.message);
      } else if (err instanceof RecoveryValidationError) {
        setSalvageError(`On-chain re-check failed: ${err.message}`);
      } else if (err instanceof ExecutionError) {
        setSalvageError(err.message);
      } else if (err instanceof Error && /reject/i.test(err.message)) {
        setSalvageError("Signature request was rejected in the wallet.");
      } else {
        setSalvageError(err instanceof Error ? err.message : "Salvage failed. Nothing was recorded.");
      }
      return null;
    }
  }, [assets, canSign, proofEvents.length, publicKey, pushHistory, selected, sendTransaction, walletAddress]);

  const value = useMemo<AppState>(
    () => ({
      connected,
      walletAddress,
      connectError,
      canSign,
      availableWallets: wallets,
      connectExtensionWallet,
      scanState,
      scanProgress,
      scanError,
      assets,
      hasScanned,
      accountsFound,
      accountsTruncated,
      selected,
      watchItems,
      proofEvents,
      history,
      rewardScore,
      salvageStatus,
      salvageError,
      connectWallet,
      disconnectWallet,
      startScan,
      toggleSelected,
      clearSelected,
      addToWatch,
      confirmSalvage,
    }),
    [
      connected,
      walletAddress,
      connectError,
      canSign,
      wallets,
      connectExtensionWallet,
      scanState,
      scanProgress,
      scanError,
      assets,
      hasScanned,
      accountsFound,
      accountsTruncated,
      selected,
      watchItems,
      proofEvents,
      history,
      rewardScore,
      salvageStatus,
      salvageError,
      connectWallet,
      disconnectWallet,
      startScan,
      toggleSelected,
      clearSelected,
      addToWatch,
      confirmSalvage,
    ]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}

export { shortAddress };
