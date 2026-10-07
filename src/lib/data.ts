import { AssetStatus, ScanState } from "./types";

export const assetStatusLabel: Record<AssetStatus, string> = {
  CULLABLE: "Cullable",
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
    title: "Scan what is there",
    body: "CULLER reads the public wallet data you provide. Anything unknown stays labeled unknown, not guessed.",
  },
  {
    step: "Sort",
    title: "Understand the result",
    body: "Assets are classified with a visible reason, so you can see what was found and what remains uncertain.",
  },
  {
    step: "Verify",
    title: "Record your allocation",
    body: "Verified wallet activity is used to calculate your CULLER allocation and record it against your Solana wallet.",
  },
];
