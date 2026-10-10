/**
 * THE LEFTOVER — one rounded square with the exact geometry of the C-mark's
 * tiles, in the product's orange. It is pushed out of the mark in the opening,
 * becomes the tagline's square period, lifts off as the cursor's focus ring,
 * rides the CullMachine wires as the live dot, draws the selection frame around
 * the focused result, lands as the recorded dot on the proof row, and returns
 * home as the square period of the final tagline. One object, six jobs.
 *
 * The authentic logo is never modified: the leftover is always an extra
 * element travelling beside it.
 */
import {C} from '../brand/tokens';
import {COPY} from '../brand/copy';
import {EV, SCROLL_H, SCROLL_V} from '../brand/timeline';
import {COVER, FINAL, STAGE, p2w, type Ori} from '../brand/stage';
import {measureTracked} from '../brand/textMetrics';
import {lockupWidth} from './brand';
import {L, proofRow3End} from './product';
import {FOCUS_ROW} from '../scenes/data';
import {ph, track} from '../lib/motion';

const sq = (size: number) => size * 0.3;

function periodPos(o: Ori, final = false) {
  const c = final ? FINAL[o] : COVER[o];
  const tw = measureTracked(COPY.tagline, 'sans800', c.tagSize, -0.03);
  return {x: c.cx + tw / 2 + c.tagSize * 0.26, y: c.tagY - c.tagSize * 0.34, size: c.tagSize * 0.3};
}

function markGap(o: Ori) {
  const c = COVER[o];
  const lw = lockupWidth(c.markH);
  const left = c.cx - lw / 2;
  return {x: left + c.markH * 0.98, y: c.lockupY};
}

function ctaCenter(o: Ori) {
  const c = (L[o] as (typeof L)['h']).hero.cta;
  return p2w(o, c.x + c.w / 2, c.y + c.h / 2, 0);
}

function machineHeads(o: Ori) {
  const m = (L[o] as (typeof L)['h']).machine;
  return m.nodes.map((n) => p2w(o, n.x + 18, n.y + 22, 0));
}

function rowRect(o: Ori, frame: number) {
  const s = STAGE[o];
  const rw = (L[o] as (typeof L)['h']).rows;
  const scroll = track(frame, o === 'h' ? SCROLL_H : SCROLL_V);
  const y = rw.y0 + FOCUS_ROW * (rw.rowH + rw.gap);
  return {x: s.bf.x + rw.x, y: s.bf.y + s.chrome + y - scroll, w: rw.w, h: rw.rowH};
}

function recordDot(o: Ori, frame: number) {
  const s = STAGE[o];
  const a = (L[o] as (typeof L)['h']).alloc;
  const scroll = track(frame, o === 'h' ? SCROLL_H : SCROLL_V);
  return {x: s.bf.x + proofRow3End(o), y: s.bf.y + s.chrome + a.proof.r3 - 4 - scroll};
}

const cursorKeys = {
  h: [
    {f: 380, x: 1780, y: 700},
    {f: 430, x: 1100, y: 690},
    {f: 468, x: 0, y: 0}, // replaced by cta centre below
    {f: 504, x: 0, y: 0},
  ],
  v: [
    {f: 380, x: 1000, y: 1400},
    {f: 430, x: 640, y: 1060},
    {f: 468, x: 0, y: 0},
    {f: 504, x: 0, y: 0},
  ],
};

export function cursorPos(o: Ori, frame: number) {
  const c = ctaCenter(o);
  const keys = cursorKeys[o].map((k) => (k.f >= 468 ? {...k, x: c.x + 4, y: c.y + 6} : k));
  let x = keys[0].x;
  let y = keys[0].y;
  for (let i = 0; i < keys.length - 1; i++) {
    if (frame <= keys[i + 1].f) {
      const t = ph(frame, keys[i].f, keys[i + 1].f - keys[i].f, 'SWEEP');
      x = keys[i].x + (keys[i + 1].x - keys[i].x) * t;
      y = keys[i].y + (keys[i + 1].y - keys[i].y) * t;
      return {x, y};
    }
  }
  return {x: keys[keys.length - 1].x, y: keys[keys.length - 1].y};
}

export function Cursor({o, frame}: {o: Ori; frame: number}) {
  const opIn = ph(frame, EV.cursorIn, 16, 'GLIDE');
  const opOut = 1 - ph(frame, EV.pageSwap, 24, 'TUCK');
  const op = Math.min(opIn, opOut);
  if (op <= 0.01 || frame > EV.pageSwap + 30) return null;
  const p = cursorPos(o, frame);
  return (
    <g opacity={op} transform={`translate(${p.x} ${p.y})`}>
      <path d="M 0 0 L 13 32 L 19 21 L 31 15 Z" fill={C.paper} stroke={C.bg} strokeWidth={2} transform="rotate(-10)" />
    </g>
  );
}

interface AnchorState {
  mode: 'tile' | 'period' | 'ring' | 'dot' | 'frame' | 'none';
  x: number;
  y: number;
  size: number;
  op: number;
  draw?: number;
}

