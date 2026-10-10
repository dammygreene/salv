/**
 * Faithful SVG recreations of the real CULLER interface (home hero, /scan
 * console with the CullMachine node flow, asset rows, allocation record),
 * drawn in "page space" inside a browser frame. Copy is verbatim from
 * src/app/page.tsx and src/app/scan/page.tsx; geometry follows tokens.css
 * surfaces, radii and stroke weights. No invented controls, no fake data
 * beyond the labelled illustrative fixture.
 */
import {C, STROKE, r, STATUS_COLOR} from '../brand/tokens';
import {COPY} from '../brand/copy';
import {EV} from '../brand/timeline';
import {measure, measureTracked} from '../brand/textMetrics';
import {FilmText, MonoLabel, MaskReveal, Panel, StatusPill, statusPillWidth} from './primitives';
import {AssetIcon} from './assets';
import {ROWS, FIX, FOCUS_ROW} from '../scenes/data';
import {STATUS_COLOR as _SC} from '../brand/tokens';
import {ph} from '../lib/motion';
import type {Ori} from '../brand/stage';

/* ── page-space layouts ─────────────────────────────────────────────── */

export const L = {
  h: {
    pageW: 1260,
    nav: {y: 76, linkSize: 13},
    hero: {h1Y: 300, sub1Y: 356, sub2Y: 384, cta: {x: 48, y: 452, w: 200, h: 54}, ghost: {x: 264, y: 452, w: 168, h: 54}, noticeY: 560},
    head: {titleY: 104, sup1Y: 138, sup2Y: 160, metaY: 100},
    machine: {x: 48, y: 240, w: 640, h: 250, nodes: [70, 224, 378, 532].map((x) => ({x, y: 276, w: 130, h: 120})), wireY: 336, wireX: 368},
    form: {x: 740, h2Y: 262, p1Y: 294, p2Y: 316, l1Y: 356, in1: {x: 740, y: 368, w: 440, h: 44}, l2Y: 436, in2: {x: 740, y: 448, w: 440, h: 44}, btn: {x: 740, y: 520, w: 150, h: 44}, n1Y: 592, n2Y: 612},
    rows: {eyebrowY: 900, strongY: 928, s1Y: 958, s2Y: 980, y0: 1010, rowH: 96, gap: 14, x: 48, w: 1164},
    alloc: {eyebrowY: 1700, h2Y: 1744, amountY: 1810, chip: {x: 320, y: 1778}, pY: 1848, noteY: 1872, illY: 1896, ev: {x: 48, y: 1930, w: 560, h: 150}, proof: {x: 660, h2a: 1962, h2b: 1990, r1: 2034, r2: 2064, r3: 2094}, card: {x: 48, y: 1676, w: 1164, h: 240}},
  },
  v: {
    pageW: 940,
    nav: {y: 68, linkSize: 12},
    hero: {h1Y: 262, sub1Y: 310, sub2Y: 336, cta: {x: 36, y: 400, w: 190, h: 50}, ghost: {x: 242, y: 400, w: 150, h: 50}, noticeY: 486},
    head: {titleY: 100, sup1Y: 130, sup2Y: 152, metaY: 178},
    machine: {x: 36, y: 210, w: 868, h: 420, nodes: [232, 324, 416, 508].map((y) => ({x: 56, y, w: 380, h: 80})), wireX: 246},
    form: {x: 36, h2Y: 664, p1Y: 692, p2Y: 712, l1Y: 748, in1: {x: 36, y: 760, w: 600, h: 40}, l2Y: 816, in2: {x: 36, y: 828, w: 600, h: 40}, btn: {x: 36, y: 884, w: 140, h: 40}, n1Y: 940, n2Y: 958},
    rows: {eyebrowY: 1050, strongY: 1078, s1Y: 1106, s2Y: 1126, y0: 1150, rowH: 108, gap: 12, x: 36, w: 868},
    alloc: {eyebrowY: 1980, h2Y: 2020, amountY: 2078, chip: {x: 300, y: 2050}, pY: 2116, noteY: 2138, illY: 2160, ev: {x: 36, y: 2196, w: 600, h: 140}, proof: {x: 36, h2a: 2392, h2b: 2418, r1: 2458, r2: 2488, r3: 2518}, card: {x: 36, y: 1962, w: 868, h: 240}},
  },
} as const;

