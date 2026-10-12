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

/* ── v4 "Hidden Inventory" — the forgotten wallet ───────────────────────
 * Deterministic fixture of hidden objects living in the dark space.
 * nx/ny are normalised stage offsets (-0.5..0.5), d is the parallax depth
 * layer, rev/ign reference the reveal + ignition clusters in timeline.ts,
 * slot is the index in the constellation ring they arrange into.
 * Kinds map to real wallet semantics: tokens, collectibles, empty
 * accounts, fragments. No balances, no addresses, no invented data. */
export interface HiddenObj {
  kind: 'coin' | 'nft' | 'empty' | 'shard';
  nx: number;
  ny: number;
  d: number;
  rev: 1 | 2 | 3;
  ign: 1 | 2 | 3;
  slot: number;
  rot: number;
  s: number;
}

export const HIDDEN: HiddenObj[] = [
  {kind: 'coin', nx: -0.36, ny: -0.22, d: 1, rev: 1, ign: 1, slot: 0, rot: -8, s: 1.1},
  {kind: 'empty', nx: -0.18, ny: 0.16, d: 0.55, rev: 1, ign: 1, slot: 1, rot: 5, s: 1.3},
  {kind: 'shard', nx: -0.05, ny: -0.3, d: 1.3, rev: 1, ign: 2, slot: 2, rot: 14, s: 0.8},
  {kind: 'nft', nx: 0.14, ny: 0.1, d: 1, rev: 1, ign: 2, slot: 3, rot: -5, s: 1.0},
  {kind: 'coin', nx: 0.33, ny: -0.16, d: 0.55, rev: 2, ign: 2, slot: 4, rot: 0, s: 1.4},
  {kind: 'shard', nx: 0.42, ny: 0.2, d: 1, rev: 2, ign: 3, slot: 5, rot: 22, s: 0.9},
  {kind: 'empty', nx: -0.42, ny: 0.05, d: 1, rev: 2, ign: 1, slot: 6, rot: -12, s: 1.0},
  {kind: 'coin', nx: -0.26, ny: 0.32, d: 1.3, rev: 2, ign: 2, slot: 7, rot: 6, s: 0.85},
  {kind: 'nft', nx: 0.05, ny: 0.34, d: 0.55, rev: 2, ign: 3, slot: 8, rot: 3, s: 1.2},
  {kind: 'shard', nx: -0.1, ny: -0.12, d: 0.55, rev: 2, ign: 1, slot: 9, rot: -18, s: 1.1},
  {kind: 'coin', nx: 0.24, ny: 0.3, d: 1, rev: 3, ign: 3, slot: 10, rot: 0, s: 1.0},
  {kind: 'empty', nx: 0.4, ny: -0.32, d: 1.3, rev: 3, ign: 2, slot: 11, rot: 9, s: 0.8},
  {kind: 'nft', nx: -0.34, ny: -0.36, d: 0.55, rev: 3, ign: 3, slot: 12, rot: -4, s: 1.25},
  {kind: 'shard', nx: 0.1, ny: -0.4, d: 1, rev: 3, ign: 1, slot: 13, rot: 30, s: 0.9},
  {kind: 'coin', nx: -0.46, ny: 0.26, d: 0.55, rev: 3, ign: 2, slot: 14, rot: 0, s: 1.35},
  {kind: 'empty', nx: 0.46, ny: 0.02, d: 0.55, rev: 3, ign: 3, slot: 15, rot: -7, s: 1.15},
  {kind: 'shard', nx: -0.2, ny: -0.44, d: 1, rev: 3, ign: 3, slot: 16, rot: 12, s: 0.8},
  {kind: 'coin', nx: 0.3, ny: 0.44, d: 1.3, rev: 3, ign: 1, slot: 17, rot: 0, s: 0.75},
  {kind: 'nft', nx: -0.44, ny: -0.1, d: 1.3, rev: 2, ign: 3, slot: 18, rot: 6, s: 0.8},
  {kind: 'empty', nx: 0.18, ny: -0.24, d: 1, rev: 1, ign: 3, slot: 19, rot: -9, s: 0.95},
  {kind: 'shard', nx: -0.02, ny: 0.46, d: 1.3, rev: 3, ign: 2, slot: 20, rot: 40, s: 0.7},
  {kind: 'coin', nx: 0.44, ny: -0.06, d: 1, rev: 2, ign: 1, slot: 21, rot: 0, s: 1.05},
  {kind: 'nft', nx: -0.28, ny: 0.44, d: 1, rev: 3, ign: 1, slot: 22, rot: -3, s: 0.95},
  {kind: 'shard', nx: 0.36, ny: 0.34, d: 0.55, rev: 1, ign: 2, slot: 23, rot: 18, s: 1.2},
];

/** The LEFTOVER — one orange fragment among the blue. The protagonist object. */
export const LEFTOVER = {kind: 'shard' as const, nx: 0.06, ny: 0.18, d: 1, rot: 12, s: 1.0};
