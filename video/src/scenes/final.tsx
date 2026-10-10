import {C, STROKE} from '../brand/tokens';
import {COPY} from '../brand/copy';
import {CUES} from '../brand/timeline';
import {measureTracked} from '../brand/textMetrics';
import {FilmText, MonoLabel, MaskReveal, Hairline} from '../components/primitives';
import {CullerLockup, lockupWidth} from '../components/brand';
import {ease, fadeIn, EASE_EXPO} from '../lib/anim';
import type {LayoutKey} from './data';

/**
 * SCENE 7 — FINAL CARD (0:32–0:35)
 *
 * A clean end card that reads as an extension of the homepage: the real
 * lockup, the brand line, the live demo domain, and one minimal geometric
 * composition in blue and orange. From CUES.finalHold onward every value is
 * constant, so the last frames work as a standalone promotional still.
 */

const GEO = {
  h: {lockup: {x: 140, y: 400, mark: 150}, lineY: 560, tag: {x: 140, y: 690, size: 64}, url: {x: 140, y: 776, size: 28}, micro: {x: 140, y: 972, size: 16}, geo: {x: 1560, y: 500}},
  v: {lockup: {x: 343, y: 440, mark: 160}, lineY: 610, tag: {x: 540, y: 740, size: 54}, url: {x: 540, y: 828, size: 26}, micro: {x: 540, y: 1748, size: 15}, geo: {x: 540, y: 1240}},
} as const;

function SideGeometry({frame, o}: {frame: number; o: LayoutKey}) {
  const g = GEO[o].geo;
  const t = fadeIn(frame, CUES.finalCard + 18, 26);
  if (t <= 0) return null;
  return (
    <g opacity={t}>
      <rect x={-210} y={-210} width={420} height={420} rx={92} fill="none" stroke={C.borderStrong} strokeWidth={1.6} transform={`translate(${g.x} ${g.y}) rotate(8)`} />
      <rect x={-150} y={-150} width={300} height={300} rx={66} fill="none" stroke={C.accentText} strokeWidth={1.6} opacity={0.5} transform={`translate(${g.x} ${g.y}) rotate(-6)`} />
      <rect x={-10} y={-10} width={20} height={20} rx={6} fill={C.secondary} transform={`translate(${g.x} ${g.y})`} />
    </g>
  );
}

export function Scene7H({frame}: {frame: number}) {
  const g = GEO.h;
  const lockIn = ease(frame, CUES.finalCard, 22, EASE_EXPO);
  const lineIn = ease(frame, CUES.finalCard + 8, 20, EASE_EXPO);
  const tagIn = ease(frame, CUES.finalCard + 12, 20, EASE_EXPO);
  const urlIn = fadeIn(frame, CUES.finalCard + 22, 16);
  const microIn = fadeIn(frame, CUES.finalCard + 30, 16);
  const tagW = measureTracked(COPY.finalTag, 'sans800', g.tag.size, -0.03);
  const urlW = measureTracked(COPY.finalUrl, 'mono400', g.url.size, 0.06);
  return (
    <g>
      <SideGeometry frame={frame} o="h" />
      <g opacity={lockIn} transform={`translate(0 ${(1 - lockIn) * -18})`}>
        <CullerLockup x={g.lockup.x} y={g.lockup.y} markHeight={g.lockup.mark} />
      </g>
      <Hairline x1={g.lockup.x} y={g.lineY} x2={g.lockup.x + 620} progress={lineIn} color={C.borderStrong} weight={STROKE.thin} />
      <MaskReveal id="f7-h-tag" x={g.tag.x - 8} y={g.tag.y - g.tag.size} w={tagW + 24} h={g.tag.size * 1.3} progress={tagIn} direction="up">
        <FilmText x={g.tag.x} y={g.tag.y} spec="display" size={g.tag.size} fill={C.text}>
          {COPY.finalTag}
        </FilmText>
      </MaskReveal>
      <g opacity={urlIn}>
        <rect x={g.url.x} y={g.url.y - 20} width={12} height={12} rx={3} fill={C.secondary} />
        <MonoLabel x={g.url.x + 32} y={g.url.y} size={g.url.size} fill={C.accentText} tracking={0.06}>
          {COPY.finalUrl}
        </MonoLabel>
        <Hairline x1={g.url.x + 32} y={g.url.y + 14} x2={g.url.x + 32 + urlW} progress={1} color={C.border} weight={1.2} />
      </g>
      <MonoLabel x={g.micro.x} y={g.micro.y} size={g.micro.size} fill={C.textMuted} opacity={microIn} tracking={0.14}>
        {COPY.finalMicro}
      </MonoLabel>
    </g>
  );
}

export function Scene7V({frame}: {frame: number}) {
  const g = GEO.v;
  const lockIn = ease(frame, CUES.finalCard, 22, EASE_EXPO);
  const lineIn = ease(frame, CUES.finalCard + 8, 20, EASE_EXPO);
  const tagIn = ease(frame, CUES.finalCard + 12, 20, EASE_EXPO);
  const urlIn = fadeIn(frame, CUES.finalCard + 22, 16);
  const microIn = fadeIn(frame, CUES.finalCard + 30, 16);
  const tagW = measureTracked(COPY.finalTag, 'sans800', g.tag.size, -0.03);
  const urlW = measureTracked(COPY.finalUrl, 'mono400', g.url.size, 0.06);
  const lw = lockupWidth(g.lockup.mark);
  return (
    <g>
      <SideGeometry frame={frame} o="v" />
      <g opacity={lockIn} transform={`translate(0 ${(1 - lockIn) * -18})`}>
        <CullerLockup x={(1080 - lw) / 2} y={g.lockup.y} markHeight={g.lockup.mark} />
      </g>
      <Hairline x1={540 - 310} y={g.lineY} x2={540 + 310} progress={lineIn} color={C.borderStrong} weight={STROKE.thin} />
      <MaskReveal id="f7-v-tag" x={g.tag.x - tagW / 2 - 8} y={g.tag.y - g.tag.size} w={tagW + 24} h={g.tag.size * 1.3} progress={tagIn} direction="up">
        <FilmText x={g.tag.x} y={g.tag.y} spec="display" size={g.tag.size} fill={C.text} anchor="middle">
          {COPY.finalTag}
        </FilmText>
      </MaskReveal>
      <g opacity={urlIn}>
        <rect x={540 - (urlW + 32) / 2} y={g.url.y - 19} width={12} height={12} rx={3} fill={C.secondary} />
        <MonoLabel x={540 - (urlW + 32) / 2 + 32} y={g.url.y} size={g.url.size} fill={C.accentText} tracking={0.06}>
          {COPY.finalUrl}
        </MonoLabel>
      </g>
      <MonoLabel x={g.micro.x} y={g.micro.y} size={g.micro.size} fill={C.textMuted} opacity={microIn} anchor="middle" tracking={0.12}>
        {COPY.finalMicro}
      </MonoLabel>
    </g>
  );
}