type Lay = (typeof L)['h'];
const lay = (o: Ori): Lay => L[o] as Lay;

/* ── browser chrome ─────────────────────────────────────────────────── */

export function Chrome({o, frame, w, h, opacity = 1}: {o: Ori; frame: number; w: number; h: number; opacity?: number}) {
  const dp = ph(frame, EV.assemble, 40, 'GLIDE');
  const up = ph(frame, EV.assemble + 10, 24, 'GLIDE');
  const per = 2 * (w + h);
  const typed = COPY.url.slice(0, Math.round(ph(frame, EV.assemble + 8, 30, 'LINEAR') * COPY.url.length));
  return (
    <g opacity={opacity}>
      <rect x={0} y={0} width={w} height={h} rx={r('lg')} fill={C.bg} stroke={C.borderStrong} strokeWidth={2} strokeDasharray={per} strokeDashoffset={per * (1 - dp)} />
      <rect x={1.5} y={1.5} width={w - 3} height={44} rx={r('lg')} fill={C.bgRaised} opacity={dp} />
      <g opacity={up}>
        <circle cx={26} cy={22} r={5} fill={C.surfaceHover} />
        <circle cx={46} cy={22} r={5} fill={C.surfaceHover} />
        <circle cx={66} cy={22} r={5} fill={C.surfaceHover} />
        <rect x={w / 2 - 190} y={10} width={380} height={24} rx={12} fill={C.surfaceSunken} stroke={C.border} strokeWidth={1.2} />
        <MonoLabel x={w / 2} y={26} size={12} anchor="middle" fill={C.textSecondary} tracking={0.04}>
          {typed}
        </MonoLabel>
        <line x1={0} y1={44} x2={w * dp} y2={44} stroke={C.border} strokeWidth={1.2} />
      </g>
    </g>
  );
}

/** Nav links (the brand lockup itself is delivered by the cover morph). */
export function NavLinks({o, frame, opacity = 1}: {o: Ori; frame: number; opacity?: number}) {
  const l = lay(o);
  const links = o === 'h' ? COPY.nav : [COPY.nav[0], COPY.nav[1], COPY.nav[3]];
  let x = l.pageW - 48;
  const items = links
    .slice()
    .reverse()
    .map((t) => {
      const w = measure(t, 'sans500', l.nav.linkSize);
      const pos = {t, x: x - w};
      x -= w + 28;
      return pos;
    });
  return (
    <g opacity={opacity}>
      {items.map((it, i) => (
        <FilmText
          key={it.t}
          x={it.x}
          y={l.nav.y}
          spec="body"
          size={l.nav.linkSize}
          fill={i === items.length - 1 ? C.text : C.textMuted}
          opacity={ph(frame, EV.assemble + 14 + i * 4, 18, 'GLIDE')}
        >
          {it.t}
        </FilmText>
      ))}
    </g>
  );
}

/* ── home hero (the H1 itself arrives via the cover-tagline morph) ──── */

