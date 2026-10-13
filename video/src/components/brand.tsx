import {useId} from 'react';
import {C} from '../brand/tokens';
import {MARK_TILES, LOGO_GLYPHS, MARK_VIEWBOX, LOGO_VIEWBOX} from '../brand/logoGeometry';
import {measure} from '../brand/textMetrics';
import {ease, EASE_EXPO} from '../lib/anim';

/**
 * The authentic CULLER mark: 26 rounded tiles on the brand blue ramp
 * (#4468FF → #B4C8FF), extracted from the vector master. Here they assemble
 * along the arc — the film's signature reveal — instead of appearing whole.
 */
export function CullerMark({
  x,
  y,
  height,
  progress = 1,
  opacity = 1,
  mono,
  spin = 0,
}: {
  x: number;
  y: number;
  height: number;
  progress?: number;
  opacity?: number;
  /** Render every tile in one colour (for tinted backgrounds). */
  mono?: string;
  /** Extra rotation of the whole mark, degrees. */
  spin?: number;
}) {
  const [vx, vy, vw, vh] = MARK_VIEWBOX;
  const s = height / vh;
  const cx = vx + vw / 2;
  const cy = vy + vh / 2;
  const n = MARK_TILES.length;
  return (
    <g opacity={opacity} transform={`translate(${x} ${y}) rotate(${spin}) scale(${s}) translate(${-cx} ${-cy})`}>
      {MARK_TILES.map((t, i) => {
        const p = ease(progress * 1.4 - (i / n) * 0.4, 0, 1, EASE_EXPO);
        const k = 0.55 + 0.45 * p;
        const extra = (1 - p) * 24;
        if (p <= 0.001) return null;
        return (
          <rect
            key={i}
            x={-t.w / 2}
            y={-t.h / 2}
            width={t.w}
            height={t.h}
            rx={t.rx}
            fill={mono ?? t.fill}
            fillOpacity={t.opacity * p}
            transform={`translate(${t.tx} ${t.ty}) rotate(${t.rot + extra}) scale(${k})`}
          />
        );
      })}
    </g>
  );
}

const GLYPH = LOGO_GLYPHS[0];
/** Letter x-starts, for staggered treatments (c u l l e r). */
const LETTER_X = [2.2576, 37.9687, 72.8002, 86.9908, 99.8914, 136.4821];
const GLYPH_W = 152.3146 - 2.2576;
const GLYPH_H = 0.7037 - -32.5739;

/**
 * The authentic outlined wordmark — Plus Jakarta Sans Bold converted to
 * outlines per the brand kit. Rendered from the real vector paths so it is
 * flat, crisp and font-independent at any size. Reveals through a
 * directional clip mask.
 */
export function CullerWordmark({
  x,
  y,
  height,
  reveal = 1,
  opacity = 1,
  fill = C.text,
}: {
  /** Left edge of the wordmark. */
  x: number;
  /** Baseline of the wordmark. */
  y: number;
  /** Height of the ascenders ("l"), in px. */
  height: number;
  reveal?: number;
  opacity?: number;
  fill?: string;
}) {
  const id = useId().replace(/[:]/g, '');
  const s = height / GLYPH_H;
  const w = GLYPH_W * s;
  const p = Math.min(1, Math.max(0, reveal));
  return (
    <g opacity={opacity}>
      <clipPath id={`wm-${id}`}>
        <rect x={x - 2} y={y - height * 1.4} width={(w + 4) * p} height={height * 2.4} />
      </clipPath>
      {/* clip lives OUTSIDE the transform: clip-path user space is the
          referencing element's own space, so a transformed g would scale
          its clip with it. */}
      <g clipPath={`url(#wm-${id})`}>
        <g transform={`translate(${x - (LETTER_X[0] + GLYPH.tx) * s} ${y - (0.7037 + GLYPH.ty) * s}) scale(${s})`}>
          <path d={GLYPH.d} transform={`translate(${GLYPH.tx} ${GLYPH.ty})`} fill={fill} />
        </g>
      </g>
    </g>
  );
}

/** Full horizontal lockup: mark + wordmark, spaced on the brand grid. */
export function CullerLockup({
  x,
  y,
  markHeight,
  progress = 1,
  reveal = 1,
  opacity = 1,
  fill = C.text,
}: {
  x: number;
  /** Vertical centre of the lockup. */
  y: number;
  markHeight: number;
  progress?: number;
  reveal?: number;
  opacity?: number;
  fill?: string;
}) {
  const wmHeight = markHeight * 0.42;
  const gap = markHeight * 0.42;
  const wmX = x + markHeight + gap;
  return (
    <g opacity={opacity}>
      <CullerMark x={x + markHeight / 2} y={y} height={markHeight} progress={progress} />
      <CullerWordmark x={wmX} y={y + wmHeight * 0.5} height={wmHeight} reveal={reveal} fill={fill} />
    </g>
  );
}

/** Pixel width of the lockup at a given mark height (for centring). */
export function lockupWidth(markHeight: number): number {
  const wmHeight = markHeight * 0.42;
  const gap = markHeight * 0.42;
  const wmW = (GLYPH_W / GLYPH_H) * wmHeight;
  return markHeight + gap + wmW;
}

export {GLYPH_W, GLYPH_H, LETTER_X, LOGO_VIEWBOX};
export const wordmarkWidth = (height: number): number => (GLYPH_W / GLYPH_H) * height;
export {measure};
