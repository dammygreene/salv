"use client";

import { useWallet, Wallet } from "@solana/wallet-adapter-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { scanSteps } from "./data";
import { getConnection } from "./solana/connection";
import { SOLANA_NETWORK } from "./solana/constants";
import { isValidSolanaAddress } from "./solana/base58";
import { ExecutionError } from "./solana/executor/sendAndConfirm";
import { runCullPlan } from "./solana/executor/runCull";
import { submitForVerification } from "./solana/executor/verify";
import { RecoveryValidationError } from "./solana/recovery/closeAccount";
import { scanWallet, WalletScanError } from "./solana/scanner/scan";
import { buildCullTransactionPlan, PlanningError } from "./solana/transactions/planner";
import { Asset, HistoryEvent, ProofEvent, ScanState, WatchItem } from "./types";

export type CullStatus =
  | "IDLE"
  | "BUILDING"
  | "AWAITING_SIGNATURE"
  | "CONFIRMING"
  | "VERIFYING"
  | "DONE"
  | "ERROR";

type AppState = {
  /** The wallet address currently being previewed/scanned — always a
   * plain pasted (or demo) address string, never implies a wallet
   * connection or a signature of any kind. Empty string means no address
   * has been entered yet. */
  walletAddress: string;
  setWalletAddress: (address: string) => void;
  /** Clears the current address and every bit of scan/cull state tied
   * to it (and drops a real wallet-extension session, if one happened to
   * be connected for signing). */
  clearWallet: () => void;
  addressError: string | null;
  /** True only when a real wallet-adapter extension is connected AND its
   * own public key matches `walletAddress` exactly — i.e. the wallet
   * actually being previewed is the one that can sign for itself. A
   * pasted address, a demo address, or an extension connected to a
   * *different* key can never sign. */
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
  cullStatus: CullStatus;
  cullError: string | null;
  /** Runs the real, read-only Solana scan for an address. Pass an
   * address to scan something other than the currently-set
   * `walletAddress` (it becomes the new `walletAddress` as a side
   * effect); omit it to (re)scan the current one. Never requires or
   * implies a wallet connection — this only reads public onchain data. */
  startScan: (address?: string) => void;
  toggleSelected: (id: string) => void;
  clearSelected: () => void;
  addToWatch: (assetId: string) => void;
  confirmCull: () => Promise<ProofEvent | null>;
};

const AppStateContext = createContext<AppState | null>(null);

// A real, publicly documented Solana address (the solfaucet.net faucet
// treasury) used only as a one-click "try it" shortcut. It is scanned
// through the same live, read-only RPC path as any pasted address. It is
// always read-only: nobody here holds its private key.
export const DEMO_ADDRESS = "FAucetgjU1jYWsiL8BfdTrpLNt2U8kqdVfgvbnGqG5sG";

