/**
 * THE single source of truth for time.
 *
 * 36 s @ 60 fps = 2160 frames. Original soundtrack: 100 BPM, 4/4 →
 * beat = 36 f, bar = 144 f, 15 bars. Scene bounds, camera tracks, scroll
 * tracks and every sound cue live here; nothing else in the project hardcodes
 * an event frame. Visual events and their sounds share the same numbers.
 */

export const FPS = 60;
export const DURATION = 2160;
export const BEAT = 36;
export const BAR = 144;
export const BPM = 100;

export interface SceneSpan {
  from: number;
  duration: number;
}

export const SCENES: Record<string, SceneSpan> = {
  cover: {from: 0, duration: 288}, //   b0–2   brand cover, the leftover leaves the mark
  enter: {from: 288, duration: 288}, //  b2–4   browser assembles, hero, the click
  scan: {from: 576, duration: 432}, //   b4–7   form, machine runs, scan complete
  results: {from: 1008, duration: 288}, // b7–9 asset rows, focused reason
  alloc: {from: 1296, duration: 432}, //   b9–12 allocation + evidence + recorded dot
  outro: {from: 1728, duration: 432}, //   b12–15 interface resolves into the brand
};
export const SCENE_ORDER = ['cover', 'enter', 'scan', 'results', 'alloc', 'outro'] as const;
export type SceneKey = (typeof SCENE_ORDER)[number];

/** Named visual events (frames). Sounds in CUES reference these same frames. */
export const EV = {
  markWave: 12,
  leftoverPop: 72, // b0 beat3 — orange tile pushed out of the mark gap
  periodLand: 144, // b1 beat1 — becomes the tagline's square period
  breathe: 216,
  assemble: 288, // b2 beat1 — browser frame draws around the page
  heroReveal: 324,
  cursorIn: 380,
  ctaPress: 468, // b3 beat2 — the click that motivates everything after
  pageSwap: 504,
  consoleFrame: 540,
  formReveal: 576,
  typeStart: 600,
  typeEnd: 672,
  scanPress: 684, // b4 beat3
  scanOnset: 720, // b5 beat1 — wallet node live, dot rides the wire
  wire1: 720,
  step1: 792,
  step2: 828,
  step3: 864,
  wire2: 900,
  tally: 936,
  wire3: 972,
  figure: 990,
  scanComplete: 1008, // b7 beat1
  rowsIn: 1020,
  rowTick1: 1044,
  rowTick2: 1080,
  rowTick3: 1116,
  focusPush: 1152,
  selectDraw: 1188, // b8 beat1
  glideDown: 1224,
  allocResolve: 1296, // b9 beat1
  amountCount: 1368,
  evidence1: 1440, // b10 beat1
  evidence2: 1476,
  check1: 1548,
  check2: 1584,
  check3: 1620,
  recordLand: 1656,
  pullOut: 1728, // b12 beat1
  tilesFly: 1740,
  markSettle: 1872, // b13 beat1
  wordmark: 1872,
  bell: 1908, // b13 beat2 — logo resolution
  periodLand2: 1980, // b13 beat4 — leftover returns home
  triad: 2016,
  cta: 2052,
  url: 2070,
  hold: 2064,
} as const;

