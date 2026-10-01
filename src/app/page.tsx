"use client";

import { useEffect, useMemo, useState } from "react";

type AssetStatus = "SALVAGEABLE" | "WATCH" | "REVIEW" | "KEEP";
type ScanState = "READY" | "SCANNING WALLET" | "MAPPING ASSETS" | "CHECKING RECOVERY PATHS" | "SORTING" | "SCAN COMPLETE";

type Asset = {
  id: string;
  name: string;
  ticker: string;
  address: string;
  status: AssetStatus;
  age: string;
  value: string;
  reason: string;
  action: string;
};

const assets: Asset[] = [
  { id: "dust-01", name: "Unclaimed SOL", ticker: "SOL", address: "token account / 8vK...p4Q", status: "SALVAGEABLE", age: "2y 04m", value: "0.0021 SOL", reason: "Empty token account can be closed.", action: "CLOSE ACCOUNT" },
  { id: "orbit-77", name: "Orbit Pass", ticker: "NFT", address: "mint / 9qL...3Wm", status: "WATCH", age: "11m", value: "UNKNOWN", reason: "Inactive collection. Recovery path not verified.", action: "ADD TO WATCH" },
  { id: "drift-14", name: "Drift Position", ticker: "USDC", address: "position / 4bN...e8R", status: "REVIEW", age: "8m", value: "UNKNOWN", reason: "Protocol position detected. Review before touching.", action: "REVIEW" },
  { id: "moss-02", name: "Moss Token", ticker: "MOSS", address: "mint / 7Zx...Q0d", status: "KEEP", age: "3m", value: "0.41 USDC", reason: "Active balance. No salvage action suggested.", action: "KEEP" },
];

const scanSteps: ScanState[] = ["SCANNING WALLET", "MAPPING ASSETS", "CHECKING RECOVERY PATHS", "SORTING", "SCAN COMPLETE"];

function StatusMark({ status }: { status: AssetStatus }) {
  return <span className={`status status-${status.toLowerCase()}`}><i />{status}</span>;
}

