import {C, STROKE} from '../brand/tokens';
import {COPY} from '../brand/copy';
import {CUES} from '../brand/timeline';
import {measureTracked} from '../brand/textMetrics';
import {FilmText, MaskReveal, Hairline} from '../components/primitives';
import {CullerMark, CullerWordmark, lockupWidth, wordmarkWidth} from '../components/brand';
import {ease, EASE_EXPO} from '../lib/anim';
import type {LayoutKey} from './data';

/**
 * SCENE 6 — BRAND REVEAL (0:28–0:32)
 *
 * The interface lets go. The closing lines collapse toward a single
 * alignment point while a flat blue shape — the pure brand accent, not a
 * gradient — slides in and hands over to the real mark, which assembles
 * tile by tile along its arc. A precise orange rule draws beneath the
 * lockup, then the authentic outlined wordmark reveals through a clip.
 * The logo stays flat and crisp: no extrusion, no 3D, no shine sweep.
 */

const GEO = {
  h: {mark: {x: 400, y: 470, height: 300}, lineY: 668, copy: {x: 140, y1: 800, y2: 872, size: 52}},
  v: {mark: {x: 540, y: 560, height: 260}, lineY: 806, copy: {x: 540, y1: 1000, y2: 1072, size: 48}},
} as const;

function Collapse({frame, o}: {frame: number; o: LayoutKey}) {
  const t = ease(frame, CUES.collapse, 20, EASE_EXPO);
  if (t >= 1) return null;
  const pos = o === 'h' ? {x: 140, y1: 760, y2: 856, size: 84} : {x: 84, y1: 1600, y2: 1696, size: 80};
  const target = o === 'h' ? {x: 260, y: 540} : {x: 540, y: 560};
  const s = 1 - 0.55 * t;
  const cx = pos.x + (target.x - pos.x) * t;
  const cy = pos.y1 + (target.y - pos.y1) * t;
  return (
    <g opacity={1 - t} transform={`translate(${cx - pos.x} ${cy - pos.y1}) scale(${s})`}>
      <FilmText x={pos.x} y={pos.y1} spec="display" size={pos.size} fill={C.text}>
        {COPY.processLine1}
      </FilmText>
      <FilmText x={pos.x} y={pos.y2} spec="display" size={pos.size} fill={C.text}>
        {COPY.processLine2}
      </FilmText>
    </g>
  );
}

function BlueHandover({frame, o}: {frame: number; o: LayoutKey}) {
  const g = GEO[o];
  const inT = ease(frame, CUES.collapse + 6, 24, EASE_EXPO);
  const outT = ease(frame, CUES.markAssemble + 10, 24, EASE_EXPO);
  if (inT <= 0 || outT >= 1) return null;
  const size = g.mark.height * 1.06;
  const fromX = o === 'h' ? -size - 200 : g.mark.x;
  const fromY = o === 'h' ? g.mark.y : -size - 200;
  const x = fromX + (g.mark.x - fromX) * inT;
  const y = fromY + (g.mark.y - fromY) * inT;
  const k = 1 - 0.25 * outT;
  return (
    <rect
      x={-size / 2}
      y={-size / 2}
      width={size}
      height={size}
      rx={size * 0.26}
      fill={C.accent}
      opacity={0.92 * (1 - outT)}
      transform={`translate(${x} ${y}) scale(${k}) rotate(${(1 - inT) * -12})`}
    />
  );
}