/** Sound event map: id, exact frame of the visual event, character. */
export interface Cue {
  f: number;
  id: string;
  kind:
    | 'tick' // small wooden tick (period land, row entries, checks)
    | 'click' // interface press
    | 'swap' // soft page transition breath
    | 'wire' // 40 ms filtered sweep (dot riding a machine wire)
    | 'step' // scan state advance
    | 'confirm' // warm two-tone confirmation
    | 'riser' // noise+pitch rise into a boundary
    | 'bell' // logo resolution voice
    | 'pluck'; // pentatonic detail at handoffs
}
export const CUES: Cue[] = [
  {f: EV.periodLand, id: 'cover-period', kind: 'tick'},
  {f: EV.assemble, id: 'frame-assemble', kind: 'swap'},
  {f: EV.heroReveal, id: 'hero-pluck', kind: 'pluck'},
  {f: EV.ctaPress, id: 'click-cta', kind: 'click'},
  {f: EV.pageSwap, id: 'page-swap', kind: 'swap'},
  {f: EV.scanPress, id: 'click-scan', kind: 'click'},
  {f: EV.scanOnset, id: 'scan-onset', kind: 'riser'},
  {f: EV.wire1, id: 'wire-1', kind: 'wire'},
  {f: EV.step1, id: 'step-1', kind: 'step'},
  {f: EV.step2, id: 'step-2', kind: 'step'},
  {f: EV.step3, id: 'step-3', kind: 'step'},
  {f: EV.wire2, id: 'wire-2', kind: 'wire'},
  {f: EV.tally, id: 'tally', kind: 'tick'},
  {f: EV.wire3, id: 'wire-3', kind: 'wire'},
  {f: EV.figure, id: 'figure', kind: 'pluck'},
  {f: EV.scanComplete, id: 'scan-complete', kind: 'confirm'},
  {f: EV.rowTick1, id: 'row-1', kind: 'tick'},
  {f: EV.rowTick2, id: 'row-2', kind: 'tick'},
  {f: EV.rowTick3, id: 'row-3', kind: 'tick'},
  {f: EV.selectDraw, id: 'focus', kind: 'pluck'},
  {f: EV.glideDown, id: 'glide-riser', kind: 'riser'},
  {f: EV.allocResolve, id: 'alloc', kind: 'confirm'},
  {f: EV.amountCount, id: 'amount', kind: 'pluck'},
  {f: EV.evidence1, id: 'evidence-1', kind: 'tick'},
  {f: EV.evidence2, id: 'evidence-2', kind: 'tick'},
  {f: EV.check1, id: 'check-1', kind: 'tick'},
  {f: EV.check2, id: 'check-2', kind: 'tick'},
  {f: EV.check3, id: 'check-3', kind: 'tick'},
  {f: EV.recordLand, id: 'record', kind: 'confirm'},
  {f: EV.pullOut, id: 'outro-riser', kind: 'riser'},
  {f: EV.markSettle, id: 'mark-settle', kind: 'tick'},
  {f: EV.bell, id: 'logo-bell', kind: 'bell'},
  {f: EV.periodLand2, id: 'period-2', kind: 'tick'},
] as const as Cue[];

/** Virtual camera tracks (world-space centre + scale). One track per orientation. */
export const CAM_H = [
  {f: 0, x: 960, y: 540, s: 1, e: 'SOFT'},
  {f: 216, x: 960, y: 522, s: 1.05, e: 'SWEEP'},
  {f: 288, x: 960, y: 540, s: 1, e: 'SWEEP'},
  {f: 360, x: 960, y: 500, s: 1.22, e: 'SWEEP'},
  {f: 420, x: 960, y: 500, s: 1.22, e: 'SWEEP'},
  {f: 468, x: 560, y: 643, s: 1.55, e: 'SWEEP'}, // push WITH the press
  {f: 540, x: 960, y: 560, s: 1.12, e: 'SWEEP'},
  {f: 640, x: 1180, y: 634, s: 1.38, e: 'SWEEP'}, // the form
  {f: 740, x: 704, y: 524, s: 1.34, e: 'SWEEP'}, // the machine
  {f: 800, x: 500, y: 524, s: 1.5, e: 'SWEEP'},
  {f: 900, x: 660, y: 524, s: 1.5, e: 'SWEEP'}, // ride the wires
  {f: 972, x: 950, y: 524, s: 1.52, e: 'SOFT'},
  {f: 1008, x: 960, y: 540, s: 1.08, e: 'SWEEP'},
  {f: 1100, x: 960, y: 594, s: 1.3, e: 'SOFT'},
  {f: 1188, x: 960, y: 606, s: 1.55, e: 'SWEEP'}, // focused row
  {f: 1240, x: 960, y: 606, s: 1.55, e: 'SWEEP'},
  {f: 1360, x: 960, y: 470, s: 1.32, e: 'SOFT'}, // allocation
  {f: 1656, x: 960, y: 476, s: 1.34, e: 'SWEEP'},
  {f: 1728, x: 960, y: 540, s: 1.34, e: 'SWEEP'},
  {f: 1800, x: 960, y: 540, s: 0.96, e: 'SOFT'}, // out of the browser
  {f: 1872, x: 960, y: 540, s: 1, e: 'SOFT'},
  {f: 2160, x: 960, y: 536, s: 1.015, e: 'SOFT'}, // imperceptible drift on the hold
] as const;