export function anchorState(o: Ori, frame: number): AnchorState {
  const p1 = periodPos(o);
  const gap = markGap(o);
  const cta = ctaCenter(o);
  const heads = machineHeads(o);
  const rr = rowRect(o, frame);
  const rec = recordDot(o, frame);
  const p2 = periodPos(o, true);
  const none: AnchorState = {mode: 'none', x: 0, y: 0, size: 0, op: 0};

  if (frame < EV.leftoverPop) return none;
  if (frame < EV.periodLand) {
    const t = ph(frame, EV.leftoverPop, EV.periodLand - EV.leftoverPop, 'SWEEP');
    const mx = gap.x + (p1.x - gap.x) * t;
    const my = gap.y + (p1.y - gap.y) * t - Math.sin(t * Math.PI) * 90;
    return {mode: 'tile', x: mx, y: my, size: 26 + (p1.size - 26) * t, op: Math.min(1, t * 6)};
  }
  if (frame < EV.assemble) return {mode: 'period', x: p1.x, y: p1.y, size: p1.size, op: 1};
  if (frame < EV.cursorIn) {
    const t = ph(frame, 336, EV.cursorIn - 336, 'SWEEP');
    const c = cursorPos(o, EV.cursorIn);
    return {mode: 'ring', x: p1.x + (c.x - p1.x) * t, y: p1.y + (c.y - p1.y) * t, size: p1.size + (34 - p1.size) * t, op: 1};
  }
  if (frame < EV.ctaPress) {
    const c = cursorPos(o, frame);
    return {mode: 'ring', x: c.x, y: c.y, size: 34, op: 1};
  }
  if (frame < EV.consoleFrame) {
    const t = ph(frame, EV.ctaPress, EV.consoleFrame - EV.ctaPress, 'GLIDE');
    return {mode: 'ring', x: cta.x, y: cta.y, size: 34 + 18 * t, op: 1 - t};
  }
  if (frame < EV.scanOnset) return none;
  if (frame < EV.figure) {
    const keys = [
      {f: EV.scanOnset, ...heads[0]},
      {f: EV.wire2 - 36, ...heads[1]},
      {f: EV.wire2, ...heads[1]},
      {f: EV.wire3 - 36, ...heads[2]},
      {f: EV.wire3, ...heads[2]},
      {f: EV.figure - 18, ...heads[3]},
    ];
    let x = keys[0].x;
    let y = keys[0].y;
    for (let i = 0; i < keys.length - 1; i++) {
      if (frame <= keys[i + 1].f) {
        const t = ph(frame, keys[i].f, keys[i + 1].f - keys[i].f, 'SWEEP');
        x = keys[i].x + (keys[i + 1].x - keys[i].x) * t;
        y = keys[i].y + (keys[i + 1].y - keys[i].y) * t;
        break;
      }
      x = keys[i + 1].x;
      y = keys[i + 1].y;
    }
    return {mode: 'dot', x, y, size: 11, op: Math.min(1, ph(frame, EV.scanOnset, 12, 'GLIDE') * 1)};
  }
  if (frame < EV.focusPush) return {mode: 'none', x: 0, y: 0, size: 0, op: 1 - ph(frame, EV.figure, 16, 'TUCK')};
  if (frame < EV.allocResolve) {
    const draw = ph(frame, EV.selectDraw, 26, 'GLIDE');
    return {mode: 'frame', x: rr.x, y: rr.y, size: 0, op: 1, draw};
  }
  if (frame < EV.recordLand - 18) {
    const fade = ph(frame, EV.allocResolve, 16, 'TUCK');
    return {mode: 'frame', x: rr.x, y: rr.y, size: 0, op: 1 - fade, draw: 1};
  }
  if (frame < EV.pullOut) {
    const dr = ph(frame, EV.recordLand - 18, 14, 'GLIDE');
    return {mode: 'dot', x: rec.x, y: rec.y - 16 * (1 - dr), size: 11, op: dr};
  }
  if (frame < EV.periodLand2) {
    const t = ph(frame, EV.pullOut + 12, EV.periodLand2 - EV.pullOut - 12, 'SWEEP');
    const mx = rec.x + (p2.x - rec.x) * t;
    const my = rec.y + (p2.y - rec.y) * t - Math.sin(t * Math.PI) * 120;
    return {mode: t > 0.92 ? 'period' : 'dot', x: mx, y: my, size: 11 + (p2.size - 11) * t, op: 1};
  }
  return {mode: 'period', x: p2.x, y: p2.y, size: p2.size, op: 1};
}

export function Anchor({o, frame}: {o: Ori; frame: number}) {
  const a = anchorState(o, frame);
  if (a.mode === 'none' || a.op <= 0.01) return null;
  if (a.mode === 'frame') {
    const d = a.draw ?? 1;
    const per = 2 * (rr0(o, frame).w + rr0(o, frame).h);
    const R = rr0(o, frame);
    return (
      <rect
        x={R.x - 6}
        y={R.y - 6}
        width={R.w + 12}
        height={R.h + 12}
        rx={18}
        fill="none"
        stroke={C.secondary}
        strokeWidth={2.6}
        strokeDasharray={per}
        strokeDashoffset={per * (1 - d)}
        opacity={a.op}
      />
    );
  }
  if (a.mode === 'dot') {
    return (
      <g opacity={a.op}>
        <circle cx={a.x} cy={a.y} r={a.size * 2.1} fill={C.secondarySoft} />
        <circle cx={a.x} cy={a.y} r={a.size / 2} fill={C.secondary} />
      </g>
    );
  }
  if (a.mode === 'ring') {
    return (
      <rect x={a.x - a.size / 2} y={a.y - a.size / 2} width={a.size} height={a.size} rx={sq(a.size)} fill="none" stroke={C.secondary} strokeWidth={2.4} opacity={a.op} />
    );
  }
  // tile / period
  const filled = a.mode === 'period';
  return (
    <rect
      x={a.x - a.size / 2}
      y={a.y - a.size / 2}
      width={a.size}
      height={a.size}
      rx={sq(a.size)}
      fill={filled ? C.secondary : C.secondarySoftStrong}
      stroke={C.secondary}
      strokeWidth={filled ? 0 : 2.4}
      opacity={a.op}
    />
  );
}

const rr0 = (o: Ori, frame: number) => rowRect(o, frame);
export {periodPos, markGap, ctaCenter, recordDot};
