/**
 * HIDDEN INVENTORY — the deep-space world of the v4 film.
 *
 * One continuous environment per orientation: a dark, almost infinite
 * digital space where forgotten wallet remnants float half-concealed.
 * A CULLER-blue signal travels it; what it touches becomes visible and
 * arranges with intention; the arrangement resolves into the one framed
 * glimpse of the real product, then into the mark itself.
 *
 * Everything is deterministic: object placements come from the fixture in
 * scenes/data.ts, every reveal/ignition frame from brand/timeline.ts, and
 * all motion from the shared curve vocabulary in lib/motion.ts.
 *
 * Restraint rules honoured here: no HUDs, no random UI cards, glow only
 * where light motivates it, orange reserved for the LEFTOVER and the
 * moments it marks.
 */
import {C, r, STROKE} from '../brand/tokens';
import {COPY} from '../brand/copy';
import {EV, FPS} from '../brand/timeline';
import {spring} from 'remotion';
import {STAGE, GLIMPSE, CLOSE, type Ori} from '../brand/stage';
import {ph, SPRING} from '../lib/motion';
import {measure, measureTracked} from '../brand/textMetrics';
import {FilmText, MonoLabel, MaskReveal} from '../components/primitives';
import {CullerMark, CullerWordmark, CullerLockup, lockupWidth} from '../components/brand';
import {MARK_TILES} from '../brand/logoGeometry';
import {HIDDEN, LEFTOVER, type HiddenObj} from '../scenes/data';

/* ── deterministic pseudo-random + small helpers ─────────────────────── */
const rnd = (i: number, salt = 1) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
type Pt = {x: number; y: number};
const mix = (a: Pt, b: Pt, t: number): Pt => ({x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t)});

/** Piecewise SWEEP path through keyed points. */
function pathAt(frame: number, keys: Array<{f: number; x: number; y: number}>): Pt {
  if (frame <= keys[0].f) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    if (frame <= keys[i + 1].f) {
      const t = ph(frame, keys[i].f, keys[i + 1].f - keys[i].f, 'SWEEP');
      return mix(keys[i], keys[i + 1], t);
    }
  }
  return keys[keys.length - 1];
}

const base = (o: Ori, nx: number, ny: number): Pt => {
  const st = STAGE[o];
  return {x: st.w * (0.5 + nx), y: st.h * (0.5 + ny)};
};

/** The constellation ring objects arrange into (intentional composition). */
function ringSlot(o: Ori, slot: number, n: number): Pt {
  const st = STAGE[o];
  const a = -Math.PI / 2 + (slot / n) * Math.PI * 2;
  const rx = o === 'h' ? st.w * 0.36 : st.w * 0.4;
  const ry = o === 'h' ? st.h * 0.34 : st.h * 0.3;
  return {x: st.w / 2 + Math.cos(a) * rx, y: st.h / 2 + Math.sin(a) * ry};
}

/** Perimeter lattice just outside the glimpse frame (clutter → clarity). */
function lattice(o: Ori, i: number, n: number): Pt {
  const g = GLIMPSE[o];
  const m = 34;
  const per = 2 * (g.w + 2 * m + g.h + 2 * m);
  let d = (i / n) * per;
  const w = g.w + 2 * m;
  const h = g.h + 2 * m;
  const x0 = g.x - m;
  const y0 = g.y - m;
  if (d < w) return {x: x0 + d, y: y0};
  d -= w;
  if (d < h) return {x: x0 + w, y: y0 + d};
  d -= h;
  if (d < w) return {x: x0 + w - d, y: y0 + h};
  d -= w;
  return {x: x0, y: y0 + h - d};
}

const revFrame = (obj: HiddenObj) => [EV.reveal1, EV.reveal2, EV.reveal3][obj.rev - 1] + (obj.slot % 4) * 6;
const ignFrame = (obj: HiddenObj) => [EV.ign1, EV.ign2, EV.ign3][obj.ign - 1] + (obj.slot % 3) * 8;

/** Where one hidden object is at a given frame (drift → ring → lattice). */
function objPos(o: Ori, obj: HiddenObj, frame: number): Pt {
  const i = obj.slot;
  const p0 = base(o, obj.nx, obj.ny);
  const drift = {
    x: p0.x + 7 * Math.sin(frame / 84 + i * 1.7),
    y: p0.y + 6 * Math.sin(frame / 96 + i * 2.3),
  };
  const a = ph(frame, EV.arrange, 96, 'SWEEP');
  const b = ph(frame, EV.planeForm, 120, 'SWEEP');
  return mix(mix(drift, ringSlot(o, obj.slot, HIDDEN.length + 1), a), lattice(o, i, HIDDEN.length), b);
}