export function HomeHero({o, frame}: {o: Ori; frame: number}) {
  const l = lay(o);
  const s1 = ph(frame, EV.heroReveal + 8, 24, 'GLIDE');
  const s2 = ph(frame, EV.heroReveal + 14, 24, 'GLIDE');
  const cta = ph(frame, EV.heroReveal + 20, 26, 'GLIDE');
  const no = ph(frame, EV.heroReveal + 28, 24, 'GLIDE');
  const nw = measureTracked(COPY.home.notice, 'sans500', 13, 0) + 74;
  return (
    <g>
      <MaskReveal id={`hs1-${o}`} x={48 - 4} y={l.hero.sub1Y - 24} w={700} h={32} progress={s1} direction="up">
        <FilmText x={48} y={l.hero.sub1Y} spec="body" size={o === 'h' ? 17 : 15} fill={C.textSecondary}>
          {COPY.home.sub1}
        </FilmText>
      </MaskReveal>
      <MaskReveal id={`hs2-${o}`} x={48 - 4} y={l.hero.sub2Y - 24} w={700} h={32} progress={s2} direction="up">
        <FilmText x={48} y={l.hero.sub2Y} spec="body" size={o === 'h' ? 17 : 15} fill={C.textSecondary}>
          {COPY.home.sub2}
        </FilmText>
      </MaskReveal>
      <g opacity={cta} transform={`translate(0 ${(1 - cta) * 18})`}>
        <g transform={`translate(${l.hero.cta.x + l.hero.cta.w / 2} ${l.hero.cta.y + l.hero.cta.h / 2}) scale(1 ${1 - 0.1 * (frame >= EV.ctaPress ? 1 - ph(frame, EV.ctaPress + 4, 12, 'GLIDE') : 0)}) translate(${-(l.hero.cta.x + l.hero.cta.w / 2)} ${-(l.hero.cta.y + l.hero.cta.h / 2)})`}>
        <rect x={l.hero.cta.x} y={l.hero.cta.y} width={l.hero.cta.w} height={l.hero.cta.h} rx={r('md')} fill={C.accent} />
        <FilmText x={l.hero.cta.x + l.hero.cta.w / 2} y={l.hero.cta.y + 34} spec="strong" size={15} anchor="middle" fill={C.textOnAccent}>
          {COPY.home.cta}
        </FilmText>
        </g>
        <rect x={l.hero.ghost.x} y={l.hero.ghost.y} width={l.hero.ghost.w} height={l.hero.ghost.h} rx={r('md')} fill="none" stroke={C.borderStrong} strokeWidth={1.6} />
        <FilmText x={l.hero.ghost.x + l.hero.ghost.w / 2} y={l.hero.ghost.y + 34} spec="strong" size={15} anchor="middle" fill={C.textSecondary}>
          {COPY.home.ghost}
        </FilmText>
      </g>
      <g opacity={no} transform={`translate(0 ${(1 - no) * 14})`}>
        <rect x={48} y={l.hero.noticeY - 26} width={nw} height={38} rx={19} fill={C.bgRaised} stroke={C.border} strokeWidth={1.4} />
        <rect x={62} y={l.hero.noticeY - 15} width={16} height={16} rx={5} fill={C.secondarySoftStrong} />
        <FilmText x={70} y={l.hero.noticeY - 3} spec="strong" size={11} anchor="middle" fill={C.secondary}>
          !
        </FilmText>
        <FilmText x={88} y={l.hero.noticeY} spec="body" size={13} fill={C.textSecondary}>
          {COPY.home.notice}
        </FilmText>
      </g>
    </g>
  );
}

/* ── /scan header + console ─────────────────────────────────────────── */

function stepLabel(frame: number): string {
  if (frame >= EV.scanComplete) return COPY.machine.complete;
  if (frame >= EV.step3) return COPY.machine.states[3];
  if (frame >= EV.step2) return COPY.machine.states[2];
  if (frame >= EV.step1) return COPY.machine.states[1];
  return COPY.machine.states[0];
}

