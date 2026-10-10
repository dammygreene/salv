/**
 * The film's motion vocabulary. One solver, four named curves, two spring
 * presets. Camera and long travels accelerate/decelerate over many frames
 * (SWEEP / SOFT); interface and typography use the site's own out-curve
 * (GLIDE); exits tuck (TUCK). Springs are reserved for micro-interactions.
 *
 * Pure functions: identical output in the Remotion browser and in the SSR
 * QA rasteriser.
 */

export type CurveName = 'GLIDE' | 'SWEEP' | 'SOFT' | 'TUCK' | 'LINEAR';

/** Newton-Raphson cubic-bezier solver (same math as CSS timing functions). */
function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-5) return sampleY(t);
      const d = sampleDX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    while (lo < hi) {
      const dx = sampleX(t);
      if (Math.abs(dx - x) < 1e-5) break;
      if (x > dx) lo = t;
      else hi = t;
      t = (hi - lo) / 2 + lo;
      if (hi - lo < 1e-6) break;
    }
    return sampleY(t);
  };
}

export const CURVES: Record<CurveName, (t: number) => number> = {
  GLIDE: cubicBezier(0.16, 1, 0.3, 1), // site ease: confident out-glide
  SWEEP: cubicBezier(0.65, 0, 0.35, 1), // camera & long travels
  SOFT: cubicBezier(0.33, 1, 0.68, 1), // long settles / arrivals
  TUCK: cubicBezier(0.5, 0, 0.75, 1), // exits only
  LINEAR: (t) => t, // deliberate constant motion (scan fill, caret)
};

export const curve = (name: CurveName) => CURVES[name];

/** Scalar keyframe track: value keys with a per-segment curve. */
export interface NumKey {
  f: number;
  v: number;
  e?: CurveName;
}
export function track(frame: number, keys: readonly NumKey[]): number {
  if (frame <= keys[0].f) return keys[0].v;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (frame <= b.f) {
      const t = b.f === a.f ? 1 : (frame - a.f) / (b.f - a.f);
      return a.v + (b.v - a.v) * CURVES[a.e ?? 'GLIDE'](t);
    }
  }
  return keys[keys.length - 1].v;
}

/** Camera key: world-space centre + scale, per-segment curve. */
export interface CamKey {
  f: number;
  x: number;
  y: number;
  s: number;
  e?: CurveName;
}
export interface CamState {
  x: number;
  y: number;
  s: number;
}
export function camAt(frame: number, keys: readonly CamKey[]): CamState {
  if (frame <= keys[0].f) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (frame <= b.f) {
      const t = b.f === a.f ? 1 : (frame - a.f) / (b.f - a.f);
      const k = CURVES[a.e ?? 'SWEEP'](t);
      return {x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, s: a.s + (b.s - a.s) * k};
    }
  }
  const last = keys[keys.length - 1];
  return {x: last.x, y: last.y, s: last.s};
}

/** World transform string for a camera state (centre-based push/pan). */
export const camTransform = (st: CamState, w: number, h: number) =>
  `translate(${w / 2} ${h / 2}) scale(${st.s}) translate(${-st.x} ${-st.y})`;

/** Spring presets — micro-interactions only, never camera or type. */
export const SPRING = {
  settle: {stiffness: 520, damping: 38, mass: 1}, // stiff, no overshoot
  pop: {stiffness: 300, damping: 21, mass: 1}, // one controlled overshoot
} as const;

/** 0→1 phase with a named curve (shorthand used by scenes). */
export const ph = (frame: number, at: number, dur: number, e: CurveName = 'GLIDE') =>
  CURVES[e](Math.min(1, Math.max(0, (frame - at) / dur)));