export const CAM_V = [
  {f: 0, x: 540, y: 960, s: 1, e: 'SOFT'},
  {f: 216, x: 540, y: 930, s: 1.05, e: 'SWEEP'},
  {f: 288, x: 540, y: 960, s: 1, e: 'SWEEP'},
  {f: 360, x: 540, y: 880, s: 1.18, e: 'SWEEP'},
  {f: 420, x: 540, y: 880, s: 1.18, e: 'SWEEP'},
  {f: 468, x: 300, y: 795, s: 1.44, e: 'SWEEP'},
  {f: 540, x: 540, y: 980, s: 1.1, e: 'SWEEP'},
  {f: 640, x: 540, y: 1170, s: 1.32, e: 'SWEEP'},
  {f: 740, x: 540, y: 740, s: 1.26, e: 'SWEEP'},
  {f: 800, x: 430, y: 642, s: 1.4, e: 'SWEEP'},
  {f: 900, x: 430, y: 780, s: 1.4, e: 'SWEEP'},
  {f: 972, x: 430, y: 918, s: 1.42, e: 'SOFT'},
  {f: 1008, x: 540, y: 960, s: 1.06, e: 'SWEEP'},
  {f: 1100, x: 540, y: 770, s: 1.24, e: 'SOFT'},
  {f: 1188, x: 540, y: 634, s: 1.44, e: 'SWEEP'},
  {f: 1240, x: 540, y: 634, s: 1.44, e: 'SWEEP'},
  {f: 1360, x: 540, y: 700, s: 1.26, e: 'SOFT'},
  {f: 1656, x: 540, y: 706, s: 1.28, e: 'SWEEP'},
  {f: 1728, x: 540, y: 960, s: 1.28, e: 'SWEEP'},
  {f: 1800, x: 540, y: 960, s: 0.96, e: 'SOFT'},
  {f: 1872, x: 540, y: 960, s: 1, e: 'SOFT'},
  {f: 2160, x: 540, y: 954, s: 1.015, e: 'SOFT'},
] as const;

/** Page scroll inside the browser frame (page-space px). */
export const SCROLL_H = [
  {f: 0, v: 0, e: 'LINEAR'},
  {f: 960, v: 0, e: 'SWEEP'},
  {f: 1080, v: 900, e: 'SWEEP'},
  {f: 1152, v: 900, e: 'SWEEP'},
  {f: 1224, v: 836, e: 'SWEEP'},
  {f: 1296, v: 836, e: 'SWEEP'},
  {f: 1400, v: 1570, e: 'SOFT'},
  {f: 1728, v: 1570, e: 'SWEEP'},
  {f: 1800, v: 0, e: 'SWEEP'},
  {f: 2160, v: 0, e: 'LINEAR'},
] as const;

export const SCROLL_V = [
  {f: 0, v: 0, e: 'LINEAR'},
  {f: 960, v: 0, e: 'SWEEP'},
  {f: 1080, v: 1050, e: 'SWEEP'},
  {f: 1152, v: 1050, e: 'SWEEP'},
  {f: 1224, v: 1180, e: 'SWEEP'},
  {f: 1296, v: 1180, e: 'SWEEP'},
  {f: 1400, v: 1872, e: 'SOFT'},
  {f: 1728, v: 1872, e: 'SWEEP'},
  {f: 1800, v: 0, e: 'SWEEP'},
  {f: 2160, v: 0, e: 'LINEAR'},
] as const;

export const sceneAt = (frame: number): SceneKey =>
  SCENE_ORDER.find((k) => frame >= SCENES[k].from && frame < SCENES[k].from + SCENES[k].duration) ?? 'outro';

/* Composition aliases (Root.tsx). */
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const V_WIDTH = 1080;
export const V_HEIGHT = 1920;
export const TOTAL_FRAMES = DURATION;
