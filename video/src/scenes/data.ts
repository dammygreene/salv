import type {AssetKind} from './kinds';

/**
 * Deterministic fixtures for the product film. The wallet is fictional and
 * labelled illustrative on-screen; every label, status and reason string is
 * vocabulary the real product uses (src/lib/data.ts, components/asset-card.tsx).
 */

export type RowStatus = 'CULLABLE' | 'WATCH' | 'REVIEW' | 'KEEP';

export interface RowFix {
  name: string;
  kind: AssetKind;
  addr: string;
  age: string;
  value: string;
  valueKnown: boolean;
  status: RowStatus;
  chip: string;
  reason: string;
}

export const ROWS: RowFix[] = [
  {
    name: 'Empty token account',
    kind: 'ACCOUNT',
    addr: '7xK4…9Qmd',
    age: '412 d',
    value: '0.000000 SOL',
    valueKnown: true,
    status: 'CULLABLE',
    chip: 'EMPTY ACCOUNT',
    reason: 'Closed-empty account holding recoverable rent only.',
  },
  {
    name: 'Dust SPL token',
    kind: 'TOKEN',
    addr: 'Bq2v…tL8a',
    age: '268 d',
    value: 'Unknown',
    valueKnown: false,
    status: 'CULLABLE',
    chip: 'NO LIQUIDITY',
    reason: 'No market route; valued as unknown, baseline allocation only.',
  },
  {
    name: 'Orphan NFT',
    kind: 'NFT',
    addr: '9Fh1…Kp3x',
    age: '194 d',
    value: 'Unknown',
    valueKnown: false,
    status: 'REVIEW',
    chip: 'UNKNOWN',
    reason: 'No market evidence yet — labeled unknown, not guessed.',
  },
  {
    name: 'Legacy stake account',
    kind: 'ACCOUNT',
    addr: '4Lm9…Zc2q',
    age: '611 d',
    value: '0.001200 SOL',
    valueKnown: true,
    status: 'WATCH',
    chip: 'LOW VALUE',
    reason: 'Inactive since epoch 612; watch for rent drift.',
  },
  {
    name: 'USDC',
    kind: 'TOKEN',
    addr: 'EPj2…uR5n',
    age: '88 d',
    value: 'Valuable',
    valueKnown: true,
    status: 'KEEP',
    chip: 'VALUABLE',
    reason: 'Active balance with liquidity; no action needed.',
  },
  {
    name: 'Collection NFT',
    kind: 'NFT',
    addr: 'Hd8s…Wv4e',
    age: '51 d',
    value: 'Valuable',
    valueKnown: true,
    status: 'KEEP',
    chip: 'VALUABLE',
    reason: 'Market evidence found; recent floor activity.',
  },
];

export const FOCUS_ROW = 2;

export const FIX = {
  wallet: 'ExmF1ct1veWa11etExamp1e11111111111111',
  walletShort: 'ExmF…1111',
  accounts: 24,
  assets: 6,
  eligible: 2,
  candidates: 1,
  notEligible: 3,
  sol: 0.4821,
  alloc: 1250,
  points: 300,
} as const;