export function ScanHead({o, frame}: {o: Ori; frame: number}) {
  const l = lay(o);
  const inE = ph(frame, EV.pageSwap + 6, 28, 'GLIDE');
  const checking = frame >= EV.scanOnset;
  const title = checking ? COPY.scan.checkingTitle : COPY.scan.title;
  return (
    <g opacity={inE} transform={`translate(0 ${(1 - inE) * 26})`}>
      <FilmText x={48} y={l.head.titleY} spec="display" size={o === 'h' ? 40 : 32} fill={C.text}>
        {title}
      </FilmText>
      <FilmText x={48} y={l.head.sup1Y} spec="body" size={o === 'h' ? 15 : 13} fill={C.textMuted}>
        {checking ? COPY.scan.chk1 : COPY.scan.sup1}
      </FilmText>
      <FilmText x={48} y={l.head.sup2Y} spec="body" size={o === 'h' ? 15 : 13} fill={C.textMuted}>
        {checking ? COPY.scan.chk2 : COPY.scan.sup2}
      </FilmText>
      <MonoLabel x={l.pageW - 48} y={l.head.metaY} size={12} anchor="end" fill={C.textMuted}>
        {frame >= EV.scanOnset ? `${FIX.walletShort}  ·  ${COPY.scan.metaRead}` : `${COPY.scan.metaEmpty}  ·  ${COPY.scan.metaSolana}`}
      </MonoLabel>
    </g>
  );
}

export function Machine({o, frame}: {o: Ori; frame: number}) {
  const l = lay(o);
  const m = l.machine;
  const live = frame >= EV.scanOnset;
  const done = frame >= EV.scanComplete;
  const prog = done ? 1 : live ? ph(frame, EV.scanOnset, EV.scanComplete - EV.scanOnset, 'LINEAR') : 0;
  const inE = ph(frame, EV.pageSwap + 12, 30, 'GLIDE');
  const tally = ph(frame, EV.tally, 30, 'GLIDE');
  const fig = ph(frame, EV.figure, 36, 'GLIDE');
  const labels = [COPY.machine.wallet, COPY.machine.scan, COPY.machine.classify, COPY.machine.result];
  const nodeLive = [live || done, live || done, frame >= EV.wire2 || done, frame >= EV.wire3 || done];
  return (
    <g opacity={inE} transform={`translate(0 ${(1 - inE) * 20})`}>
      <Panel x={m.x} y={m.y} w={m.w} h={m.h} radius={r('lg')} fill={C.bgRaised} stroke={C.border} />
      {m.nodes.map((n, i) => {
        const next = m.nodes[i + 1];
        return (
          <g key={i}>
            {next &&
              (o === 'h' ? (
                <line x1={n.x + n.w} y1={m.wireY} x2={next.x} y2={m.wireY} stroke={nodeLive[i] ? C.borderAccent : C.border} strokeWidth={STROKE.thin} />
              ) : (
                <line x1={m.wireX} y1={n.y + n.h} x2={m.wireX} y2={next.y} stroke={nodeLive[i] ? C.borderAccent : C.border} strokeWidth={STROKE.thin} />
              ))}
            <Panel x={n.x} y={n.y} w={n.w} h={n.h} radius={r('md')} fill={C.surface} stroke={nodeLive[i] ? C.borderAccent : C.border} />
            <circle cx={n.x + 18} cy={n.y + 22} r={4.5} fill={i === 3 && fig > 0 ? C.secondary : nodeLive[i] ? C.data : C.textMuted} opacity={nodeLive[i] || (i === 3 && fig > 0) ? 1 : 0.5} />
            <FilmText x={n.x + 32} y={n.y + 27} spec="strong" size={13} fill={C.text}>
              {labels[i]}
            </FilmText>
            {i === 0 && (
              <MonoLabel x={n.x + 16} y={n.y + 62} size={12} fill={frame >= EV.scanPress ? C.textSecondary : C.textMuted}>
                {frame >= EV.scanPress ? FIX.walletShort : COPY.scan.metaEmpty}
              </MonoLabel>
            )}
            {i === 1 && (
              <g>
                <rect x={n.x + 14} y={n.y + 52} width={n.w - 28} height={6} rx={3} fill={C.surfaceSunken} />
                <rect x={n.x + 14} y={n.y + 52} width={(n.w - 28) * prog} height={6} rx={3} fill={C.accentText} />
                <MonoLabel x={n.x + 16} y={n.y + 84} size={11} fill={C.textMuted}>
                  {live || done ? stepLabel(frame) : 'Ready to scan'}
                </MonoLabel>
              </g>
            )}
            {i === 2 && (
              <g opacity={0.4 + 0.6 * tally}>
                <MonoLabel x={n.x + 16} y={n.y + 56} size={11} fill={C.textSecondary}>
                  {Math.round(tally * FIX.eligible)} {COPY.machine.eligible}
                </MonoLabel>
                <MonoLabel x={n.x + 16} y={n.y + 74} size={11} fill={C.textSecondary}>
                  {Math.round(tally * FIX.candidates)} {COPY.machine.candidates}
                </MonoLabel>
                <MonoLabel x={n.x + 16} y={n.y + 92} size={11} fill={C.textMuted}>
                  {Math.round(tally * FIX.notEligible)} {COPY.machine.notEligible}
                </MonoLabel>
              </g>
            )}
            {i === 3 && (
              <g>
                <MonoLabel x={n.x + 16} y={n.y + 66} size={o === 'h' ? 19 : 17} fill={fig > 0 ? C.text : C.textMuted}>
                  {(fig * FIX.sol).toFixed(4)} SOL
                </MonoLabel>
                <MonoLabel x={n.x + 16} y={n.y + 88} size={11} fill={C.textMuted}>
                  {COPY.machine.solDetected}
                </MonoLabel>
              </g>
            )}
          </g>
        );
      })}
      {live && o === 'h' && (
        <g opacity={ph(frame, EV.scanOnset + 8, 20, 'GLIDE')}>
          <FilmText x={m.x + 40} y={m.y + 196} spec="h2" size={22} fill={C.text}>
            {done ? 'Scan complete.' : stepLabel(frame)}
          </FilmText>
          <FilmText x={m.x + 40} y={m.y + 224} spec="body" size={13} fill={C.textMuted}>
            {done ? 'Your wallet has been scanned. Your CULLER allocation is shown below.' : 'Reading balances and token accounts live from Solana. This takes a few seconds.'}
          </FilmText>
        </g>
      )}
    </g>
  );
}