/* ── the hidden objects ──────────────────────────────────────────────── */

function HiddenShape({o, obj, frame, near}: {o: Ori; obj: HiddenObj; frame: number; near: boolean}) {
  const rev = ph(frame, revFrame(obj), 48, 'GLIDE');
  if (rev <= 0.01) return null;
  const ig = ph(frame, ignFrame(obj), 30, 'GLIDE');
  const fade = 1 - ph(frame, EV.condense, 66, 'TUCK');
  if (fade <= 0.01) return null;
  const p = objPos(o, obj, frame);
  const pop = 1 + 0.07 * (1 - ph(frame, ignFrame(obj), 26, 'GLIDE'));
  const s = obj.s * pop * (near ? 1.15 : 1);
  const rim = ig > 0.02 ? C.accentText : C.borderStrong;
  const rimOp = 0.5 + 0.45 * ig;
  const u = 46 * s;
  return (
    <g opacity={rev * (0.78 + 0.22 * ig) * fade * (near ? 0.8 : 1)} transform={`translate(${p.x} ${p.y}) rotate(${obj.rot * (1 - ph(frame, EV.arrange, 96, 'SWEEP'))})`}>
      {ig > 0.02 && <circle r={u * 1.15} fill={C.accentSoft} opacity={0.5 * ig} />}
      {obj.kind === 'coin' && (
        <g>
          <circle r={u * 0.56} fill={C.surface} fillOpacity={0.55 + 0.45 * ig} stroke={rim} strokeOpacity={rimOp} strokeWidth={STROKE.hairline} />
          <circle r={u * 0.56} fill={C.bgRaised} opacity={ig} />
          <circle r={u * 0.36} fill="none" stroke={rim} strokeOpacity={rimOp * 0.6} strokeWidth={STROKE.hairline} />
        </g>
      )}
      {obj.kind === 'nft' && (
        <g>
          <rect x={-u * 0.46} y={-u * 0.56} width={u * 0.92} height={u * 1.12} rx={u * 0.18} fill={C.surface} fillOpacity={0.55 + 0.45 * ig} stroke={rim} strokeOpacity={rimOp} strokeWidth={STROKE.hairline} />
          <rect x={-u * 0.46} y={-u * 0.56} width={u * 0.92} height={u * 1.12} rx={u * 0.18} fill={C.bgRaised} opacity={ig} />
          <rect x={-u * 0.28} y={-u * 0.36} width={u * 0.56} height={u * 0.56} rx={u * 0.1} fill="none" stroke={rim} strokeOpacity={rimOp * 0.6} strokeWidth={STROKE.hairline} />
        </g>
      )}
      {obj.kind === 'empty' && (
        <rect x={-u * 0.44} y={-u * 0.44} width={u * 0.88} height={u * 0.88} rx={u * 0.24} fill="none" stroke={rim} strokeOpacity={rimOp * 0.8} strokeWidth={STROKE.hairline} strokeDasharray={`${u * 0.14} ${u * 0.12}`} />
      )}
      {obj.kind === 'shard' && (
        <g>
          <rect x={-u * 0.28} y={-u * 0.28} width={u * 0.56} height={u * 0.56} rx={u * 0.16} fill={C.surface} fillOpacity={0.55 + 0.45 * ig} stroke={rim} strokeOpacity={rimOp} strokeWidth={STROKE.hairline} />
          <rect x={-u * 0.28} y={-u * 0.28} width={u * 0.56} height={u * 0.56} rx={u * 0.16} fill={C.bgRaised} opacity={ig} />
        </g>
      )}
    </g>
  );
}

export function Field({o, frame, layer}: {o: Ori; frame: number; layer: number}) {
  return (
    <g>
      {HIDDEN.filter((h) => Math.abs(h.d - layer) < 0.2).map((obj) => (
        <HiddenShape key={obj.slot} o={o} obj={obj} frame={frame} near={layer > 1.2} />
      ))}
    </g>
  );
}

/* ── ambient depth: nebula, dust, vignette ───────────────────────────── */

