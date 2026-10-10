import type {CSSProperties, ReactNode} from 'react';
import {C, FONT, TYPE} from '../brand/tokens';
import {measureTracked} from '../brand/textMetrics';

/**
 * SVG drawing primitives shared by every scene.
 *
 * The whole film is authored as one <svg> per composition. That is what makes
 * it deterministic and render-identical: no CSS layout, no reflow, no font
 * metrics surprises — every glyph, panel and hairline sits on explicit
 * coordinates on the 8px brand grid.
 */

export interface TextSpec {
  family: string;
  weight: number;
  tracking: string;
  lineHeight: number;
}

export const TEXT_SPECS: Record<keyof typeof TYPE, TextSpec> = TYPE;

export function FilmText({
  x,
  y,
  children,
  spec = 'display',
  size = 96,
  fill = C.text,
  opacity = 1,
  anchor = 'start',
  letterSpacing,
  style,
}: {
  x: number;
  y: number;
  children: ReactNode;
  spec?: keyof typeof TYPE;
  size?: number;
  fill?: string;
  opacity?: number;
  anchor?: 'start' | 'middle' | 'end';
  letterSpacing?: number;
  style?: CSSProperties;
}) {
  const t = TYPE[spec];
  // SVG letter-spacing is in user units; tokens give em, so convert.
  const em = parseFloat(t.tracking);
  const ls = letterSpacing ?? (Number.isNaN(em) ? 0 : em * size);
  return (
    <text
      x={x}
      y={y}
      fill={fill}
      opacity={opacity}
      textAnchor={anchor}
      fontFamily={t.family}
      fontWeight={t.weight}
      fontSize={size}
      letterSpacing={ls}
      style={style}
    >
      {children}
    </text>
  );
}

/** Tiny technical label — JetBrains Mono, tracked, muted. */
export function MonoLabel({
  x,
  y,
  children,
  size = 19,
  fill = C.textMuted,
  opacity = 1,
  anchor = 'start',
  tracking = 0.14,
}: {
  x: number;
  y: number;
  children: ReactNode;
  size?: number;
  fill?: string;
  opacity?: number;
  anchor?: 'start' | 'middle' | 'end';
  tracking?: number;
}) {
  return (
    <FilmText x={x} y={y} spec="label" size={size} fill={fill} opacity={opacity} anchor={anchor} letterSpacing={tracking * size}>
      {children}
    </FilmText>
  );
}

/** Animated horizontal hairline that draws left→right. */
export function Hairline({
  x1,
  y,
  x2,
  progress,
  color = C.borderStrong,
  weight = 1.6,
  opacity = 1,
}: {
  x1: number;
  y: number;
  x2: number;
  progress: number;
  color?: string;
  weight?: number;
  opacity?: number;
}) {
  const w = (x2 - x1) * progress;
  if (w <= 0) return null;
  return <line x1={x1} y1={y} x2={x1 + w} y2={y} stroke={color} strokeWidth={weight} opacity={opacity} />;
}

/** Animated vertical hairline that draws top→bottom. */
export function VHairline({
  x,
  y1,
  y2,
  progress,
  color = C.borderStrong,
  weight = 1.6,
  opacity = 1,
}: {
  x: number;
  y1: number;
  y2: number;
  progress: number;
  color?: string;
  weight?: number;
  opacity?: number;
}) {
  const h = (y2 - y1) * progress;
  if (h <= 0) return null;
  return <line x1={x} y1={y1} x2={x} y2={y1 + h} stroke={color} strokeWidth={weight} opacity={opacity} />;
}

/**
 * Clip mask that wipes open in a direction — the film's typographic reveal.
 * Children are drawn only inside the opening rect.
 */
export function MaskReveal({
  id,
  x,
  y,
  w,
  h,
  progress,
  direction = 'up',
  children,
}: {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  progress: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  children: ReactNode;
}) {
  const p = Math.min(1, Math.max(0, progress));
  let cx = x;
  let cy = y;
  let cw = w;
  let ch = h;
  if (direction === 'up') {
    cy = y + h * (1 - p);
    ch = h * p;
  } else if (direction === 'down') {
    ch = h * p;
  } else if (direction === 'right') {
    cw = w * p;
  } else {
    cx = x + w * (1 - p);
    cw = w * p;
  }
  return (
    <>
      <clipPath id={id}>
        <rect x={cx} y={cy} width={Math.max(0, cw)} height={Math.max(0, ch)} />
      </clipPath>
      <g clipPath={`url(#${id})`}>{children}</g>
    </>
  );
}

/** Panel with the product's exact surface/border/radius language. */
export function Panel({
  x,
  y,
  w,
  h,
  radius = 29,
  fill = C.surface,
  stroke = C.border,
  strokeWidth = 1.6,
  opacity = 1,
  shadow = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  radius?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  shadow?: boolean;
}) {
  return (
    <g opacity={opacity}>
      {shadow ? <rect x={x} y={y + 18} width={w} height={h} rx={radius} fill="rgba(0,0,0,0.45)" /> : null}
      <rect x={x} y={y} width={w} height={h} rx={radius} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
    </g>
  );
}

/** Width of a status pill for its label — mono advance + tracking + dot + padding. */
export function statusPillWidth(label: string, size = 17): number {
  return measureTracked(label, 'mono400', size, 0.08) + 46;
}

/** Status pill — geometry and colours taken from components.css .status-badge. */
export function StatusPill({
  x,
  y,
  label,
  fg,
  bg,
  border,
  height = 40,
  opacity = 1,
  scale = 1,
  size = 17,
}: {
  x: number;
  y: number;
  label: string;
  fg: string;
  bg: string;
  border: string;
  height?: number;
  opacity?: number;
  scale?: number;
  size?: number;
}) {
  const width = statusPillWidth(label, size);
  const cy = y + height / 2;
  return (
    <g opacity={opacity} transform={`translate(${x + width / 2} ${cy}) scale(${scale}) translate(${-(x + width / 2)} ${-cy})`}>
      <rect x={x} y={y} width={width} height={height} rx={height / 2} fill={bg} stroke={border} strokeWidth={1.4} />
      <circle cx={x + 18} cy={cy} r={4} fill={fg} />
      <FilmText x={x + 30} y={cy + size * 0.36} spec="label" size={size} fill={fg} letterSpacing={0.08 * size}>
        {label}
      </FilmText>
    </g>
  );
}

/**
 * Connective data path — blue, dash-drawn, optional travelling head dot.
 * The film's connective tissue: mapping, discovery and classification lines.
 */
export function DataPath({
  d,
  length,
  progress,
  color = C.accentText,
  weight = 2,
  opacity = 1,
  head = false,
  headColor,
}: {
  d: string;
  length: number;
  progress: number;
  color?: string;
  weight?: number;
  opacity?: number;
  head?: boolean;
  headColor?: string;
}) {
  const p = Math.min(1, Math.max(0, progress));
  if (p <= 0) return null;
  return (
    <g opacity={opacity}>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={weight}
        strokeLinecap="round"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - p)}
      />
      {head && p < 1 ? <circle r={4.4} fill={headColor ?? color} opacity={0.9} /> : null}
    </g>
  );
}

export const FONT_FAMILIES = FONT;