export function ScanControls({o, frame}: {o: Ori; frame: number}) {
  const l = lay(o);
  const f = l.form;
  const inE = ph(frame, EV.pageSwap + 16, 30, 'GLIDE');
  const pressed = frame >= EV.scanPress;
  const typedN = Math.round(ph(frame, EV.typeStart, EV.typeEnd - EV.typeStart, 'LINEAR') * FIX.wallet.length);
  const caretOn = Math.floor((frame - EV.typeStart) / 15) % 2 === 0;
  const dip = pressed ? 1 - ph(frame, EV.scanPress + 4, 12, 'GLIDE') : 0;
  const stateE = pressed ? ph(frame, EV.scanPress, 18, 'GLIDE') : 0;
  return (
    <g opacity={inE} transform={`translate(0 ${(1 - inE) * 20})`}>
      {!pressed ? (
        <g>
          <FilmText x={f.x} y={f.h2Y} spec="h2" size={o === 'h' ? 24 : 20} fill={C.text}>
            {COPY.scan.formH2}
          </FilmText>
          <FilmText x={f.x} y={f.p1Y} spec="body" size={13} fill={C.textMuted}>
            {COPY.scan.formP1}
          </FilmText>
          <FilmText x={f.x} y={f.p2Y} spec="body" size={13} fill={C.textMuted}>
            {COPY.scan.formP2}
          </FilmText>
          <MonoLabel x={f.x} y={f.l1Y} size={12} fill={C.textSecondary}>
            {COPY.scan.labelSol}
          </MonoLabel>
          <rect x={f.in1.x} y={f.in1.y} width={f.in1.w} height={f.in1.h} rx={r('md')} fill={C.surfaceSunken} stroke={typedN > 0 ? C.borderAccent : C.border} strokeWidth={1.6} />
          <MonoLabel x={f.in1.x + 16} y={f.in1.y + 28} size={13} fill={typedN > 0 ? C.text : C.textMuted}>
            {typedN > 0 ? FIX.wallet.slice(0, typedN) : COPY.scan.phSol}
          </MonoLabel>
          {typedN > 0 && typedN < FIX.wallet.length && caretOn && (
            <rect x={f.in1.x + 16 + measure(FIX.wallet.slice(0, typedN), 'mono400', 13) + 2} y={f.in1.y + 12} width={2} height={20} fill={C.accentText} />
          )}
          <MonoLabel x={f.x} y={f.l2Y} size={12} fill={C.textMuted}>
            {COPY.scan.labelRh}
          </MonoLabel>
          <rect x={f.in2.x} y={f.in2.y} width={f.in2.w} height={f.in2.h} rx={r('md')} fill={C.surfaceSunken} stroke={C.border} strokeWidth={1.6} />
          <MonoLabel x={f.in2.x + 16} y={f.in2.y + 26} size={13} fill={C.textMuted}>
            {COPY.scan.phRh}
          </MonoLabel>
          <g transform={`translate(${f.btn.x + f.btn.w / 2} ${f.btn.y + f.btn.h / 2}) scale(1 ${1 - 0.1 * dip}) translate(${-(f.btn.x + f.btn.w / 2)} ${-(f.btn.y + f.btn.h / 2)})`}>
            <rect x={f.btn.x} y={f.btn.y} width={f.btn.w} height={f.btn.h} rx={r('md')} fill={C.accent} />
            <FilmText x={f.btn.x + f.btn.w / 2} y={f.btn.y + 28} spec="strong" size={14} anchor="middle" fill={C.textOnAccent}>
              {COPY.scan.btn}
            </FilmText>
          </g>
          <MonoLabel x={f.x} y={f.n1Y} size={11} fill={C.textMuted}>
            {COPY.scan.note1}
          </MonoLabel>
          <MonoLabel x={f.x} y={f.n2Y} size={11} fill={C.textMuted}>
            {COPY.scan.note2}
          </MonoLabel>
        </g>
      ) : o === 'v' ? (
        <g opacity={stateE} transform={`translate(0 ${(1 - stateE) * 14})`}>
          <FilmText x={f.x} y={f.h2Y} spec="h2" size={20} fill={C.text}>
            {frame >= EV.scanComplete ? 'Scan complete.' : stepLabel(frame)}
          </FilmText>
          <FilmText x={f.x} y={f.p1Y} spec="body" size={12} fill={C.textMuted}>
            {frame >= EV.scanComplete ? 'Your wallet has been scanned.' : 'Reading balances and token accounts live from Solana.'}
          </FilmText>
        </g>
      ) : null}
    </g>
  );
}