export function Scene6H({frame}: {frame: number}) {
  const g = GEO.h;
  const markP = ease(frame, CUES.markAssemble, 30, EASE_EXPO);
  const wmReveal = ease(frame, CUES.wordmarkIn, 26, EASE_EXPO);
  const lineIn = ease(frame, CUES.wordmarkIn, 22, EASE_EXPO);
  const copyIn1 = ease(frame, CUES.revealCopy, 20, EASE_EXPO);
  const copyIn2 = ease(frame, CUES.revealCopy + 8, 20, EASE_EXPO);
  const release = 1 - ease(frame, 948, 12, EASE_EXPO);
  const lw = lockupWidth(g.mark.height);
  const wmHeight = g.mark.height * 0.42;
  const wmX = g.mark.x + g.mark.height + g.mark.height * 0.42;
  const w1 = measureTracked(COPY.revealLine1, 'sans800', g.copy.size, -0.03);
  const w2 = measureTracked(COPY.revealLine2, 'sans800', g.copy.size, -0.03);
  return (
    <g>
      <Collapse frame={frame} o="h" />
      <BlueHandover frame={frame} o="h" />
      <CullerMark x={g.mark.x} y={g.mark.y} height={g.mark.height} progress={markP} />
      <CullerWordmark x={wmX} y={g.mark.y + wmHeight * 0.5} height={wmHeight} reveal={wmReveal} fill={C.text} />
      <g opacity={release}>
      <Hairline x1={g.mark.x - g.mark.height / 2} y={g.lineY} x2={g.mark.x - g.mark.height / 2 + lw} progress={lineIn} color={C.secondary} weight={STROKE.regular} />
      <MaskReveal id="rv-h-1" x={g.copy.x - 8} y={g.copy.y1 - g.copy.size} w={w1 + 24} h={g.copy.size * 1.3} progress={copyIn1} direction="up">
        <FilmText x={g.copy.x} y={g.copy.y1} spec="display" size={g.copy.size} fill={C.text}>
          {COPY.revealLine1}
        </FilmText>
      </MaskReveal>
      <MaskReveal id="rv-h-2" x={g.copy.x - 8} y={g.copy.y2 - g.copy.size} w={w2 + 24} h={g.copy.size * 1.3} progress={copyIn2} direction="up">
        <FilmText x={g.copy.x} y={g.copy.y2} spec="display" size={g.copy.size} fill={C.text}>
          {COPY.revealLine2}
        </FilmText>
      </MaskReveal>
      </g>
    </g>
  );
}

export function Scene6V({frame}: {frame: number}) {
  const g = GEO.v;
  const markP = ease(frame, CUES.markAssemble, 30, EASE_EXPO);
  const wmReveal = ease(frame, CUES.wordmarkIn, 26, EASE_EXPO);
  const lineIn = ease(frame, CUES.wordmarkIn, 22, EASE_EXPO);
  const copyIn1 = ease(frame, CUES.revealCopy, 20, EASE_EXPO);
  const copyIn2 = ease(frame, CUES.revealCopy + 8, 20, EASE_EXPO);
  const release = 1 - ease(frame, 948, 12, EASE_EXPO);
  const wmHeight = g.mark.height * 0.42;
  const wmW = wordmarkWidth(wmHeight);
  const wmX = (1080 - wmW) / 2;
  const wmY = 760;
  const w1 = measureTracked(COPY.revealLine1, 'sans800', g.copy.size, -0.03);
  const w2 = measureTracked(COPY.revealLine2, 'sans800', g.copy.size, -0.03);
  return (
    <g>
      <Collapse frame={frame} o="v" />
      <BlueHandover frame={frame} o="v" />
      <CullerMark x={g.mark.x} y={g.mark.y} height={g.mark.height} progress={markP} />
      <CullerWordmark x={wmX} y={wmY} height={wmHeight} reveal={wmReveal} fill={C.text} />
      <g opacity={release}>
      <Hairline x1={wmX} y={g.lineY} x2={wmX + wmW} progress={lineIn} color={C.secondary} weight={STROKE.regular} />
      <MaskReveal id="rv-v-1" x={g.copy.x - w1 / 2 - 8} y={g.copy.y1 - g.copy.size} w={w1 + 24} h={g.copy.size * 1.3} progress={copyIn1} direction="up">
        <FilmText x={g.copy.x} y={g.copy.y1} spec="display" size={g.copy.size} fill={C.text} anchor="middle">
          {COPY.revealLine1}
        </FilmText>
      </MaskReveal>
      <MaskReveal id="rv-v-2" x={g.copy.x - w2 / 2 - 8} y={g.copy.y2 - g.copy.size} w={w2 + 24} h={g.copy.size * 1.3} progress={copyIn2} direction="up">
        <FilmText x={g.copy.x} y={g.copy.y2} spec="display" size={g.copy.size} fill={C.text} anchor="middle">
          {COPY.revealLine2}
        </FilmText>
      </MaskReveal>
      </g>
    </g>
  );
}
