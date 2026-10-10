/**
 * Stage geometry: one continuous world per orientation.
 *
 * The film never resets between scenes — a single virtual camera moves
 * through one world, and the product page lives inside a browser frame at a
 * fixed world rect. Page content uses "page space" (origin at the inner page
 * top-left, y growing downward beyond the fold; SCROLL tracks in timeline.ts
 * move it). Everything else (cover, outro card) is placed in world space.
 */

export type Ori = 'h' | 'v';

export interface BrowserRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const STAGE: Record<
  Ori,
  {w: number; h: number; bf: BrowserRect; chrome: number; pageW: number; pageH: number; pageFull: number}
> = {
  h: {w: 1920, h: 1080, bf: {x: 330, y: 120, w: 1260, h: 800}, chrome: 44, pageW: 1260, pageH: 756, pageFull: 2400},
  v: {w: 1080, h: 1920, bf: {x: 70, y: 330, w: 940, h: 1330}, chrome: 40, pageW: 940, pageH: 1290, pageFull: 2900},
};

/** page space → world space at a given scroll offset. */
export const p2w = (o: Ori, px: number, py: number, scroll: number) => {
  const s = STAGE[o];
  return {x: s.bf.x + px, y: s.bf.y + s.chrome + py - scroll};
};

/** Cover / final-card composition anchors (world space). */
export const COVER = {
  h: {cx: 960, lockupY: 396, markH: 148, tagY: 636, tagSize: 66},
  v: {cx: 540, lockupY: 640, markH: 128, tagY: 986, tagSize: 54},
} as const;

export const FINAL = {
  h: {cx: 960, lockupY: 430, markH: 132, tagY: 640, tagSize: 54, triadY: 760, ctaY: 852, urlY: 934},
  v: {cx: 540, lockupY: 700, markH: 112, tagY: 986, tagSize: 44, triadY: 1102, ctaY: 1210, urlY: 1300},
} as const;

/** World-space rect of the browser frame, used for the assemble animation. */
export const bfRect = (o: Ori) => STAGE[o].bf;