/* ── results + allocation ───────────────────────────────────────────── */

export function Rows({o, frame}: {o: Ori; frame: number}) {
  const l = lay(o);
  const rw = l.rows;
  return (
    <g>
      <MonoLabel x={48 - 12} y={rw.eyebrowY} size={12} fill={C.accentText} opacity={ph(frame, EV.rowsIn - 8, 20, 'GLIDE')}>
        {COPY.results.summaryEyebrow}
      </MonoLabel>
      <FilmText x={48} y={rw.strongY} spec="strong" size={20} fill={C.text} opacity={ph(frame, EV.rowsIn - 4, 20, 'GLIDE')}>
        {FIX.assets} assets
      </FilmText>
      <FilmText x={48} y={rw.s1Y} spec="body" size={13} fill={C.textMuted} opacity={ph(frame, EV.rowsIn, 20, 'GLIDE')}>
        {COPY.results.summary1}
      </FilmText>
      <FilmText x={48} y={rw.s2Y} spec="body" size={13} fill={C.textMuted} opacity={ph(frame, EV.rowsIn + 4, 20, 'GLIDE')}>
        {COPY.results.summary2}
      </FilmText>
      {ROWS.map((row, i) => {
        const at = EV.rowsIn + 8 + i * 12;
        const e = ph(frame, at, 26, 'GLIDE');
        if (e <= 0) return null;
        const y = rw.y0 + i * (rw.rowH + rw.gap);
        const sc = STATUS_COLOR[row.status];
        return (
          <g key={i} opacity={e} transform={`translate(${(1 - e) * -26} 0)`}>
            <MaskReveal id={`row-${o}-${i}`} x={rw.x} y={y} w={rw.w} h={rw.rowH} progress={e} direction="right">
              <Panel x={rw.x} y={y} w={rw.w} h={rw.rowH} radius={r('md')} fill={C.surface} stroke={i === FOCUS_ROW ? C.borderStrong : C.border} />
              <g transform={`translate(${rw.x + 44} ${y + rw.rowH / 2})`}>
                <AssetIcon kind={row.kind} size={40} color={row.status === 'KEEP' ? C.textMuted : C.accentText} />
              </g>
              <FilmText x={rw.x + 88} y={y + 38} spec="strong" size={o === 'h' ? 16 : 15} fill={C.text}>
                {row.name}
              </FilmText>
              <MonoLabel x={rw.x + 88} y={y + 62} size={11} fill={C.textMuted}>
                {row.kind.toLowerCase()}  ·  {row.addr}
              </MonoLabel>
              <MonoLabel x={rw.x + rw.w - (o === 'h' ? 330 : 300)} y={y + 38} size={12} fill={C.textSecondary}>
                {COPY.results.age} {row.age}
              </MonoLabel>
              <MonoLabel x={rw.x + rw.w - (o === 'h' ? 330 : 300)} y={y + 62} size={12} fill={row.valueKnown ? C.textSecondary : C.warn}>
                {COPY.results.value} {row.value}
              </MonoLabel>
              <StatusPill x={rw.x + rw.w - 160} y={y + 18} label={row.status.charAt(0) + row.status.slice(1).toLowerCase()} fg={sc.fg} bg={sc.bg} border={sc.border} height={30} size={13} opacity={ph(frame, at + 8, 18, 'GLIDE')} />
              <MonoLabel x={rw.x + rw.w - 160} y={y + 72} size={10} fill={C.textMuted}>
                {row.chip}
              </MonoLabel>
              <FilmText x={rw.x + 88} y={y + 84} spec="body" size={12} fill={C.textMuted} opacity={ph(frame, at + 12, 20, 'GLIDE')}>
                {row.reason}
              </FilmText>
            </MaskReveal>
          </g>
        );
      })}
    </g>
  );
}