function shortAddress(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const wallet = useWallet();
  const { publicKey, connected: extensionConnected, wallets, select, connect, disconnect, sendTransaction } = wallet;

  const [walletAddress, setWalletAddressState] = useState("");
  const [addressError, setAddressError] = useState<string | null>(null);

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
  const [cullStatus, setCullStatus] = useState<CullStatus>("IDLE");
  const [cullError, setCullError] = useState<string | null>(null);
  const connectingExtension = useRef(false);

  // A real wallet-adapter extension session can only ever sign for the
  // address it actually holds the key for -- so it only counts as "can
  // sign" when its own pubkey matches the address currently being
  // previewed/scanned. Connecting a wallet that doesn't match the pasted
  // address never grants signing power over that address.
  const canSign = Boolean(extensionConnected && publicKey && publicKey.toBase58() === walletAddress);

  const pushHistory = useCallback((event: Omit<HistoryEvent, "id" | "timestamp">) => {
    setHistory((current) => [
      { ...event, id: `${event.kind}-${Date.now()}-${current.length}`, timestamp: nowLabel() },
      ...current,
    ]);
  }, []);

  const setWalletAddress = useCallback((address: string) => {
    setWalletAddressState(address.trim());
  }, []);

  // React-recommended "adjust state while rendering" pattern (see
  // https://react.dev/learn/you-might-not-need-an-effect): logs a real
  // extension connection becoming usable for signing, reacting to the
  // derived `canSign` value within the same render pass rather than a
  // useEffect. This never resets scan results -- a signer connecting or
  // disconnecting has no bearing on already-fetched, read-only scan data.
  const [prevCanSign, setPrevCanSign] = useState(canSign);
  if (prevCanSign !== canSign) {
    setPrevCanSign(canSign);
    if (canSign && publicKey) {
      pushHistory({ kind: "SCAN", label: "Wallet connected for signing", detail: shortAddress(publicKey.toBase58()) });
    }
  }

  const connectExtensionWallet = useCallback(
    (walletName: string) => {
      connectingExtension.current = true;
      setAddressError(null);
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
      setAddressError(err instanceof Error ? err.message : "Could not connect to that wallet.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.wallet]);

  const clearWallet = useCallback(() => {
    if (extensionConnected) {
      disconnect().catch(() => undefined);
    }
    setWalletAddressState("");
    setAddressError(null);
    setScanState("READY");
    setScanError(null);
    setHasScanned(false);
    setAssets([]);
    setAccountsFound(0);
    setAccountsTruncated(false);
    setSelected([]);
    setCullStatus("IDLE");
    setCullError(null);
  }, [extensionConnected, disconnect]);

  const scanProgress = useMemo(() => {
    if (scanState === "READY") return 0;
    if (scanState === "SCAN COMPLETE") return 100;
    return ((scanSteps.indexOf(scanState) + 1) / scanSteps.length) * 100;
  }, [scanState]);

  const startScan = useCallback(
    (addressOverride?: string) => {
      const target = (addressOverride ?? walletAddress).trim();
      if (!target) return;
      if (!isValidSolanaAddress(target)) {
        setAddressError("That does not look like a valid Solana wallet address.");
        return;
      }

      setAddressError(null);
      setWalletAddressState(target);
      setSelected([]);
      setScanError(null);
      setHasScanned(false);
      setAssets([]);
      setAccountsFound(0);
      setAccountsTruncated(false);
      setCullStatus("IDLE");
      setCullError(null);
      setScanState("SCANNING WALLET");
      pushHistory({ kind: "SCAN", label: "Scan started", detail: shortAddress(target) });

      scanWallet(target, (step) => setScanState(step))
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
    },
    [pushHistory, walletAddress]
  );

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
   * The real end-to-end cull flow for CLOSE_EMPTY_TOKEN_ACCOUNT actions:
   * build a deterministic plan -> re-verify on chain -> wallet signs ->
   * send -> confirm -> ask the backend to independently verify the
   * resulting signature. A ProofEvent is only ever created from a
   * backend-VERIFIED event; nothing here fabricates a success state.
   */
  const confirmCull = useCallback(async (): Promise<ProofEvent | null> => {
    if (!selected.length) return null;
    const chosen = assets.filter((asset) => selected.includes(asset.id));

    if (!canSign || !publicKey) {
      setCullStatus("ERROR");
      setCullError("Connect the wallet extension for this exact address to sign a transaction.");
      return null;
    }

    setCullError(null);
    setCullStatus("BUILDING");

    try {
      const plan = buildCullTransactionPlan({
        wallet: walletAddress,
        network: SOLANA_NETWORK,
        assets: chosen,
        estimatedFeeLamports: 5000,
      });

      setCullStatus("AWAITING_SIGNATURE");
      const connection = getConnection();
      const result = await runCullPlan(connection, publicKey, plan, sendTransaction);

      setCullStatus("VERIFYING");
      const { events } = await submitForVerification(result);

      const verified = events.filter((event) => event.status === "VERIFIED");
      const failed = events.filter((event) => event.status !== "VERIFIED");

      if (!verified.length) {
        setCullStatus("ERROR");
        setCullError(failed[0]?.reason ?? "The backend could not verify this transaction.");
        return null;
      }

      const recoveredLamports = verified.reduce((sum, event) => sum + (event.actualRecoveryLamports ?? 0), 0);
      const recoveredSol = recoveredLamports / 1_000_000_000;
      // Real points, as computed and awarded by the backend's
      // deterministic calculateCullPoints() — never invented here.
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
        kind: "CULLER",
        label: "Cull confirmed on-chain",
        detail: `${verified.length} asset(s), ${recoveredSol.toFixed(4)} SOL, tx ${shortAddress(result.signature)}`,
      });
      pushHistory({ kind: "REWARD", label: "Proof verified", detail: `+${reward} cull score` });

      if (failed.length) {
        setCullStatus("ERROR");
        setCullError(`${failed.length} of ${events.length} actions could not be verified: ${failed[0]?.reason ?? ""}`);
      } else {
        setCullStatus("DONE");
      }

      return event;
    } catch (err) {
      setCullStatus("ERROR");
      if (err instanceof PlanningError) {
        setCullError(err.message);
      } else if (err instanceof RecoveryValidationError) {
        setCullError(`On-chain re-check failed: ${err.message}`);
      } else if (err instanceof ExecutionError) {
        setCullError(err.message);
      } else if (err instanceof Error && /reject/i.test(err.message)) {
        setCullError("Signature request was rejected in the wallet.");
      } else {
        setCullError(err instanceof Error ? err.message : "Cull failed. Nothing was recorded.");
      }
      return null;
    }
  }, [assets, canSign, proofEvents.length, publicKey, pushHistory, selected, sendTransaction, walletAddress]);

  const value = useMemo<AppState>(
    () => ({
      walletAddress,
      setWalletAddress,
      clearWallet,
      addressError,
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
      cullStatus,
      cullError,
      startScan,
      toggleSelected,
      clearSelected,
      addToWatch,
      confirmCull,
    }),
    [
      walletAddress,
      setWalletAddress,
      clearWallet,
      addressError,
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
      cullStatus,
      cullError,
      startScan,
      toggleSelected,
      clearSelected,
      addToWatch,
      confirmCull,
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