export function Nebula({o, frame}: {o: Ori; frame: number}) {
  const st = STAGE[o];
  const dots = Array.from({length: 46}, (_, i) => ({
    x: rnd(i, 1) * st.w,
    y: rnd(i, 2) * st.h,
    r: 0.9 + rnd(i, 3) * 1.4,
    tw: 0.05 + 0.06 * (0.5 + 0.5 * Math.sin(frame / 26 + i * 1.3)),
    orange: i % 9 === 0,
  }));
  return (
    <g>
      <defs>
        <radialGradient id={`nebB-${o}`}>
          <stop offset="0%" stopColor={C.accent} stopOpacity={0.14} />
          <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`nebO-${o}`}>
          <stop offset="0%" stopColor={C.secondary} stopOpacity={0.08} />
          <stop offset="100%" stopColor={C.secondary} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`vig-${o}`}>
          <stop offset="55%" stopColor={C.bg} stopOpacity={0} />
          <stop offset="100%" stopColor={'#04060d'} stopOpacity={0.85} />
        </radialGradient>
      </defs>
      <circle cx={st.w * 0.24} cy={st.h * 0.2} r={st.w * 0.4} fill={`url(#nebB-${o})`} />
      <circle cx={st.w * 0.8} cy={st.h * 0.85} r={st.w * 0.34} fill={`url(#nebO-${o})`} />
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.orange ? C.secondary : C.accentText} opacity={d.orange ? d.tw * 0.7 : d.tw} />
      ))}
      <rect x={-400} y={-400} width={st.w + 800} height={st.h + 800} fill={`url(#vig-${o})`} />
    </g>
  );
}

/** Near-camera fragments that cross the lens at the dive and signal entry. */
export function Foreground({o, frame}: {o: Ori; frame: number}) {
  const st = STAGE[o];
  const cross = (f0: number, f1: number, y: number, size: number, salt: number) => {
    const t = ph(frame, f0, f1 - f0, 'SWEEP');
    if (t <= 0 || t >= 1) return null;
    const x = lerp(-size * 2, st.w + size * 2, t);
    const op = Math.sin(t * Math.PI) * 0.4;
    return (
      <rect x={-size / 2} y={-size / 2} width={size} height={size} rx={size * 0.28} fill={C.bgRaised} stroke={C.borderStrong} strokeOpacity={0.5} strokeWidth={STROKE.hairline} opacity={op} transform={`translate(${x} ${y}) rotate(${20 + salt * 30 + t * 40})`} />
    );
  };
  return (
    <g>
      {cross(EV.dive, EV.dive + 90, st.h * 0.3, 150, rnd(1))}
      {cross(EV.dive + 14, EV.dive + 104, st.h * 0.74, 110, rnd(2))}
      {cross(EV.signalEnter, EV.signalEnter + 110, st.h * 0.22, 130, rnd(3))}
      {cross(EV.glimpseOut, EV.glimpseOut + 90, st.h * 0.8, 120, rnd(4))}
    </g>
  );
}

/* ── the signal ──────────────────────────────────────────────────────── */

