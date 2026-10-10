/**
 * The film as ONE continuous world per orientation. A virtual camera
 * (keyed track in timeline.ts) moves through it; the browser frame and its
 * page persist from S2 to S5 and only the page content navigates, exactly like
 * the real product flow. Cover, product and outro are layers in this world,
 * not separate compositions — transitions are camera moves and match cuts.
 */
import React from 'react';
import {C, r} from '../brand/tokens';
import {COPY} from '../brand/copy';
import {EV, CAM_H, CAM_V, SCROLL_H, SCROLL_V} from '../brand/timeline';
import {STAGE, COVER, FINAL, p2w, type Ori} from '../brand/stage';
import {camAt, track, ph} from '../lib/motion';
import {measureTracked} from '../brand/textMetrics';
import {CullerMark, CullerWordmark, CullerLockup, lockupWidth} from '../components/brand';
import {MARK_TILES} from '../brand/logoGeometry';
import {Chrome, NavLinks, HomeHero, ScanHead, Machine, ScanControls, Rows, Alloc, L} from '../components/product';
import {Anchor, Cursor} from '../components/anchor';
import {FilmText, MonoLabel, MaskReveal, Panel} from '../components/primitives';

type Lay = (typeof L)['h'];
const lay = (o: Ori): Lay => L[o] as Lay;

const CARD_DST = {
  h: {x: 560, y: 280, w: 800, h: 740},
  v: {x: 120, y: 560, w: 840, h: 840},
} as const;

function CamLayer({o, frame, depth, children}: {o: Ori; frame: number; depth: number; children: React.ReactNode}) {
  const st = STAGE[o];
  const cam = camAt(frame, o === 'h' ? CAM_H : CAM_V);
  const s = 1 + (cam.s - 1) * depth;
  const cx = st.w / 2 + (cam.x - st.w / 2) * depth;
  const cy = st.h / 2 + (cam.y - st.h / 2) * depth;
  return <g transform={`translate(${st.w / 2} ${st.h / 2}) scale(${s}) translate(${-cx} ${-cy})`}>{children}</g>;
}

/* ── cover → nav lockup, cover tagline → hero H1 (match cuts) ───────── */

function navPose(o: Ori) {
  const l = lay(o);
  const markH = o === 'h' ? 26 : 22;
  const c = p2w(o, 48 + markH / 2, l.nav.y - 9, 0);
  return {x: c.x - markH / 2, y: c.y, markH};
}

export function CoverLockup({o, frame}: {o: Ori; frame: number}) {
  const c = COVER[o];
  const n = navPose(o);
  const t = ph(frame, 232, 92, 'SWEEP');
  const markH = c.markH + (n.markH - c.markH) * t;
  const ax = c.cx - lockupWidth(c.markH) / 2;
  const x = ax + (n.x - ax) * t;
  const y = c.lockupY + (n.y - c.lockupY) * t;
  return <CullerLockup x={x} y={y} markHeight={markH} />;
}


function taglinePoses(o: Ori) {
  const c = COVER[o];
  const l = lay(o);
  const h1 = o === 'h' ? 56 : 44;
  const wA = measureTracked(COPY.tagline, 'sans800', c.tagSize, -0.03);
  const wB = measureTracked(COPY.tagline, 'sans800', h1, -0.03);
  const b = p2w(o, 48, l.hero.h1Y, 0);
  return {
    a: {x: c.cx, y: c.tagY, size: c.tagSize, w: wA},
    b: {x: b.x + wB / 2, y: b.y, size: h1, w: wB},
    pb: {x: 48 + wB / 2, y: l.hero.h1Y, size: h1, w: wB},
  };
}

export function CoverTagline({o, frame, mode}: {o: Ori; frame: number; mode: 'morph' | 'page'}) {
  const p = taglinePoses(o);
  const t = mode === 'page' ? 1 : ph(frame, 232, 92, 'SWEEP');
  const bx = mode === 'page' ? p.pb.x : p.b.x;
  const by = mode === 'page' ? p.pb.y : p.b.y;
  const x = p.a.x + (bx - p.a.x) * t;
  const y = p.a.y + (by - p.a.y) * t;
  const size = p.a.size + (p.b.size - p.a.size) * t;
  return (
    <FilmText x={x} y={y} spec="display" size={size} anchor="middle" fill={C.text}>
      {COPY.tagline}
    </FilmText>
  );
}

/* ── product layer: browser + persisting page ───────────────────────── */

