/**
 * THE single source of truth for time — v4 "Hidden Inventory".
 *
 * 36 s @ 60 fps = 2160 frames. Original soundtrack: 100 BPM, 4/4 →
 * beat = 36 f, bar = 144 f, 15 bars. Scene bounds, camera tracks and every
 * sound cue live here; nothing else in the project hardcodes an event frame.
 * Visual events and their sounds share the same numbers.
 *
 * Arc: mystery (unseen) → discovery (inventory) → force (signal) →
 * clarity (glimpse of the real product) → brand moment (reveal) → close.
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
  unseen: {from: 0, duration: 300}, //     0–5s   near-black, the signal, the line
  inventory: {from: 300, duration: 420}, // 5–12s  glide through hidden inventory
  signal: {from: 720, duration: 420}, //   12–19s the blue signal reveals + arranges
  clarity: {from: 1140, duration: 420}, // 19–26s clutter→clarity, the product glimpse
  reveal: {from: 1560, duration: 300}, //  26–31s condense into the mark, breathe
  close: {from: 1860, duration: 300}, //   31–36s final copy, clean resolution
};
export const SCENE_ORDER = ['unseen', 'inventory', 'signal', 'clarity', 'reveal', 'close'] as const;
export type SceneKey = (typeof SCENE_ORDER)[number];

/** Named visual events (frames). Sounds in CUES reference these same frames. */
export const EV = {
  signalIgnite: 36, // b0 beat2 — a small CULLER-blue signal far away
  travel: 96, // light travels through the environment
  lineIn: 132, // the line begins revealing, light sweep
  periodLand: 252, // b7 — orange period lands on the line
  dive: 300, // b8 beat1 — camera passes through the type plane
  reveal1: 336, // first cluster of hidden objects emerges
  reveal2: 420,
  reveal3: 528,
  glint: 600, // an orange glint — the leftover — glimpsed in the dark
  signalEnter: 720, // b5 beat1 — the signal enters the field
  ign1: 792, // ignition wave as the signal passes
  ign2: 864,
  ign3: 936,
  orangeIgnite: 1008, // b7 beat1 — the leftover ignites orange
  arrange: 1044, // objects drift into an intentional composition
  planeForm: 1140, // b8 beat1 — the composition flattens toward a plane
  glimpseIn: 1260, // the real interface, framed, integrated
  sweep: 1380, // light sweep across the glass
  glimpseOut: 1500, // pull away from the interface
  condense: 1560, // b11 beat1 — everything condenses toward the mark
  markSettle: 1728, // b12 beat1 — the mark, alone, breathing
  bell: 1764, // b12 beat2 — logo resolution voice
  wordmark: 1740, // just after settle — the lockup breathes as one
  tagline: 1932, // "Find what's sitting in your wallet"
  periodLand2: 1980, // b13 beat4 — the leftover returns home as the period
  url: 2040, // the site, readable, long enough to register
  hold: 2064,
} as const;

/** Sound event map: id, exact frame of the visual event, character. */
export interface Cue {
  f: number;
  id: string;
  kind:
    | 'boom' // confident low open / deep settle
    | 'shimmer' // filtered sparkle (glints, glass sweep, url)
    | 'tick' // small wooden tick (period lands, mark settle)
    | 'swap' // soft breath of air (dive, plane form)
    | 'wire' // filtered sweep (light travelling)
    | 'step' // ignition blip as the signal passes an object
    | 'confirm' // warm two-tone (the leftover ignites)
    | 'riser' // restrained rise into a boundary
    | 'bell' // logo resolution voice
    | 'pluck'; // pentatonic detail at reveals
}
export const CUES: Cue[] = [
  {f: EV.signalIgnite, id: 'signal-ignite', kind: 'boom'},
  {f: EV.travel, id: 'travel', kind: 'wire'},
  {f: EV.periodLand, id: 'period-1', kind: 'tick'},
  {f: EV.dive, id: 'dive', kind: 'swap'},
  {f: EV.reveal1, id: 'reveal-1', kind: 'pluck'},
  {f: EV.reveal2, id: 'reveal-2', kind: 'pluck'},
  {f: EV.reveal3, id: 'reveal-3', kind: 'tick'},
  {f: EV.glint, id: 'glint', kind: 'shimmer'},
  {f: EV.signalEnter, id: 'signal-enter', kind: 'riser'},
  {f: EV.ign1, id: 'ign-1', kind: 'step'},
  {f: EV.ign2, id: 'ign-2', kind: 'step'},
  {f: EV.ign3, id: 'ign-3', kind: 'step'},
  {f: EV.orangeIgnite, id: 'orange-ignite', kind: 'confirm'},
  {f: EV.planeForm, id: 'plane', kind: 'swap'},
  {f: EV.glimpseIn, id: 'glimpse-in', kind: 'shimmer'},
  {f: EV.sweep, id: 'sweep', kind: 'shimmer'},
  {f: EV.glimpseOut, id: 'glimpse-out', kind: 'swap'},
  {f: EV.condense, id: 'condense', kind: 'riser'},
  {f: EV.markSettle, id: 'mark-settle', kind: 'boom'},
  {f: EV.bell, id: 'logo-bell', kind: 'bell'},
  {f: EV.periodLand2, id: 'period-2', kind: 'tick'},
  {f: EV.url, id: 'url', kind: 'shimmer'},
] as const as Cue[];

