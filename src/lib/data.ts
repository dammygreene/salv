import { AssetStatus, ScanState } from "./types";

export const assetStatusLabel: Record<AssetStatus, string> = {
  SALVAGEABLE: "Salvageable",
  WATCH: "Watch",
  REVIEW: "Review",
  KEEP: "Keep",
};

export const scanSteps: ScanState[] = [
  "SCANNING WALLET",
  "MAPPING ASSETS",
  "CHECKING RECOVERY PATHS",
  "SORTING",
  "SCAN COMPLETE",
];

export const scanStateLabel: Record<ScanState, string> = {
  READY: "Ready to scan",
  "SCANNING WALLET": "Reading wallet",
  "MAPPING ASSETS": "Indexing assets",
  "CHECKING RECOVERY PATHS": "Checking recovery paths",
  SORTING: "Classifying",
  "SCAN COMPLETE": "Scan complete",
};

export const howItWorks = [
  {
    step: "Scan",
    title: "Map what's actually there",
    body: "Balances, token accounts and known protocol positions get indexed. Anything unknown stays labeled unknown, not guessed.",
  },
  {
    step: "Sort",
    title: "Every item gets a reason",
    body: "Salvageable, watch, review or keep. No black-box scoring, you can see exactly why an asset landed where it did.",
  },
  {
    step: "Verify",
    title: "Rewards need proof",
    body: "$SALV is credited only after an independent onchain check confirms the action actually happened.",
  },
];