export function Signal({o, frame}: {o: Ori; frame: number}) {
  const st = STAGE[o];
  // opening: a small unmistakable blue signal, far away
  const ignite = ph(frame, EV.signalIgnite, 40, 'GLIDE');
  const travel = ph(frame, EV.travel, 130, 'SWEEP');
  const openFade = 1 - ph(frame, EV.dive - 24, 40, 'TUCK');
  // the pass: the signal moves through the field, revealing as it goes
  const inOp = ph(frame, EV.signalEnter, 30, 'GLIDE') * (1 - ph(frame, EV.planeForm - 12, 60, 'TUCK'));
  const p = pathAt(frame, [
    {f: EV.signalEnter, x: -160, y: st.h * 0.62},
    {f: EV.signalEnter + 120, x: st.w * 0.3, y: st.h * 0.44},
    {f: EV.signalEnter + 240, x: st.w * 0.62, y: st.h * 0.56},
    {f: EV.signalEnter + 360, x: st.w * 0.92, y: st.h * 0.4},
  ]);
  const q = pathAt(frame - 14, [
    {f: EV.signalEnter, x: -160, y: st.h * 0.62},
    {f: EV.signalEnter + 120, x: st.w * 0.3, y: st.h * 0.44},
    {f: EV.signalEnter + 240, x: st.w * 0.62, y: st.h * 0.56},
    {f: EV.signalEnter + 360, x: st.w * 0.92, y: st.h * 0.4},
  ]);
  const sx = lerp(st.w * 0.66, st.w * 0.18, travel);
  const sy = lerp(st.h * 0.38, st.h * 0.54, travel);
  return (
    <g>
      <defs>
        <radialGradient id={`sig-${o}`}>
          <stop offset="0%" stopColor={C.accentText} stopOpacity={0.5} />
          <stop offset="45%" stopColor={C.accent} stopOpacity={0.16} />
          <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
        </radialGradient>
      </defs>
      {openFade > 0.01 && (
        <g opacity={openFade}>
          <circle cx={sx} cy={sy} r={54 * ignite} fill={`url(#sig-${o})`} />
          <circle cx={sx} cy={sy} r={3.2} fill={C.accentText} opacity={ignite} />
          {travel > 0.02 && travel < 0.98 && (
            <line x1={sx} y1={sy} x2={lerp(st.w * 0.66, st.w * 0.18, Math.max(0, travel - 0.22))} y2={lerp(st.h * 0.38, st.h * 0.54, Math.max(0, travel - 0.22))} stroke={C.accentText} strokeOpacity={0.35 * (1 - travel)} strokeWidth={2} strokeLinecap="round" />
          )}
        </g>
      )}
      {inOp > 0.01 && frame >= EV.signalEnter && (
        <g opacity={inOp}>
          <line x1={q.x} y1={q.y} x2={p.x} y2={p.y} stroke={C.accentText} strokeOpacity={0.4} strokeWidth={2.4} strokeLinecap="round" />
          <line x1={lerp(q.x, p.x, 0.5)} y1={lerp(q.y, p.y, 0.5)} x2={p.x} y2={p.y} stroke={C.accentTextHover} strokeOpacity={0.5} strokeWidth={1.4} strokeLinecap="round" />
          <circle cx={p.x} cy={p.y} r={64} fill={`url(#sig-${o})`} />
          <circle cx={p.x} cy={p.y} r={5} fill={C.accentTextHover} />
          <circle cx={q.x} cy={q.y} r={2.2} fill={C.accentText} opacity={0.5} />
        </g>
      )}
    </g>
  );
}

/* ── scene 1 type: the line, art-directed into the dark ──────────────── */

export function OpenLine({o, frame}: {o: Ori; frame: number}) {
  const st = STAGE[o];
  const size = o === 'h' ? 92 : 54;
  const w = measureTracked(COPY.open.line, 'sans800', size, -0.02);
  const x = o === 'h' ? st.w * 0.08 : (st.w - w) / 2;
  const y = o === 'h' ? st.h * 0.52 : st.h * 0.46;
  const sweep = ph(frame, EV.lineIn, 120, 'SWEEP');
  const out = 1 - ph(frame, EV.dive, 40, 'TUCK');
  if (out <= 0.01 || sweep <= 0.001) return null;
  const grow = 1 + 0.1 * ph(frame, EV.dive, 60, 'SWEEP');
  const pop = spring({frame: Math.max(0, frame - EV.periodLand), fps: FPS, config: SPRING.pop});
  const ps = size * 0.3 * Math.min(1, pop);
  return (
    <g opacity={out} transform={`translate(${st.w / 2} ${y}) scale(${grow}) translate(${-st.w / 2} ${-y})`}>
      <MaskReveal id={`open-${o}`} x={x - 8} y={y - size} w={w + 60} h={size * 1.5} progress={sweep} direction="right">
        <FilmText x={x} y={y} spec="display" size={size} fill={C.text} letterSpacing={-0.02 * size}>
          {COPY.open.line}
        </FilmText>
      </MaskReveal>
      {sweep > 0.02 && sweep < 0.98 && (
        <rect x={x + sweep * (w + 40) - 23} y={y - size} width={46} height={size * 1.4} fill={C.accentText} opacity={0.1} />
      )}
      {pop > 0.01 && (
        <rect x={x + w + size * 0.16} y={y - size * 0.34 - ps / 2} width={ps} height={ps} rx={ps * 0.3} fill={C.secondary} opacity={Math.min(1, pop * 2)} />
      )}
    </g>
  );
}

/* ── scene 4: the one framed glimpse of the real product ─────────────── */

