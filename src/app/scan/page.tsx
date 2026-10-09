"use client";

import { FormEvent, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { CullMachine } from "@/components/cull-machine";
import { AssetCard } from "@/components/asset-card";
import { shortAddress, useAppState } from "@/lib/app-state";
import { scanStateLabel } from "@/lib/data";
import { validateCombinedWalletSubmission } from "@/lib/walletAddress";
import { CullerShareCardPreview, CullerShareModal } from "@/components/culler-share-modal";
import { formatCullerAllocation, generateCullerShareCard } from "@/lib/culler/share";
import type { Asset } from "@/lib/types";

/** Response shape of POST /api/culler/scan — see that route for the full
 * contract. This is the authoritative, server-computed reward-ledger
 * result for a combined Solana(+optional Robinhood) submission; it is
 * never derived from anything on the client, and the Solana wallet is
 * always its sole reward identity. */
interface LedgerScanResult {
  solanaWallet: string;
  robinhoodWallet: string | null;
  scan: {
    solana: {
      attempted: boolean;
      succeeded: boolean;
      reason?: string;
      programStatus?: { splToken: "available" | "unavailable"; token2022: "available" | "unavailable" };
    };
    robinhood: { submitted: boolean; state: "AVAILABLE" | "UNAVAILABLE" | "NOT_LINKED"; discovery?: "COMPLETE" | "PARTIAL" | "EMPTY" | "UNAVAILABLE"; nativeBalanceWei: string | null; assetCounts?: { native: number; erc20: number; erc721: number; erc1155: number }; reason?: string };
  };
  reward: { cullerAllocated: string; status: string; epochId: number | null; allocationState: "YOUR CULLER ALLOCATION" | "CURRENT ALLOCATION" | "FINAL ALLOCATION" | "NO ALLOCATION" };
  allocation: {
    points: number;
    contributions: Array<{ classification: string; category: string; points: number }>;
  };
  csvRecorded: boolean;
  recordError?: string;
  scanId: string;
  assets: Asset[];
  eligibility: {
    eligible: number;
    candidates: number;
    notEligible: number;
    unknown: number;
    valuable: number;
    noLiquidity: number;
    empty: number;
  };
  digitalAssets: {
    total: number;
    nft: number;
    compressedNft: number;
    fungible: number;
    other: number;
    unknown: number;
  };
  enrichment: { status: "AVAILABLE" | "UNAVAILABLE"; reason?: string };
}

export default function ScanPage() {
  const {
    walletAddress,
    addressError,
    scanState,
    scanError,
    hasScanned,
    accountsFound,
    accountsTruncated,
    assets,
    startScan,
    mergeAssetEnrichment,
    clearWallet,
  } = useAppState();
  const [addressInput, setAddressInput] = useState("");
  const [robinhoodInput, setRobinhoodInput] = useState("");
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [ledgerResult, setLedgerResult] = useState<LedgerScanResult | null>(null);
  const [ledgerScanning, setLedgerScanning] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showAssets, setShowAssets] = useState(false);
  const validation = validateCombinedWalletSubmission({ solanaWallet: addressInput, robinhoodWallet: robinhoodInput });
  const hasWallet = Boolean(walletAddress);

  // One form, one "Scan wallet" click performs TWO independent things:
  // (1) the existing live, read-only Solana recovery scan (unchanged,
  // via `startScan`, Solana-only, drives the asset grid below), and
  // (2) a combined Solana+Robinhood submission to the $CULLER reward
  // ledger (`/api/culler/scan`) — Solana is the sole reward identity in
  // both cases, and Robinhood (optional) never gets its own scan or its
  // own button.
  async function handleScanSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validation.valid) {
      setLedgerError(validation.error);
      return;
    }
    setLedgerError(null);
    const { solanaWallet, robinhoodWallet } = validation.submission;
    startScan(solanaWallet);

    setLedgerScanning(true);
    setLedgerResult(null);
    try {
      const res = await fetch("/api/culler/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solanaWallet, robinhoodWallet }),
      });
      const data = (await res.json()) as LedgerScanResult & { error?: string };
      if (!res.ok) {
        setLedgerError(data.error ?? "Could not record this scan for $CULLER rewards.");
        return;
      }
      setLedgerResult(data);
      mergeAssetEnrichment(data.assets);
      if (data.assets.length) {
        window.sessionStorage.setItem("culler-enriched-assets", JSON.stringify(data.assets));
      }
    } catch {
      setLedgerError("Could not reach the reward ledger. Try again shortly.");
    } finally {
      setLedgerScanning(false);
    }
  }

  const scanning = scanState !== "READY" && scanState !== "SCAN COMPLETE";
  const eligible = assets.filter((a) => a.eligibility === "ELIGIBLE");
  const emptyAccounts = assets.filter((a) => a.kind === "ACCOUNT");
  const nfts = assets.filter((a) => a.kind === "NFT");
  const fungible = assets.filter((a) => a.kind === "TOKEN");
  const dasOnlyAssets = assets.filter((a) => a.metadata?.source === "quicknode-das" && !a.tokenAccount);
  const nftGroups = useMemo(() => {
    const groups = new Map<string, { label: string; assets: Asset[] }>();
    for (const asset of nfts) {
      const label = asset.metadata?.collection?.trim() || "Other NFTs";
      const key = asset.metadata?.collectionAddress?.trim() || label;
      const group = groups.get(key);
      if (group) {
        group.assets.push(asset);
      } else {
        groups.set(key, { label, assets: [asset] });
      }
    }
    return [...groups.values()];
  }, [nfts]);
  const shareData = ledgerResult && ledgerResult.reward.allocationState !== "NO ALLOCATION"
    ? {
        allocation: ledgerResult.reward.cullerAllocated,
        walletAddress: ledgerResult.solanaWallet,
        epochId: ledgerResult.reward.epochId,
        verified: ledgerResult.csvRecorded,
        allocationState: ledgerResult.reward.allocationState === "FINAL ALLOCATION" ? "FINAL ALLOCATION" as const : ledgerResult.reward.allocationState === "YOUR CULLER ALLOCATION" ? "YOUR CULLER ALLOCATION" as const : "CURRENT ALLOCATION" as const,
      }
    : null;
  const contributionSummary = useMemo(() => {
    const summary = new Map<string, { count: number; points: number }>();
    for (const contribution of ledgerResult?.allocation.contributions ?? []) {
      const label =
        contribution.classification === "EMPTY_ACCOUNT" ? "Empty accounts" :
        contribution.classification === "FUNGIBLE_NO_LIQUIDITY" ? "No-liquidity tokens" :
        contribution.classification === "FUNGIBLE_LOW_VALUE" ? "Low-value tokens" :
        contribution.classification === "FUNGIBLE_UNKNOWN_VALUE" ? "Unknown tokens" :
        contribution.classification === "NFT_NO_MARKET" ? "NFTs with no market" :
        contribution.classification === "NFT_LOW_VALUE" ? "Low-value NFTs" :
        contribution.classification === "NFT_UNKNOWN_VALUE" || contribution.classification === "NFT_REVIEW" ? "Unknown NFTs" :
        contribution.classification;
      const existing = summary.get(label) ?? { count: 0, points: 0 };
      summary.set(label, { count: existing.count + 1, points: existing.points + contribution.points });
    }
    return [...summary.entries()];
  }, [ledgerResult]);

  async function downloadShareCard() {
    if (!shareData) return;
    const blob = await generateCullerShareCard(shareData);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "culler-allocation.png";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copyAllocation() {
    if (!ledgerResult || ledgerResult.reward.allocationState === "NO ALLOCATION") return;
    await navigator.clipboard.writeText(`${formatCullerAllocation(ledgerResult.reward.cullerAllocated)} $CULLER`);
  }
  const checkingAssets = ledgerScanning || (hasWallet && !hasScanned && scanState !== "READY");
  const assetCountLabel = assets.length ? `${assets.length} assets found.` : "No assets found.";
  return (
    <main className="scan-page">
      <PageHeader
        title={checkingAssets ? "Checking assets…" : hasScanned ? assetCountLabel : "Open the machine bay."}
        support={
          checkingAssets
            ? "Checking both wallets and organizing tokens, NFTs, and allocation evidence."
            : hasScanned
            ? assets.length
              ? "Here's everything attached to both wallets, sorted with a reason for every call."
              : "No discoverable assets were found in the submitted wallets."
            : "Paste a wallet address and run a scan. CULLER reads the addresses you provide and calculates your allocation."
        }
        meta={
          <>
            <span>{hasWallet ? shortAddress(walletAddress) : "No address entered"}</span>
            <span className="meta-rule" />
            <span>{hasWallet ? "Read-only scan" : "Solana"}</span>
            {hasWallet && (
              <>
                <span className="meta-rule" />
                <button type="button" className="text-link" onClick={clearWallet}>
                  Scan a different address
                </button>
              </>
            )}
          </>
        }
      />

      {!hasScanned && <div className="scan-console">
        <div className="scan-console-machine">
          <CullMachine />
        </div>
        <div className="scan-console-controls">
          {!hasWallet && (
            <>
              <h2>Paste a wallet address to begin.</h2>
              <p>CULLER never asks for a seed phrase or private key. Paste any public wallet address below — it is read-only.</p>
              <form className="wallet-form" onSubmit={handleScanSubmit}>
                <div className="wallet-field">
                  <label className="wallet-field-label" htmlFor="scan-solana-wallet">
                    Solana wallet
                  </label>
                  <input
                    id="scan-solana-wallet"
                    type="text"
                    className="wallet-input code"
                    placeholder="Paste a Solana wallet address"
                    value={addressInput}
                    onChange={(event) => setAddressInput(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="Solana wallet address"
                    required
                  />
                </div>
                <div className="wallet-field">
                  <label className="wallet-field-label" htmlFor="scan-robinhood-wallet">
                    Robinhood wallet (optional)
                  </label>
                  <input
                    id="scan-robinhood-wallet"
                    type="text"
                    className="wallet-input code"
                    placeholder="Optional: paste your Robinhood wallet address"
                    value={robinhoodInput}
                    onChange={(event) => setRobinhoodInput(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="Robinhood wallet address (optional)"
                  />
                </div>
                <button type="submit" className="primary-button" disabled={ledgerScanning || !validation.valid}>
                  {ledgerScanning ? "Scanning…" : "Scan wallet"}
                </button>
              </form>
              <small className="wallet-form-note">Solana wallet required for $CULLER rewards.</small>
              <small className="wallet-form-note">Optional. Add your Robinhood wallet to scan both.</small>
              {(addressError || ledgerError) && <small className="wallet-form-error">{ledgerError ?? addressError}</small>}
              <small className="wallet-form-note">Read-only: balances and token accounts are fetched live from Solana.</small>

            </>
          )}
          {hasWallet && !hasScanned && scanError && (
            <>
              <h2>Scan failed.</h2>
              <p>{scanError}</p>
              <button className="primary-button" onClick={() => startScan()}>
                Try again
              </button>
            </>
          )}
          {hasWallet && !hasScanned && !scanError && (
            <>
              <h2>{scanning ? scanStateLabel[scanState] : "Address entered. Ready to scan."}</h2>
              <p>
                {scanning
                  ? "Reading balances and token accounts live from Solana. This takes a few seconds."
                  : "The scan only reads public onchain data. It never requests a signature."}
              </p>
              <button className="primary-button" onClick={() => startScan()} disabled={scanning}>
                {scanning ? "Scanning" : "Scan my wallet"}
              </button>
            </>
          )}
          {hasWallet && hasScanned && !ledgerScanning && !ledgerResult && (
            <>
              <h2>Scan complete.</h2>
              <p>
                Your wallet has been scanned. Your CULLER allocation is shown below.
              </p>
              <button className="ghost-button" onClick={() => startScan()}>
                Rescan wallet
              </button>
            </>
          )}
        </div>
      </div>}

      {hasScanned && (ledgerScanning || ledgerResult) && (
        <>
          {ledgerScanning ? (
            <section className="allocation-result allocation-result-pending" aria-live="polite">
              <div className="allocation-result-copy">
                <span className="eyebrow">Scan complete</span>
                <h2>Your CULLER allocation</h2>
                <strong className="allocation-result-amount">Calculating…</strong>
                <span className="allocation-result-state">CURRENT ALLOCATION</span>
                <p>We are finalizing your allocation and generating your share card.</p>
              </div>
            </section>
          ) : ledgerResult && (
            <section className="allocation-result">
              <div className="allocation-result-copy">
                <span className="eyebrow">Scan complete</span>
                <h2>Your CULLER allocation</h2>
                {ledgerResult.reward.allocationState === "NO ALLOCATION" ? (
                  <>
                    <strong className="allocation-result-amount">NO ALLOCATION</strong>
                    <p>No active or closed epoch is available yet. Your scan was still recorded.</p>
                  </>
                ) : (
                  <>
                    <strong className="allocation-result-amount">+{formatCullerAllocation(ledgerResult.reward.cullerAllocated)} $CULLER</strong>
                    <span className="allocation-result-state">{ledgerResult.reward.allocationState}</span>
                    <p>Based on your scanned wallet and current CULLER allocation rules.</p>
                    <div className="allocation-result-actions">
                      <button type="button" className="primary-button" onClick={() => setShowShare(true)}>Share on X</button>
                      <button type="button" className="ghost-button" onClick={() => void downloadShareCard()}>Download card</button>
                      <button type="button" className="ghost-button" onClick={() => void copyAllocation()}>Copy allocation</button>
                    </div>
                    <p className="allocation-result-note">Some assets couldn&apos;t be confidently valued. CULLER still gives them a baseline allocation.</p>
                  </>
                )}
              </div>
              {shareData && <CullerShareCardPreview data={shareData} />}
            </section>
          )}
          <section className="scan-summary">
            <span className="eyebrow">Scan summary</span>
            <p>{accountsFound} token accounts scanned · {assets.length} digital assets analyzed</p>
            <p>
              {eligible.length} eligible ·{" "}
              {assets.filter((asset) => asset.valueClassification?.includes("UNKNOWN")).length} unknown ·{" "}
              {assets.filter((asset) => asset.valueClassification?.includes("VALUABLE")).length} valuable
            </p>
            <details className="scan-diagnostics">
              <summary>View scan diagnostics</summary>
              <p>
                {emptyAccounts.length} empty · {fungible.length} fungible · {nfts.length} NFTs ·{" "}
                {ledgerResult?.eligibility.candidates ?? 0} candidates ·{" "}
                {ledgerResult?.eligibility.notEligible ?? 0} not eligible
              </p>
              <p>
                {accountsTruncated ? "The account scan was truncated by the configured scan limit. " : ""}
                Enrichment: {ledgerResult?.enrichment.status.toLowerCase() ?? "pending"}.
                {dasOnlyAssets.length ? ` ${dasOnlyAssets.length} DAS-only assets included.` : ""}
              </p>
              {ledgerResult?.robinhoodWallet && (
                <p>
                  Robinhood Chain: {ledgerResult.scan.robinhood.discovery?.toLowerCase() ?? ledgerResult.scan.robinhood.state.toLowerCase()}.
                  {ledgerResult.scan.robinhood.assetCounts
                    ? ` ${ledgerResult.scan.robinhood.assetCounts.native} native · ${ledgerResult.scan.robinhood.assetCounts.erc20} ERC-20 · ${ledgerResult.scan.robinhood.assetCounts.erc721} ERC-721 · ${ledgerResult.scan.robinhood.assetCounts.erc1155} ERC-1155.`
                    : ""}
                  {ledgerResult.scan.robinhood.reason ? ` ${ledgerResult.scan.robinhood.reason}` : ""}
                </p>
              )}
            </details>
          </section>

          {ledgerResult && ledgerResult.allocation.points > 0 && (
            <section className="allocation-evidence">
              <span className="eyebrow">How your allocation was built</span>
              <strong>{ledgerResult.allocation.points} points</strong>
              {contributionSummary.map(([label, value]) => (
                <span key={label}>{label} · {value.count} × {Math.round(value.points / value.count)} · {value.points} points</span>
              ))}
            </section>
          )}

          <section className="asset-inventory">
            <div className="asset-inventory-heading">
              <div>
                <span className="eyebrow">Asset breakdown</span>
                <strong>{assets.length} assets</strong>
              </div>
              <button type="button" className="ghost-button" onClick={() => setShowAssets((open) => !open)}>
                {showAssets ? "Hide all assets" : "View all assets"}
              </button>
            </div>
            {showAssets && <div className="scan-results-layout">
              <div className="asset-results">
              <div className="asset-grid">
                {assets.filter((asset) => asset.kind !== "NFT").map((asset) => (
                  <AssetCard key={asset.id} asset={asset} />
                ))}
              </div>
              {nftGroups.map((group) => (
                <section className="asset-category" key={group.label}>
                  <div className="asset-category-heading">
                    <h2>{group.label}</h2>
                    <span>{group.assets.length} NFT{group.assets.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="asset-grid">
                    {group.assets.map((asset) => (
                      <AssetCard key={asset.id} asset={asset} />
                    ))}
                  </div>
                </section>
              ))}
              </div>
            </div>
            }
          </section>
        </>
      )}

      {ledgerResult && shareData && (
        <CullerShareModal
          open={showShare}
          onClose={() => setShowShare(false)}
          data={{
            allocation: ledgerResult.reward.cullerAllocated,
            walletAddress: ledgerResult.solanaWallet,
            epochId: ledgerResult.reward.epochId,
            verified: ledgerResult.csvRecorded,
            ...(ledgerResult.reward.allocationState !== "NO ALLOCATION"
              ? { allocationState: ledgerResult.reward.allocationState }
              : {}),
          }}
        />
      )}

    </main>
  );
}