export default function Home() {
  const [connected, setConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [scanState, setScanState] = useState<ScanState>("READY");
  const [selected, setSelected] = useState<string[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (scanState === "READY" || scanState === "SCAN COMPLETE") return;
    const next = scanSteps.indexOf(scanState) + 1;
    const timer = window.setTimeout(() => setScanState(scanSteps[next] ?? "SCAN COMPLETE"), 700);
    return () => window.clearTimeout(timer);
  }, [scanState]);

  const selectedAssets = assets.filter((asset) => selected.includes(asset.id));
  const progress = scanState === "READY" ? 0 : scanState === "SCAN COMPLETE" ? 100 : ((scanSteps.indexOf(scanState) + 1) / scanSteps.length) * 100;
  const totalValue = useMemo(() => selectedAssets.length ? "0.0021 SOL" : "0.0000 SOL", [selectedAssets.length]);
  const machineLabel = complete ? "PROOF VERIFIED" : scanState === "READY" ? "SYSTEM READY" : scanState === "SCANNING WALLET" ? "READING WALLET" : scanState === "MAPPING ASSETS" ? "INDEXING ASSETS" : scanState === "CHECKING RECOVERY PATHS" ? "CHECKING RECOVERY" : scanState === "SORTING" ? "CLASSIFYING" : "SALVAGE READY";

  function startScan() {
    if (!connected) {
      setConnected(true);
      return;
    }
    setComplete(false);
    setSelected([]);
    setScanState("SCANNING WALLET");
  }

  function toggleAsset(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function confirmSalvage() {
    setShowReview(false);
    setComplete(true);
    setSelected([]);
  }

  return (
    <main className="app-shell">
      <nav className="topbar">
        <a className="wordmark" href="#top" aria-label="SALVAGE home"><span className="wordmark-mark"><i /></span><span>SALVAGE</span><small>RECOVERY UNIT / 01</small></a>
        <div className="nav-links"><a href="#report">SCAN</a><a href="#watch">WATCH</a><a href="#rewards">REWARDS</a><a href="#token">$SALV</a></div>
        <button className="connect-button" onClick={() => setConnected((value) => !value)} aria-pressed={connected}><span className="button-led" />{connected ? "8vK...p4Q / OFFLINE" : "CONNECT"}</button>
      </nav>

      <section className="hero" id="top">
        <div className="console-shell">
          <div className="console-topline"><span>SALVAGE SYSTEM // ONLINE</span><span>SM-01 // CONSUMER RECOVERY MACHINE</span><span className="topline-led" /></div>
          <div className="console-body">
            <div className="hero-copy">
              <div className="eyebrow"><span className="signal-dot" /> SYSTEM / {machineLabel}</div>
              <h1>SALVAGE</h1>
              <p className="hero-tagline">YOUR WALLET HAS<br /><em>LEFTOVERS.</em></p>
              <p className="hero-support">Find what was forgotten. Recover what still matters. The machine sorts the rest.</p>
              <div className="wallet-control">
                <span className="input-label">WALLET INPUT</span>
                <input value={walletAddress} onChange={(event) => setWalletAddress(event.target.value)} placeholder="PASTE WALLET ADDRESS" aria-label="Wallet address" />
                <button className="scan-button" onClick={startScan}><span className="button-led" />{connected ? (scanState === "READY" ? "SCAN" : machineLabel) : "CONNECT"}<b>↗</b></button>
              </div>
              <div className="notice"><span>!</span> No seed phrases. No custody. Your wallet signs every action.</div>
            </div>
            <div className="machine-wrap" aria-label="SALVAGE machine status">
              <div className="machine-head"><span>ASSET RECOVERY UNIT / 01</span><span>v0.1.0</span></div>
              <div className={`machine-screen ${scanState !== "READY" ? "is-scanning" : ""}`}><div className="screen-glass" /><div className="scan-lines" /><div className="scan-beam" /><div className="machine-orbit orbit-one" /><div className="machine-orbit orbit-two" /><div className="machine-core">{complete ? "✓" : scanState === "READY" ? "S" : "···"}</div><div className="machine-readout"><span>SYSTEM / STATUS</span><strong>{machineLabel}</strong></div><div className="machine-meter"><span style={{ width: `${progress}%` }} /></div><div className="readout-block readout-network"><span>NETWORK</span><b>SOLANA</b></div><div className="readout-block readout-blocks"><span>BLOCK</span><b>--------</b></div></div>
              <div className="machine-footer"><span>RECOVERY INDEX <strong>{scanState === "SCAN COMPLETE" || complete ? "01 / 04" : "-- / --"}</strong></span><span className="segment-display">{Math.round(progress).toString().padStart(3, "0")}<i />100</span><span className="machine-led" /></div>
            </div>
          </div>
          <div className="console-readouts"><span>NETWORK / SOLANA</span><span>INDEX / ACTIVE</span><span>ASSETS / {scanState === "SCAN COMPLETE" || complete ? "073" : "---"}</span><span>RECOVERY / {selected.length ? totalValue : "--"}</span><span>SYSTEM / {machineLabel}</span></div>
        </div>
      </section>

      <section className="stats-strip"><div><span>ASSETS SORTED</span><strong>12,482</strong></div><div><span>VALUE RECOVERED</span><strong>1,904 SOL</strong></div><div><span>PROOFS VERIFIED</span><strong>8,917</strong></div><div><span>ACTIVE EPOCH</span><strong>07 <small>/ 12</small></strong></div></section>

      <section className="report-section" id="report">
        <div className="section-heading"><div><div className="eyebrow">01 / OPEN MACHINE BAY</div><h2>{scanState === "SCAN COMPLETE" || complete ? "73 ASSETS FOUND" : "MACHINE STANDBY"}</h2></div><div className="report-meta"><span>{scanState === "SCAN COMPLETE" || complete ? "INDEX COMPLETE" : "CONNECT WALLET TO BEGIN"}</span><span className="meta-rule" /><span>SOLANA</span></div></div>
        <div className="result-compartments"><div className="result-module result-recover"><span>RECOVER</span><strong>0.184 <small>SOL</small></strong><i>VALUE DETECTED</i></div><div className="result-module result-salvage"><span>SALVAGE</span><strong>29 <small>ASSETS</small></strong><i>ALLOWLISTED</i></div><div className="result-module result-watch" id="watch"><span>WATCH</span><strong>11 <small>ASSETS</small></strong><i>UNCERTAIN</i></div><div className="result-module result-unknown"><span>UNKNOWN</span><strong>33 <small>ASSETS</small></strong><i>NEEDS ANALYSIS</i></div></div>
        <div className="report-layout">
          <div className="asset-grid">{assets.map((asset) => <article className={`asset-card ${selected.includes(asset.id) ? "is-selected" : ""}`} key={asset.id}><div className="card-top"><span className="asset-icon">{asset.ticker === "NFT" ? "◇" : "◈"}</span><StatusMark status={asset.status} /></div><h3>{asset.name}</h3><span className="asset-address">{asset.address}</span><div className="asset-detail"><span>AGE <strong>{asset.age}</strong></span><span>VALUE <strong className={asset.value === "UNKNOWN" ? "unknown" : ""}>{asset.value}</strong></span></div><p>{asset.reason}</p>{asset.status === "SALVAGEABLE" && <button className="select-button" onClick={() => toggleAsset(asset.id)}>{selected.includes(asset.id) ? "IN BIN ✓" : "+ ADD TO BIN"}</button>}{asset.status === "WATCH" && <button className="ghost-button">WATCH THIS</button>}{asset.status === "REVIEW" && <button className="ghost-button">OPEN REVIEW</button>}</article>)}</div>
          <aside className={`salvage-bin ${selected.length ? "bin-active" : ""}`}><div className="bin-label"><span className="eyebrow">SALVAGE BIN / DISPOSAL BAY</span><span className="bin-count">{selected.length.toString().padStart(2, "0")}</span></div><div className="bin-graphic"><div className="bin-slot"><span>↓</span></div><span>{selected.length ? `${selected.length.toString().padStart(2, "0")} ASSET READY` : "INSERT ELIGIBLE ASSET"}</span><i className="bin-led" /></div><div className="bin-summary"><div><span>RECOVERABLE</span><strong>{totalValue}</strong></div><div><span>REWARD</span><strong>{selected.length ? "+12" : "+--"}</strong></div></div><button className="bin-button" disabled={!selected.length} onClick={() => setShowReview(true)}>SALVAGE <span>↗</span></button><small>Only verified, allowlisted actions can enter the bin.</small></aside>
        </div>
      </section>

      <section className="how-section" id="how"><div className="eyebrow">02 / MACHINE SEQUENCE</div><h2>USEFUL FIRST.<br /><em>TOKEN SECOND.</em></h2><div className="steps"><div><b>01</b><h3>SCAN</h3><p>Map balances, token accounts and known positions. Unknown stays unknown.</p></div><div><b>02</b><h3>SORT</h3><p>Every result gets an explainable status: keep, watch, review or salvageable.</p></div><div><b>03</b><h3>VERIFY</h3><p>Proof of Salvage is credited only after an independent onchain check.</p></div></div></section>

      <section className="proof-section" id="proof"><div><div className="eyebrow">03 / MACHINE SPECIFICATION</div><h2>PROOF OF<br /><em>SALVAGE.</em></h2><p>Every verified action becomes a receipt. The reward pool is finite. The rules stay visible.</p><a className="text-link" href="#token">VIEW REWARD RULES <span>↗</span></a></div><div className="proof-card"><div className="proof-card-top"><span>EVENT / 0008917</span><StatusMark status="SALVAGEABLE" /></div><div className="proof-flow"><span>SALVAGE</span><b>↓</b><span>VERIFY</span><b>↓</b><span>REWARD</span></div><div className="proof-confirm"><strong>VALID SALVAGE EVENT</strong><b>+1,842 SALV</b></div><div className="proof-fields"><span>BLOCK <b>VERIFIED</b></span><span>STATUS <b>CONFIRMED</b></span><span>CHAIN <b>SOLANA</b></span></div></div></section>

      <footer id="token"><div className="token-sheet"><div className="eyebrow">04 / TECHNICAL SPECIFICATION</div><h2>$SALV</h2><div className="token-fields"><span>TOTAL SUPPLY <b>1,000,000,000</b></span><span>MARKET <b>700,000,000</b></span><span>SALVAGE REWARDS <b>300,000,000</b></span></div></div><div className="footer-mark"><div className="wordmark"><span className="wordmark-mark"><i /></span>SALVAGE</div><span>RECOVERY LAYER / SOLANA FIRST</span></div></footer>

      {showReview && <div className="modal-backdrop" role="presentation" onClick={() => setShowReview(false)}><section className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowReview(false)} aria-label="Close review">×</button><div className="eyebrow">SALVAGE // TRANSACTION REVIEW</div><h2 id="review-title">CONFIRM<br /><em>SALVAGE</em></h2><div className="review-console"><div className="review-row"><span>ASSETS</span><strong>{selectedAssets.map((asset) => asset.name).join(", ")}</strong></div><div className="review-row"><span>NETWORK</span><strong>SOLANA / DEVNET READY</strong></div><div className="review-row"><span>RECOVERED</span><strong>{totalValue}</strong></div><div className="review-row"><span>REWARD</span><strong>+12 SALVAGE SCORE</strong></div></div><p>Check the exact action before your wallet signs. This demo has no live signer attached.</p><div className="warning"><span>!</span> Account closure is permanent. Only proceed when you recognize the asset.</div><button className="primary-button" onClick={confirmSalvage}>CONFIRM SALVAGE <span>↗</span></button></section></div>}
    </main>
  );
}