function ProductLayer({o, frame}: {o: Ori; frame: number}) {
  const st = STAGE[o];
  const scroll = track(frame, o === 'h' ? SCROLL_H : SCROLL_V);
  const dim = 1 - ph(frame, EV.pullOut, 66, 'TUCK');
  if (dim <= 0.01) return null;
  const inE = ph(frame, EV.assemble, 36, 'GLIDE');
  const exit = ph(frame, EV.pageSwap, 26, 'TUCK');
  const enter = ph(frame, EV.pageSwap, 30, 'GLIDE');
  return (
    <g opacity={dim}>
      <g transform={`translate(${st.bf.x} ${st.bf.y})`} opacity={inE}>
        <Chrome o={o} frame={frame} w={st.bf.w} h={st.bf.h} />
        <g transform={`translate(0 ${st.chrome})`}>
          <clipPath id={`page-${o}`}>
            <rect x={0} y={0} width={st.pageW} height={st.pageH} />
          </clipPath>
          <g clipPath={`url(#page-${o})`}>
            <g transform={`translate(0 ${-scroll})`}>
              {frame < EV.pageSwap + 30 && (
                <g opacity={1 - exit} transform={`translate(0 ${-30 * exit})`}>
                  <HomeHero o={o} frame={frame} />
                  {frame >= 324 && <CoverTagline o={o} frame={frame} mode="page" />}
                </g>
              )}
              {frame >= EV.pageSwap && (
                <g opacity={enter} transform={`translate(0 ${(1 - enter) * 30})`}>
                  <ScanHead o={o} frame={frame} />
                  <Machine o={o} frame={frame} />
                  <ScanControls o={o} frame={frame} />
                  <Rows o={o} frame={frame} />
                  <Alloc o={o} frame={frame} />
                </g>
              )}
            </g>
            <g>
              <defs>
                <linearGradient id={`navshade-${o}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={C.bg} stopOpacity={0.97} />
                  <stop offset="0.62" stopColor={C.bg} stopOpacity={0.92} />
                  <stop offset="1" stopColor={C.bg} stopOpacity={0} />
                </linearGradient>
              </defs>
              <rect x={0} y={0} width={st.pageW} height={104} fill={`url(#navshade-${o})`} />
              <NavLinks o={o} frame={frame} />
            </g>
          </g>
        </g>
      </g>
    </g>
  );
}

/* ── outro: allocation card → final card, interface tiles → mark ────── */

/** Sparks leave from the allocation view exactly as the camera pulls out:
 * card edges, evidence panel, proof checks, chip and amount — everything
 * on screen at the pull-out frame. */
function tileSources(o: Ori): Array<{x: number; y: number}> {
  const l = lay(o);
  const c = l.alloc.card;
  const ev = l.alloc.ev;
  const pf = l.alloc.proof;
  return [
    {x: c.x + 20, y: c.y + 20}, {x: c.x + c.w - 20, y: c.y + 20},
    {x: c.x + 20, y: c.y + c.h - 20}, {x: c.x + c.w - 20, y: c.y + c.h - 20},
    {x: c.x + c.w / 2, y: c.y + 12}, {x: c.x + c.w / 2, y: c.y + c.h - 12},
    {x: c.x + 12, y: c.y + c.h / 2}, {x: c.x + c.w - 12, y: c.y + c.h / 2},
    {x: ev.x + 14, y: ev.y + 14}, {x: ev.x + ev.w - 14, y: ev.y + 14},
    {x: ev.x + 14, y: ev.y + ev.h - 14}, {x: ev.x + ev.w - 14, y: ev.y + ev.h - 14},
    {x: ev.x + ev.w / 2, y: ev.y + 12}, {x: ev.x + ev.w / 2, y: ev.y + ev.h - 12},
    {x: pf.x + 6, y: pf.r1 - 8}, {x: pf.x + 6, y: pf.r2 - 8}, {x: pf.x + 6, y: pf.r3 - 8},
    {x: pf.x + 260, y: pf.h2a - 6}, {x: pf.x + 260, y: pf.h2b - 6}, {x: pf.x + 200, y: pf.r2 - 8},
    {x: (o === 'h' ? 540 : 400), y: l.alloc.chip.y + 15}, {x: (o === 'h' ? 640 : 480), y: l.alloc.chip.y + 15},
    {x: c.x + 40, y: l.alloc.amountY - 14}, {x: c.x + 140, y: l.alloc.amountY - 14},
    {x: c.x + 40, y: l.alloc.eyebrowY - 4}, {x: c.x + 120, y: l.alloc.eyebrowY - 4},
  ];
}

function OutroLayer({o, frame}: {o: Ori; frame: number}) {
  if (frame < EV.pullOut) return null;
  const l = lay(o);
  const f = FINAL[o];
  const scrollAt = track(EV.pullOut, o === 'h' ? SCROLL_H : SCROLL_V);
  const t = ph(frame, EV.pullOut, 110, 'SWEEP');
  const src = p2w(o, l.alloc.card.x, l.alloc.card.y, scrollAt);
  const cardX = src.x + (CARD_DST[o].x - src.x) * t;
  const cardY = src.y + (CARD_DST[o].y - src.y) * t;
  const cardW = l.alloc.card.w + (CARD_DST[o].w - l.alloc.card.w) * t;
  const cardH = l.alloc.card.h + (CARD_DST[o].h - l.alloc.card.h) * t;
  const tt = ph(frame, EV.tilesFly, 132, 'SWEEP');
  const markOpacity = ph(frame, 1848, 36, 'GLIDE');
  const tileFade = 1 - ph(frame, 1858, 26, 'TUCK');
  const markLeft = f.cx - lockupWidth(f.markH) / 2;
  const markC = {x: markLeft + f.markH / 2, y: f.lockupY};
  const ms = f.markH / 109.7;
  const sources = tileSources(o);
  const wmH = f.markH * 0.42;
  const tw2 = measureTracked(COPY.tagline, 'sans800', f.tagSize, -0.03);
  return (
    <g>
      <Panel x={cardX} y={cardY} w={cardW} h={cardH} radius={r('xl')} fill={C.bgRaised} stroke={C.borderAccent} strokeWidth={1.8} opacity={t} />
      {tt > 0 &&
        tileFade > 0.01 &&
        MARK_TILES.map((mt, i) => {
          const s0 = sources[i % sources.length];
          const sw = p2w(o, s0.x, s0.y, scrollAt);
          const tx = markC.x + mt.tx * ms;
          const ty = markC.y + mt.ty * ms;
          const x = sw.x + (tx - sw.x) * tt;
          const y = sw.y + (ty - sw.y) * tt;
          const size = 16 + (mt.w * ms - 16) * tt;
          return (
            <rect
              key={i}
              x={-size / 2}
              y={-size / 2}
              width={size}
              height={size}
              rx={size * 0.28}
              fill={mt.fill}
              opacity={Math.min(1, tt * 5) * tileFade}
              transform={`translate(${x} ${y}) rotate(${mt.rot * (1 - tt)})`}
            />
          );
        })}
      <CullerMark x={markC.x} y={markC.y} height={f.markH} progress={1} opacity={markOpacity} />
      <CullerWordmark x={markLeft + f.markH + f.markH * 0.42} y={f.lockupY + wmH * 0.5} height={wmH} reveal={ph(frame, EV.wordmark, 48, 'GLIDE')} />
      <MaskReveal id={`tg2-${o}`} x={f.cx - tw2 / 2 - 8} y={f.tagY - f.tagSize} w={tw2 + 16} h={f.tagSize * 1.5} progress={ph(frame, EV.bell + 24, 30, 'GLIDE')} direction="up">
        <FilmText x={f.cx} y={f.tagY} spec="display" size={f.tagSize} anchor="middle" fill={C.text}>
          {COPY.tagline}
        </FilmText>
      </MaskReveal>
      <FilmText x={f.cx} y={f.triadY} spec="strong" size={o === 'h' ? 18 : 16} anchor="middle" fill={C.textSecondary} opacity={ph(frame, EV.triad, 22, 'GLIDE')} letterSpacing={0.02 * (o === 'h' ? 18 : 16)}>
        {COPY.outro.triad}
      </FilmText>
      <g opacity={ph(frame, EV.cta, 22, 'GLIDE')}>
        <rect x={f.cx - 100} y={f.ctaY - 27} width={200} height={54} rx={r('md')} fill={C.accent} />
        <FilmText x={f.cx} y={f.ctaY + 7} spec="strong" size={15} anchor="middle" fill={C.textOnAccent}>
          {COPY.outro.cta}
        </FilmText>
      </g>
      <MonoLabel x={f.cx} y={f.urlY} size={14} anchor="middle" fill={C.textMuted} opacity={ph(frame, EV.url, 22, 'GLIDE')}>
        {COPY.outro.url}
      </MonoLabel>
    </g>
  );
}

/* ── ambient depth layer ────────────────────────────────────────────── */

function Ambient({o}: {o: Ori}) {
  const st = STAGE[o];
  return (
    <g>
      <defs>
        <radialGradient id={`glowB-${o}`}>
          <stop offset="0%" stopColor={C.accent} stopOpacity={0.1} />
          <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`glowO-${o}`}>
          <stop offset="0%" stopColor={C.secondary} stopOpacity={0.07} />
          <stop offset="100%" stopColor={C.secondary} stopOpacity={0} />
        </radialGradient>
        <pattern id={`dots-${o}`} width={96} height={96} patternUnits="userSpaceOnUse">
          <circle cx={2} cy={2} r={1.3} fill={C.accentText} opacity={0.07} />
        </pattern>
      </defs>
      <rect x={-400} y={-400} width={st.w + 800} height={st.h + 800} fill={`url(#dots-${o})`} />
      <circle cx={st.w * 0.2} cy={st.h * 0.16} r={st.w * 0.34} fill={`url(#glowB-${o})`} />
      <circle cx={st.w * 0.84} cy={st.h * 0.86} r={st.w * 0.3} fill={`url(#glowO-${o})`} />
    </g>
  );
}

export function World({o, frame}: {o: Ori; frame: number}) {
  return (
    <g>
      <CamLayer o={o} frame={frame} depth={0.3}>
        <Ambient o={o} />
      </CamLayer>
      <CamLayer o={o} frame={frame} depth={1}>
        <ProductLayer o={o} frame={frame} />
        {frame < EV.pullOut && <CoverLockup o={o} frame={frame} />}
        {frame < 324 && <CoverTagline o={o} frame={frame} mode="morph" />}
        <OutroLayer o={o} frame={frame} />
        <Cursor o={o} frame={frame} />
        <Anchor o={o} frame={frame} />
      </CamLayer>
    </g>
  );
}