export function Glimpse({o, frame}: {o: Ori; frame: number}) {
  const g = GLIMPSE[o];
  const inE = ph(frame, EV.glimpseIn, 48, 'SOFT');
  const out = 1 - ph(frame, EV.glimpseOut, 48, 'TUCK');
  const op = Math.min(inE, out);
  if (op <= 0.01) return null;
  const sc = 0.96 + 0.04 * inE + 0.05 * (1 - out);
  const sweepT = ph(frame, EV.sweep, 66, 'SWEEP');
  const chrome = 44;
  const nav = ['Home', 'Scan', 'Watch', 'Rewards'];
  let nx = g.x + g.w - 40;
  const navItems = nav
    .slice()
    .reverse()
    .map((t) => {
      const w = measure(t, 'sans500', 13);
      const pos = {t, x: nx - w};
      nx -= w + 26;
      return pos;
    });
  return (
    <g opacity={op} transform={`translate(${g.x + g.w / 2} ${g.y + g.h / 2}) scale(${sc}) translate(${-(g.x + g.w / 2)} ${-(g.y + g.h / 2)})`}>
      <defs>
        <clipPath id={`gl-${o}`}>
          <rect x={g.x} y={g.y} width={g.w} height={g.h} rx={r('lg')} />
        </clipPath>
        <linearGradient id={`glass-${o}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={C.accentText} stopOpacity={0.16} />
          <stop offset="55%" stopColor={C.accentText} stopOpacity={0.02} />
          <stop offset="100%" stopColor={C.accentText} stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={g.x} y={g.y + 14} width={g.w} height={g.h} rx={r('lg')} fill={'#04060d'} opacity={0.55} />
      <rect x={g.x} y={g.y} width={g.w} height={g.h} rx={r('lg')} fill={C.bg} stroke={C.borderStrong} strokeWidth={1.8} />
      <g clipPath={`url(#gl-${o})`}>
        <rect x={g.x} y={g.y} width={g.w} height={chrome} fill={C.bgRaised} />
        <circle cx={g.x + 26} cy={g.y + 22} r={5} fill={C.surfaceHover} />
        <circle cx={g.x + 46} cy={g.y + 22} r={5} fill={C.surfaceHover} />
        <circle cx={g.x + 66} cy={g.y + 22} r={5} fill={C.surfaceHover} />
        <rect x={g.x + g.w / 2 - 170} y={g.y + 10} width={340} height={24} rx={12} fill={C.surfaceSunken} stroke={C.border} strokeWidth={1.2} />
        <MonoLabel x={g.x + g.w / 2} y={g.y + 26} size={12} anchor="middle" fill={C.textSecondary} tracking={0.04}>
          {COPY.url}
        </MonoLabel>
        <line x1={g.x} y1={g.y + chrome} x2={g.x + g.w} y2={g.y + chrome} stroke={C.border} strokeWidth={1.2} />
        {/* the real home hero, at rest — no cursor, no clicks */}
        <CullerLockup x={g.x + 44} y={g.y + chrome + 52} markHeight={o === 'h' ? 26 : 22} />
        {o === 'h' &&
          navItems.map((it) => (
            <FilmText key={it.t} x={it.x} y={g.y + chrome + 52} spec="body" size={13} fill={it.t === 'Home' ? C.text : C.textMuted}>
              {it.t}
            </FilmText>
          ))}
        <FilmText x={g.x + 48} y={g.y + (o === 'h' ? 250 : 220)} spec="display" size={o === 'h' ? 52 : 38} fill={C.text}>
          {COPY.tagline}
        </FilmText>
        <FilmText x={g.x + 48} y={g.y + (o === 'h' ? 300 : 264)} spec="body" size={o === 'h' ? 16 : 14} fill={C.textSecondary}>
          {COPY.home.sub1}
        </FilmText>
        <FilmText x={g.x + 48} y={g.y + (o === 'h' ? 328 : 288)} spec="body" size={o === 'h' ? 16 : 14} fill={C.textSecondary}>
          {COPY.home.sub2}
        </FilmText>
        <rect x={g.x + 48} y={g.y + (o === 'h' ? 380 : 330)} width={o === 'h' ? 200 : 180} height={52} rx={r('md')} fill={C.secondary} />
        <FilmText x={g.x + 48 + (o === 'h' ? 100 : 90)} y={g.y + (o === 'h' ? 412 : 362)} spec="strong" size={15} anchor="middle" fill={C.textOnSecondary}>
          {COPY.home.cta}
        </FilmText>
        <rect x={g.x + (o === 'h' ? 264 : 244)} y={g.y + (o === 'h' ? 380 : 330)} width={o === 'h' ? 168 : 150} height={52} rx={r('md')} fill="none" stroke={C.borderStrong} strokeWidth={1.6} />
        <FilmText x={g.x + (o === 'h' ? 348 : 319)} y={g.y + (o === 'h' ? 412 : 362)} spec="strong" size={15} anchor="middle" fill={C.textSecondary}>
          {COPY.home.ghost}
        </FilmText>
        <rect x={g.x + 48} y={g.y + (o === 'h' ? 464 : 408)} width={o === 'h' ? 452 : 400} height={38} rx={19} fill={C.bgRaised} stroke={C.border} strokeWidth={1.4} />
        <rect x={g.x + 62} y={g.y + (o === 'h' ? 475 : 419)} width={16} height={16} rx={5} fill={C.secondarySoftStrong} />
        <FilmText x={g.x + 70} y={g.y + (o === 'h' ? 487 : 431)} spec="strong" size={11} anchor="middle" fill={C.secondary}>
          !
        </FilmText>
        <FilmText x={g.x + 88} y={g.y + (o === 'h' ? 488 : 432)} spec="body" size={13} fill={C.textSecondary}>
          {COPY.home.notice}
        </FilmText>
        {/* light sweep across the glass */}
        {sweepT > 0.01 && sweepT < 0.99 && (
          <rect x={g.x - 240 + sweepT * (g.w + 480)} y={g.y - 60} width={150} height={g.h + 120} fill={`url(#glass-${o})`} transform={`rotate(-14 ${g.x + g.w / 2} ${g.y + g.h / 2})`} opacity={0.9} />
        )}
      </g>
    </g>
  );
}

/* ── scene 5: everything condenses into the mark ─────────────────────── */

export function Condense({o, frame}: {o: Ori; frame: number}) {
  if (frame < EV.condense) return null;
  const cl = CLOSE[o];
  const tt = ph(frame, EV.condense, 132, 'SWEEP');
  const tileFade = 1 - ph(frame, EV.markSettle - 12, 26, 'TUCK');
  if (tileFade <= 0.01) return null;
  const markLeft = cl.cx - lockupWidth(cl.markH) / 2;
  const markC = {x: markLeft + cl.markH / 2, y: cl.markY};
  const ms = cl.markH / 109.7;
  const n = HIDDEN.length;
  const sources = Array.from({length: n + 6}, (_, i) => (i < n ? lattice(o, i, n) : {x: GLIMPSE[o].x + ((i - n) / 5) * GLIMPSE[o].w, y: GLIMPSE[o].y + (i % 2) * GLIMPSE[o].h}));
  return (
    <g>
      {MARK_TILES.map((mt, i) => {
        const s0 = sources[i % sources.length];
        const tx = markC.x + mt.tx * ms;
        const ty = markC.y + mt.ty * ms;
        const x = lerp(s0.x, tx, tt);
        const y = lerp(s0.y, ty, tt);
        const size = 16 + (mt.w * ms - 16) * tt;
        return (
          <rect key={i} x={-size / 2} y={-size / 2} width={size} height={size} rx={size * 0.28} fill={mt.fill} opacity={Math.min(1, tt * 5) * tileFade} transform={`translate(${x} ${y}) rotate(${mt.rot * (1 - tt)})`} />
        );
      })}
    </g>
  );
}

/* ── scene 5–6: the mark, the wordmark, the close copy ───────────────── */

export function Close({o, frame}: {o: Ori; frame: number}) {
  const cl = CLOSE[o];
  const markOp = ph(frame, EV.markSettle - 24, 44, 'GLIDE');
  const wm = ph(frame, EV.wordmark, 48, 'GLIDE');
  const tag = ph(frame, EV.tagline, 30, 'GLIDE');
  const url = ph(frame, EV.url, 24, 'GLIDE');
  const markLeft = cl.cx - lockupWidth(cl.markH) / 2;
  const wmH = cl.markH * 0.42;
  const tw = measureTracked(COPY.close.tagline, 'sans800', cl.tagSize, -0.02);
  return (
    <g>
      {markOp > 0.01 && <CullerMark x={markLeft + cl.markH / 2} y={cl.markY} height={cl.markH} progress={1} opacity={markOp} />}
      {wm > 0.01 && <CullerWordmark x={markLeft + cl.markH + cl.markH * 0.42} y={cl.markY + wmH * 0.5} height={wmH} reveal={wm} />}
      {tag > 0.01 && (
        <MaskReveal id={`close-${o}`} x={cl.cx - tw / 2 - 8} y={cl.tagY - cl.tagSize} w={tw + 16} h={cl.tagSize * 1.5} progress={tag} direction="up">
          <FilmText x={cl.cx} y={cl.tagY} spec="display" size={cl.tagSize} anchor="middle" fill={C.text} letterSpacing={-0.02 * cl.tagSize}>
            {COPY.close.tagline}
          </FilmText>
        </MaskReveal>
      )}
      {url > 0.01 && (
        <MonoLabel x={cl.cx} y={cl.urlY} size={14} anchor="middle" fill={C.textMuted} opacity={url} tracking={0.06}>
          {COPY.outro.url}
        </MonoLabel>
      )}
    </g>
  );
}

/* ── the LEFTOVER: one orange fragment, the protagonist object ───────── */

export function Leftover({o, frame}: {o: Ori; frame: number}) {
  const cl = CLOSE[o];
  if (frame < EV.glint) return null;
  const glint = ph(frame, EV.glint, 20, 'GLIDE') * (1 - ph(frame, EV.glint + 40, 30, 'TUCK'));
  const born = ph(frame, EV.glint + 40, 40, 'GLIDE');
  const ignite = spring({frame: Math.max(0, frame - EV.orangeIgnite), fps: FPS, config: SPRING.pop});
  const tw = measureTracked(COPY.close.tagline, 'sans800', cl.tagSize, -0.02);
  const period = {x: cl.cx + tw / 2 + cl.tagSize * 0.26, y: cl.tagY - cl.tagSize * 0.34};
  const hover = {x: cl.cx + tw / 2 + cl.tagSize * 0.26 + 26, y: cl.tagY - cl.tagSize * 0.34 - 34};
  const p0 = base(o, LEFTOVER.nx, LEFTOVER.ny);
  const ring = ringSlot(o, HIDDEN.length, HIDDEN.length + 1);
  const g = GLIMPSE[o];
  const corner = {x: g.x + g.w - 64, y: g.y - 40};
  let p: Pt = p0;
  const a = ph(frame, EV.arrange, 96, 'SWEEP');
  const b = ph(frame, EV.planeForm, 120, 'SWEEP');
  const c = ph(frame, EV.condense, 132, 'SWEEP');
  const d = ph(frame, EV.periodLand2 - 24, 24, 'SWEEP');
  p = mix(p, ring, a);
  p = mix(p, corner, b);
  p = mix(p, hover, c);
  p = mix(p, period, d);
  const drift = {x: p.x + 4 * Math.sin(frame / 70), y: p.y + 3 * Math.sin(frame / 82)};
  const settled = d > 0.99;
  const pos = settled ? period : drift;
  const size = 22 * (0.8 + 0.2 * born) * (ignite > 0 ? 1 + 0.12 * (1 - Math.min(1, ignite)) : 1);
  const op = Math.max(glint, born * 0.95);
  return (
    <g opacity={op}>
      {glint > 0.02 && (
        <g opacity={glint} transform={`translate(${p0.x} ${p0.y})`}>
          <line x1={-26} y1={0} x2={26} y2={0} stroke={C.secondary} strokeWidth={1.6} strokeLinecap="round" />
          <line x1={0} y1={-26} x2={0} y2={26} stroke={C.secondary} strokeWidth={1.6} strokeLinecap="round" />
          <circle r={3.4} fill={C.secondary} />
        </g>
      )}
      {born > 0.02 && (
        <g transform={`translate(${pos.x} ${pos.y}) rotate(${LEFTOVER.rot * (1 - a)})`}>
          <circle r={size * 1.5} fill={C.secondarySoft} opacity={0.6 * (1 - d) + 0.18} />
          <rect x={-size / 2} y={-size / 2} width={size} height={size} rx={size * 0.3} fill={C.secondary} />
        </g>
      )}
    </g>
  );
}