/** Virtual camera tracks (world-space centre + scale). One per orientation. */
export const CAM_H = [
  {f: 0, x: 960, y: 560, s: 1, e: 'SOFT'},
  {f: 36, x: 960, y: 556, s: 1.02, e: 'SOFT'},
  {f: 96, x: 960, y: 544, s: 1.06, e: 'SWEEP'}, // travel with the light
  {f: 240, x: 960, y: 540, s: 1.12, e: 'SWEEP'},
  {f: 300, x: 960, y: 540, s: 1.18, e: 'SWEEP'}, // the dive
  {f: 360, x: 960, y: 540, s: 1.5, e: 'SWEEP'}, // through the type plane
  {f: 420, x: 900, y: 560, s: 1.32, e: 'SWEEP'}, // settle into the field
  {f: 720, x: 760, y: 540, s: 1.28, e: 'SWEEP'}, // lateral glide
  {f: 900, x: 1050, y: 520, s: 1.3, e: 'SWEEP'}, // follow the signal
  {f: 1140, x: 960, y: 540, s: 1.22, e: 'SOFT'}, // settle for the arrangement
  {f: 1260, x: 960, y: 540, s: 1.16, e: 'SOFT'}, // the glimpse, framed
  {f: 1440, x: 960, y: 540, s: 1.3, e: 'SOFT'}, // slow push into the glass
  {f: 1500, x: 960, y: 540, s: 1.32, e: 'SWEEP'},
  {f: 1620, x: 960, y: 540, s: 1.06, e: 'SWEEP'}, // pull away
  {f: 1728, x: 960, y: 540, s: 1, e: 'SOFT'},
  {f: 1872, x: 960, y: 540, s: 1, e: 'SOFT'}, // deliberate stillness
  {f: 2160, x: 960, y: 536, s: 1.015, e: 'SOFT'}, // imperceptible drift on the hold
] as const;

export const CAM_V = [
  {f: 0, x: 540, y: 980, s: 1, e: 'SOFT'},
  {f: 36, x: 540, y: 976, s: 1.02, e: 'SOFT'},
  {f: 96, x: 540, y: 958, s: 1.06, e: 'SWEEP'},
  {f: 240, x: 540, y: 950, s: 1.12, e: 'SWEEP'},
  {f: 300, x: 540, y: 950, s: 1.18, e: 'SWEEP'},
  {f: 360, x: 540, y: 950, s: 1.5, e: 'SWEEP'},
  {f: 420, x: 520, y: 980, s: 1.3, e: 'SWEEP'},
  {f: 720, x: 480, y: 940, s: 1.26, e: 'SWEEP'},
  {f: 900, x: 600, y: 920, s: 1.3, e: 'SWEEP'},
  {f: 1140, x: 540, y: 960, s: 1.2, e: 'SOFT'},
  {f: 1260, x: 540, y: 960, s: 1.14, e: 'SOFT'},
  {f: 1440, x: 540, y: 960, s: 1.28, e: 'SOFT'},
  {f: 1500, x: 540, y: 960, s: 1.3, e: 'SWEEP'},
  {f: 1620, x: 540, y: 960, s: 1.05, e: 'SWEEP'},
  {f: 1728, x: 540, y: 960, s: 1, e: 'SOFT'},
  {f: 1872, x: 540, y: 960, s: 1, e: 'SOFT'},
  {f: 2160, x: 540, y: 954, s: 1.015, e: 'SOFT'},
] as const;

export const sceneAt = (frame: number): SceneKey =>
  SCENE_ORDER.find((k) => frame >= SCENES[k].from && frame < SCENES[k].from + SCENES[k].duration) ?? 'close';

/* Composition aliases (Root.tsx). */
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const V_WIDTH = 1080;
export const V_HEIGHT = 1920;
export const TOTAL_FRAMES = DURATION;
