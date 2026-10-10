import {C, r, STROKE} from '../brand/tokens';
import {MonoLabel} from './primitives';
import type {AssetKind} from '../scenes/kinds';

/**
 * Original geometric asset icons — one per real AssetKind. Drawn as line
 * work on a shared 44-unit grid with the film's single stroke weight, so a
 * TOKEN, NFT, POSITION and ACCOUNT read as one family rather than clip-art.
 * Nothing here reproduces a third-party token logo.
 */
export function AssetIcon({kind, color = C.accentText, size = 44, weight = STROKE.regular}: {kind: AssetKind; color?: string; size?: number; weight?: number}) {
  const s = size / 44;
  const common = {
    fill: 'none',
    stroke: color,
    strokeWidth: weight,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <g transform={`scale(${s})`}>
      {kind === 'TOKEN' ? (
        <g {...common}>
          <circle r={16} />
          <path d="M -6.4 4.6 A 8 8 0 1 1 6.4 4.6" />
          <circle r={2.4} fill={color} stroke="none" />
        </g>
      ) : null}
      {kind === 'NFT' ? (
        <g {...common}>
          <path d="M -15 -6 A 9 9 0 0 1 -6 -15 H 6 A 9 9 0 0 1 15 -6 V 6 L 6 15 H -6 A 9 9 0 0 1 -15 6 Z" />
          <rect x={-5} y={-5} width={10} height={10} rx={2.5} transform="rotate(45)" />
        </g>
      ) : null}
      {kind === 'ACCOUNT' ? (
        <g {...common}>
          <rect x={-16} y={-16} width={32} height={32} rx={10} />
          <rect x={-7} y={-7} width={14} height={14} rx={4.5} />
        </g>
      ) : null}
      {kind === 'POSITION' ? (
        <g {...common}>
          <rect x={-12.5} y={-12.5} width={25} height={25} rx={6} transform="rotate(45)" />
          <line x1={-9} y1={0} x2={9} y2={0} />
        </g>
      ) : null}
    </g>
  );
}

/**
 * A single asset tile — the film's atomic object. Same surface, border and
 * radius language as the product's .asset-card, scaled to film size.
 */
export function AssetTile({
  x,
  y,
  size = 132,
  kind,
  label,
  meta,
  scale = 1,
  rotation = 0,
  opacity = 1,
  flagged = false,
  showText = true,
  iconColor,
  fill = C.surface,
  border,
}: {
  x: number;
  y: number;
  size?: number;
  kind: AssetKind;
  label?: string;
  meta?: string;
  scale?: number;
  rotation?: number;
  opacity?: number;
  flagged?: boolean;
  showText?: boolean;
  iconColor?: string;
  fill?: string;
  border?: string;
}) {
  const half = size / 2;
  const rad = r('lg') * (size / 220);
  return (
    <g
      opacity={opacity}
      transform={`translate(${x} ${y}) rotate(${rotation}) scale(${scale})`}
    >
      <rect
        x={-half}
        y={-half}
        width={size}
        height={size}
        rx={rad}
        fill={fill}
        stroke={border ?? (flagged ? C.borderSecondary : C.border)}
        strokeWidth={flagged ? 2 : 1.6}
      />
      <g transform={`translate(0 ${showText ? -14 : 0})`}>
        <AssetIcon kind={kind} color={iconColor ?? (flagged ? C.secondary : C.accentText)} size={size * 0.34} />
      </g>
      {showText && label ? (
        <MonoLabel x={0} y={half - 34} size={13} fill={flagged ? C.secondary : C.textMuted} anchor="middle" tracking={0.12}>
          {label}
        </MonoLabel>
      ) : null}
      {showText && meta ? (
        <MonoLabel x={0} y={half - 16} size={12} fill={C.textMuted} anchor="middle" tracking={0.06} opacity={0.75}>
          {meta}
        </MonoLabel>
      ) : null}
      {flagged ? <circle cx={half - 14} cy={-half + 14} r={4} fill={C.secondary} /> : null}
    </g>
  );
}

/**
 * Large abstract "form" — an oversized outlined rounded square that sits
 * behind tile clusters to give the field depth without any glassmorphism.
 */
export function BackForm({x, y, size, rotation = 0, opacity = 1, color = C.border}: {x: number; y: number; size: number; rotation?: number; opacity?: number; color?: string}) {
  return (
    <rect
      x={-size / 2}
      y={-size / 2}
      width={size}
      height={size}
      rx={size * 0.22}
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      opacity={opacity}
      transform={`translate(${x} ${y}) rotate(${rotation})`}
    />
  );
}