export function Alloc({o, frame}: {o: Ori; frame: number}) {
  const l = lay(o);
  const a = l.alloc;
  const e = ph(frame, EV.allocResolve, 28, 'GLIDE');
  const count = ph(frame, EV.amountCount, 24, 'GLIDE');
  const ev1 = ph(frame, EV.evidence1, 24, 'GLIDE');
  const ev2 = ph(frame, EV.evidence2, 24, 'GLIDE');
  const checks = [ph(frame, EV.check1, 20, 'GLIDE'), ph(frame, EV.check2, 20, 'GLIDE'), ph(frame, EV.check3, 20, 'GLIDE')];
  const amount = `+${Math.round(count * FIX.alloc).toLocaleString('en-US')} $CULLER`;
  const proofRows = [COPY.proof.row1, COPY.proof.row2, COPY.proof.row3];
  const proofY = [a.proof.r1, a.proof.r2, a.proof.r3];
  return (
    <g>
      <g opacity={e} transform={`translate(0 ${(1 - e) * 22})`}>
        <Panel x={a.card.x} y={a.card.y} w={a.card.w} h={a.card.h} radius={r('lg')} fill={C.bgRaised} stroke={C.borderAccent} strokeWidth={1.8} />
        <MonoLabel x={a.card.x + 24} y={a.eyebrowY} size={12} fill={C.accentText}>
          {COPY.alloc.eyebrow}
        </MonoLabel>
        <FilmText x={a.card.x + 24} y={a.h2Y} spec="display" size={o === 'h' ? 34 : 28} fill={C.text}>
          {COPY.alloc.h2}
        </FilmText>
        <FilmText x={a.card.x + 24} y={a.amountY} spec="strong" size={o === 'h' ? 46 : 38} fill={C.text} letterSpacing={-0.01 * (o === 'h' ? 46 : 38)}>
          {amount}
        </FilmText>
        <StatusPill x={o === 'h' ? 500 : 360} y={a.chip.y} label={COPY.alloc.state} fg={C.accentText} bg={C.accentSoft} border={C.borderAccent} height={30} size={12} opacity={ph(frame, EV.amountCount + 8, 20, 'GLIDE')} />
        <FilmText x={a.card.x + 24} y={a.pY} spec="body" size={13} fill={C.textSecondary}>
          {COPY.alloc.p}
        </FilmText>
        <FilmText x={a.card.x + 24} y={a.noteY} spec="body" size={12} fill={C.textMuted}>
          {COPY.alloc.note}
        </FilmText>
        <MonoLabel x={a.card.x + 24} y={a.illY} size={11} fill={C.secondary}>
          {COPY.alloc.illustrative}
        </MonoLabel>
      </g>
      <g opacity={ev1}>
        <Panel x={a.ev.x} y={a.ev.y} w={a.ev.w} h={a.ev.h} radius={r('md')} fill={C.surface} stroke={C.border} />
        <MonoLabel x={a.ev.x + 24} y={a.ev.y + 34} size={12} fill={C.accentText}>
          {COPY.alloc.evEyebrow}
        </MonoLabel>
        <FilmText x={a.ev.x + 24} y={a.ev.y + 70} spec="strong" size={20} fill={C.text}>
          {FIX.points} {COPY.alloc.points}
        </FilmText>
        <MonoLabel x={a.ev.x + 24} y={a.ev.y + 100} size={12} fill={C.textSecondary} opacity={ev1}>
          {COPY.alloc.contrib1}
        </MonoLabel>
        <MonoLabel x={a.ev.x + 24} y={a.ev.y + 124} size={12} fill={C.textSecondary} opacity={ev2}>
          {COPY.alloc.contrib2}
        </MonoLabel>
      </g>
      <g>
        <FilmText x={a.proof.x} y={a.proof.h2a} spec="h2" size={o === 'h' ? 22 : 18} fill={C.text} opacity={ph(frame, EV.check1 - 12, 22, 'GLIDE')}>
          {o === 'h' ? COPY.proof.h2 : COPY.proof.v1}
        </FilmText>
        <FilmText x={a.proof.x} y={a.proof.h2b} spec="h2" size={o === 'h' ? 22 : 18} fill={C.text} opacity={ph(frame, EV.check1 - 12, 22, 'GLIDE')}>
          {o === 'h' ? '' : COPY.proof.v2}
        </FilmText>
        {proofRows.map((t, i) => (
          <g key={i} opacity={checks[i]}>
            <path
              d={`M ${a.proof.x} ${proofY[i] - 8} l 4 5 l 8 -10`}
              fill="none"
              stroke={C.ok}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={20}
              strokeDashoffset={20 * (1 - checks[i])}
            />
            <FilmText x={a.proof.x + 24} y={proofY[i]} spec="body" size={o === 'h' ? 12 : 11} fill={C.textSecondary}>
              {t}
            </FilmText>
          </g>
        ))}
      </g>
    </g>
  );
}

/** Width helper for the anchor: end of proof row 3 (record dot target). */
export function proofRow3End(o: Ori): number {
  const a = lay(o).alloc;
  return a.proof.x + 24 + measure(COPY.proof.row3, 'sans500', o === 'h' ? 12 : 11) + 14;
}

export {statusPillWidth};
