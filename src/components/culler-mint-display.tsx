"use client";

import { useEffect, useState } from "react";
import { getCullerExplorerUrl, getPublicCullerConfig, shortenCullerMint } from "@/lib/culler/public-config";

export function CullerMintDisplay() {
  const config = getPublicCullerConfig();
  const explorerUrl = getCullerExplorerUrl(config);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  useEffect(() => {
    if (config.configurationError) {
      console.error(config.configurationError);
    }
  }, [config.configurationError]);

  async function copyMint() {
    if (!config.mintAddress) return;
    try {
      await navigator.clipboard.writeText(config.mintAddress);
      setCopied(true);
      setCopyError(false);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  }

  if (config.mintStatus === "prelaunch") {
    return (
      <div className="token-contract" aria-live="polite">
        <span>CULLER mint</span>
        <strong>Coming at launch</strong>
      </div>
    );
  }

  if (config.mintStatus === "invalid") {
    return (
      <div className="token-contract token-contract-error" role="status">
        <span>CULLER mint</span>
        <strong>Temporarily unavailable</strong>
      </div>
    );
  }

  return (
    <div className="token-contract" aria-label="CULLER mint address">
      <div className="token-contract-details">
        <span>CULLER mint</span>
        <strong title={config.mintAddress ?? undefined}>{shortenCullerMint(config.mintAddress ?? "")}</strong>
      </div>
      <div className="token-contract-actions">
        <button type="button" className="ghost-button token-copy-button" onClick={copyMint} aria-label="Copy full CULLER mint address">
          {copied ? "Copied" : copyError ? "Retry copy" : "Copy"}
        </button>
        {explorerUrl && (
          <a href={explorerUrl} target="_blank" rel="noreferrer" className="text-link">
            View on Solscan ↗
          </a>
        )}
      </div>
    </div>
  );
}
