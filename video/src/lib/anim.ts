import {Easing, interpolate, spring} from 'remotion';

/** The product's own easing curve: --ease: cubic-bezier(0.16, 1, 0.3, 1). */
export const EASE_EXPO = Easing.bezier(0.16, 1, 0.3, 1);
/** --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1). */
export const EASE_OVER = Easing.bezier(0.34, 1.56, 0.64, 1);
/** Quiet in-out for long glides. */
export const EASE_INOUT = Easing.bezier(0.65, 0, 0.35, 1);

/** Clamp-normalised progress of a phase starting at `at` lasting `dur` frames. */
export const phase = (frame: number, at: number, dur: number): number => {
  if (dur <= 0) return frame >= at ? 1 : 0;
  return Math.min(1, Math.max(0, (frame - at) / dur));
};

/** Eased progress of a phase. */
export const ease = (frame: number, at: number, dur: number, fn = EASE_EXPO): number =>
  fn(phase(frame, at, dur));

/** Linear interpolation helper that reads like a keyframe. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Remotion spring, framed as a 0→1 progress from a start frame.
 * `damping: 200` + overshootClamping gives the product's crisp snap;
 * lower damping gives a visible settle.
 */
export const springIn = (
  frame: number,
  at: number,
  fps: number,
  opts: {damping?: number; stiffness?: number; mass?: number; overshoot?: boolean} = {},
): number =>
  spring({
    frame: Math.max(0, frame - at),
    fps,
    config: {
      damping: opts.damping ?? 200,
      stiffness: opts.stiffness ?? 170,
      mass: opts.mass ?? 0.8,
    },
    ...(opts.overshoot ?? true ? {overshootClamping: true} : {}),
  });

/** 0→1→0 bump, used for a single accent pulse (e.g. the orange full stop). */
export const bump = (frame: number, at: number, dur: number): number => {
  const t = phase(frame, at, dur);
  return t <= 0 || t >= 1 ? 0 : Math.sin(t * Math.PI);
};

/** Value that enters with a spring then holds. */
export const enter = (frame: number, at: number, dur: number, from: number, to: number): number =>
  lerp(from, to, ease(frame, at, dur));

/** Staggered index delay — the film's signature rhythm: 4-frame offsets. */
export const stagger = (index: number, step = 4): number => index * step;

/** Opacity fade with easing, 0→1. */
export const fadeIn = (frame: number, at: number, dur: number): number => ease(frame, at, dur);

/** Opacity fade, 1→0. */
export const fadeOut = (frame: number, at: number, dur: number): number => 1 - ease(frame, at, dur);

/**
 * A point travelling along a cubic bezier between two anchors — the path
 * scattered assets follow when they reflow into the ordered inventory.
 * Deterministic: same inputs, same point, every frame.
 */
export const bezierPoint = (
  t: number,
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
): [number, number] => {
  const u = 1 - t;
  const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
  const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
  return [x, y];
};

/** Cubic path string through four anchors — used for connective data paths. */
export const cubicPath = (
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
): string =>
  `M ${p0[0]} ${p0[1]} C ${p1[0]} ${p1[1]}, ${p2[0]} ${p2[1]}, ${p3[0]} ${p3[1]}`;

/**
 * Reveal fraction of a stroke-drawn path. Pairs with strokeDasharray set to
 * the path's measured length in the component.
 */
export const drawIn = (frame: number, at: number, dur: number): number => ease(frame, at, dur);

/** Rounded-rect path (SVG <rect rx> equivalent, kept for mask composition). */
export const roundRectPath = (x: number, y: number, w: number, h: number, r: number): string => {
  const rr = Math.min(r, w / 2, h / 2);
  return [
    `M ${x + rr} ${y}`,
    `H ${x + w - rr}`,
    `A ${rr} ${rr} 0 0 1 ${x + w} ${y + rr}`,
    `V ${y + h - rr}`,
    `A ${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}`,
    `H ${x + rr}`,
    `A ${rr} ${rr} 0 0 1 ${x} ${y + h - rr}`,
    `V ${y + rr}`,
    `A ${rr} ${rr} 0 0 1 ${x + rr} ${y}`,
    'Z',
  ].join(' ');
};

/** Deterministic pseudo-random in [0,1) from an integer seed — never Math.random. */
export const seeded = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Interpolate wrapper re-exported so scenes import motion from one place. */
export {interpolate, Easing};
