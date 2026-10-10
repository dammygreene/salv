import type {AssetKind} from './kinds';

/**
 * The film's asset field: ten items, four real AssetKinds
 * (TOKEN | NFT | POSITION | ACCOUNT — src/lib/types.ts).
 *
 * Each item carries three authored positions so the same objects travel
 * continuously across scenes 2→3→4:
 *   scatter — the forgotten, unordered field (scene 2)
 *   grid    — the ordered inventory (scene 3)
 *   row     — the classified product interface (scene 4, first four only)
 *
 * Coordinates are given for both orientations; nothing is cropped or
 * letterboxed between them — the vertical film is recomposed.
 */

export interface AssetItem {
  id: string;
  kind: AssetKind;
  label: string;
  meta: string;
  /** Scene 2 scatter placement (tile centre, scale, rotation deg). */
  scatter: {h: [number, number, number, number]; v: [number, number, number, number]};
  /** Scene 3 ordered grid slot (index into the grid layout). */
  grid: number;
  /** Scene 4 row index; -1 = stays in the grid, not one of the shown rows. */
  row: number;
  /** Flagged as overlooked in the field (orange). */
  flagged?: boolean;
}

export const ASSETS: AssetItem[] = [
  {id: 'a1', kind: 'ACCOUNT', label: 'EMPTY ACCOUNT', meta: '4kQf…9vXa', scatter: {h: [760, 300, 1.0, -6], v: [330, 470, 1.0, -6]}, grid: 0, row: 0, flagged: true},
  {id: 'a2', kind: 'TOKEN', label: 'NO MARKET', meta: '7mTr…2bLp', scatter: {h: [1120, 250, 0.85, 4], v: [720, 380, 0.9, 4]}, grid: 1, row: 1},
  {id: 'a3', kind: 'NFT', label: 'cNFT', meta: '8Hd2…Qw41', scatter: {h: [1470, 330, 1.1, 8], v: [430, 640, 1.05, 8]}, grid: 2, row: 2},
  {id: 'a4', kind: 'POSITION', label: 'ACTIVE', meta: '3xVa…7Jc9', scatter: {h: [1680, 620, 0.9, -3], v: [760, 520, 0.9, -3]}, grid: 3, row: 3},
  {id: 'a5', kind: 'TOKEN', label: 'SPL', meta: '9pQz…1mKd', scatter: {h: [880, 560, 0.8, 5], v: [250, 760, 0.85, 5]}, grid: 4, row: -1},
  {id: 'a6', kind: 'ACCOUNT', label: 'TOKEN ACCT', meta: '2Wn8…Rt63', scatter: {h: [1290, 700, 1.0, -8], v: [560, 880, 0.95, -8]}, grid: 5, row: -1},
  {id: 'a7', kind: 'NFT', label: 'NFT', meta: '5Jc4…Vb90', scatter: {h: [700, 800, 0.9, 3], v: [820, 780, 0.9, 3]}, grid: 6, row: -1, flagged: true},
  {id: 'a8', kind: 'TOKEN', label: 'ZERO BAL', meta: '6Hs1…Lp27', scatter: {h: [1560, 860, 0.85, -5], v: [330, 1080, 0.85, -5]}, grid: 7, row: -1},
  {id: 'a9', kind: 'POSITION', label: 'STAKE', meta: '1Df7…Xq55', scatter: {h: [1040, 900, 0.75, 6], v: [700, 1160, 0.8, 6]}, grid: 8, row: -1},
  {id: 'a10', kind: 'ACCOUNT', label: 'META', meta: '0Rv3…Ce88', scatter: {h: [1740, 210, 0.7, 2], v: [860, 270, 0.75, 2]}, grid: 9, row: -1},
];

/** Oriented layout constants. All values on the 8px grid. */
export const LAYOUT = {
  h: {
    w: 1920,
    h: 1080,
    margin: 140,
    /** Scene 1 headline, centrepiece position. */
    headHome: {x: 140, y1: 500, y2: 648, size: 132},
    /** Scene 2+: headline becomes a compositional element, top-left. */
    headAside: {x: 140, y1: 236, y2: 296, size: 54},
    /** Scene 3 ordered inventory grid: 5 cols × 2 rows of 132px tiles. */
    grid: {x: 1004, y: 396, tile: 132, gap: 24, cols: 5},
    gridPanel: {x: 964, y: 300, w: 816, h: 452},
    /** Scene 4 interface rows. */
    panel: {x: 964, y: 236, w: 816, h: 608},
    rows: {x: 964, y: 340, w: 816, rowH: 100, gap: 10},
    leftCol: 140,
    bigType: 96,
  },
  v: {
    w: 1080,
    h: 1920,
    margin: 84,
    headHome: {x: 84, y1: 700, y2: 836, size: 116},
    headAside: {x: 84, y1: 236, y2: 300, size: 58},
    /** 2 cols × 5 rows on the narrow frame. */
    grid: {x: 396, y: 620, tile: 132, gap: 24, cols: 2},
    gridPanel: {x: 356, y: 560, w: 368, h: 800},
    panel: {x: 60, y: 520, w: 960, h: 880},
    rows: {x: 60, y: 640, w: 960, rowH: 128, gap: 12},
    leftCol: 84,
    bigType: 88,
  },
} as const;

export type LayoutKey = keyof typeof LAYOUT;
export type Layout = (typeof LAYOUT)[LayoutKey];

/** Grid slot position for index i in the given orientation's grid. */
export function gridSlot(i: number, key: LayoutKey): [number, number] {
  const g = LAYOUT[key].grid;
  const cols = g.cols as number;
  const col = i % cols;
  const row = Math.floor(i / cols);
  return [g.x + col * (g.tile + g.gap) + g.tile / 2, g.y + row * (g.tile + g.gap) + g.tile / 2];
}

/** Row slot rect for row index r. */
export function rowSlot(r: number, key: LayoutKey): {x: number; y: number; w: number; h: number} {
  const R = LAYOUT[key].rows;
  return {x: R.x, y: R.y + r * (R.rowH + R.gap), w: R.w, h: R.rowH};
}
