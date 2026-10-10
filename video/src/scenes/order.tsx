import {C, r as rad, STROKE} from '../brand/tokens';
import {COPY} from '../brand/copy';
import {CUES} from '../brand/timeline';
import {measureTracked} from '../brand/textMetrics';
import {FilmText, MonoLabel, MaskReveal, Hairline, VHairline} from '../components/primitives';
import {AssetTile} from '../components/assets';
import {ASSETS, gridSlot, LAYOUT, type LayoutKey} from './data';
import {AsideHeadline, Labels, FindLines} from './inventory';
import {bezierPoint, cubicPath, ease, fadeIn, stagger, EASE_EXPO, EASE_INOUT} from '../lib/anim';

/**
 * SCENE 3 — FROM SCATTERED TO ORGANIZED (0:09–0:15)
 *
 * The film's centre of gravity. The same ten objects leave the loose
 * constellation and travel individual eased bezier paths into a strict
 * inventory grid — nothing teleports, every path is authored. As they lock,
 * the product's own structure appears: a panel, a blue spine, and the two
 * real scan sources (Solana, Robinhood Chain) converging into it. Orange
 * appears exactly once: the one item that needs attention.
 */

function SourceChip({
  frame,
  at,
  x,
  y,
  title,
  detail,
  o,
}: {
  frame: number;
  at: number;
  x: number;
  y: number;
  title: string;
  detail: string;
  o: LayoutKey;
}) {
  const t = ease(frame, at, 22, EASE_EXPO);
  if (t <= 0) return null;
  const w = Math.max(measureTracked(title, 'mono400', 20, 0.12), measureTracked(detail, 'mono400', 15, 0.1)) + 56;
  return (
    <g opacity={t} transform={`translate(${(1 - t) * -60} 0)`}>
      <rect x={x} y={y} width={w} height={52} rx={26} fill={C.accentSoft} stroke={C.borderAccent} strokeWidth={1.4} />
      <circle cx={x + 26} cy={y + 26} r={5} fill={C.accentText} />
      <MonoLabel x={x + 44} y={y + 33} size={20} fill={C.text} tracking={0.12}>
        {title}
      </MonoLabel>
      <MonoLabel x={x + 4} y={y + 76} size={15} fill={C.textMuted} tracking={0.1}>
        {detail}
      </MonoLabel>
    </g>
  );
}

function Reflow({frame, o}: {frame: number; o: LayoutKey}) {
  return (
    <g>
      {ASSETS.map((a, i) => {
        const [sx, sy] = a.scatter[o];
        const [gx, gy] = gridSlot(a.grid, o);
        const at = CUES.reflowStart + stagger(i, 3);
        const t = ease(frame, at, 44, EASE_INOUT);
        const snap = ease(frame, at + 40, 12, EASE_EXPO);
        const mid: [number, number] = o === 'h' ? [(sx + gx) / 2 - 60, Math.min(sy, gy) - 90] : [(sx + gx) / 2 + 70, (sy + gy) / 2 - 40];
        const [px, py] = bezierPoint(t, [sx, sy], mid, [gx + 30, gy + 20], [gx, gy]);
        const scale = 1 + 0.06 * Math.sin(t * Math.PI) - 0.02 * snap;
        const flaggedSettled = a.flagged && frame >= CUES.reflowLock;
        return (
          <AssetTile
            key={a.id}
            x={px}
            y={py}
            size={132}
            kind={a.kind}
            label={a.label}
            meta={a.meta}
            scale={scale}
            rotation={0}
            opacity={1}
            flagged={flaggedSettled}
          />
        );
      })}
    </g>
  );
}

export function Structure({frame, o}: {frame: number; o: LayoutKey}) {
  const gp = LAYOUT[o].gridPanel;
  const panelIn = fadeIn(frame, CUES.sourcesIn - 6, 24);
  const spine = ease(frame, CUES.sourcesIn + 12, 34, EASE_EXPO);
  const spineX = gp.x + 44;
  const p1 = ease(frame, CUES.sourcesIn + 18, 30, EASE_EXPO);
  const attention = ease(frame, CUES.reflowLock + 6, 18, EASE_EXPO);
  const attnW = measureTracked(COPY.attentionLabel, 'mono400', 16, 0.14);
  const scanW = measureTracked(COPY.scanMicro, 'mono400', 15, 0.14);
  return (
    <g>
      <rect x={gp.x} y={gp.y} width={gp.w} height={gp.h} rx={rad('xl')} fill={C.bgRaised} stroke={C.border} strokeWidth={1.6} opacity={panelIn * 0.9} />
      <MonoLabel x={gp.x + 44} y={gp.y + 44} size={15} fill={C.textMuted} opacity={panelIn} tracking={0.14}>
        {COPY.scanMicro}
      </MonoLabel>
      <Hairline x1={gp.x + 44} y={gp.y + 58} x2={gp.x + 44 + scanW} progress={panelIn} color={C.border} weight={1.2} />
      <VHairline x={spineX} y1={gp.y + 84} y2={gp.y + gp.h - 40} progress={spine} color={C.accentText} weight={STROKE.thin} opacity={0.85} />
      {/* source paths converge onto the spine */}
      {o === 'h' ? (
        <g>
          <ConvergePath frame={frame} p={p1} from={[520, 406]} to={[spineX, gp.y + 150]} />
          <ConvergePath frame={frame} p={p1} from={[560, 526]} to={[spineX, gp.y + 300]} />
        </g>
      ) : (
        <g>
          <ConvergePath frame={frame} p={p1} from={[300, 478]} to={[spineX, gp.y + 140]} />
          <ConvergePath frame={frame} p={p1} from={[760, 478]} to={[spineX, gp.y + 340]} />
        </g>
      )}
      <g opacity={panelIn}>
        <MonoLabel x={gp.x + 44} y={gp.y + gp.h - 34} size={15} fill={C.textMuted} tracking={0.12}>
          {o === 'h' ? COPY.orderFooter : COPY.orderFooterShort}
        </MonoLabel>
        <Hairline x1={gp.x + 44} y={gp.y + gp.h - 22} x2={gp.x + 44 + measureTracked(o === 'h' ? COPY.orderFooter : COPY.orderFooterShort, 'mono400', 15, 0.12)} progress={panelIn} color={C.border} weight={1.2} />
      </g>
      {/* the single orange signal */}
      {attention > 0 ? (
        <g opacity={attention}>
          <rect x={gp.x + gp.w - 40 - attnW - 14} y={gp.y + 30} width={4} height={22} rx={2} fill={C.secondary} />
          <MonoLabel x={gp.x + gp.w - 40 - attnW} y={gp.y + 47} size={16} fill={C.secondary} tracking={0.14}>
            {COPY.attentionLabel}
          </MonoLabel>
        </g>
      ) : null}
    </g>
  );
}

function ConvergePath({frame, p, from, to}: {frame: number; p: number; from: [number, number]; to: [number, number]}) {
  const d = cubicPath(from, [(from[0] + to[0]) / 2, from[1]], [(from[0] + to[0]) / 2, to[1]], to);
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]) * 1.2;
  return (
    <path d={d} fill="none" stroke={C.accentText} strokeWidth={STROKE.thin} opacity={0.7} strokeDasharray={len} strokeDashoffset={len * (1 - p)} strokeLinecap="round" />
  );
}

function BigType({frame, o}: {frame: number; o: LayoutKey}) {
  const pos = o === 'h' ? {x: 140, y1: 780, y2: 876, size: 84} : {x: 84, y1: 1560, y2: 1656, size: 80};
  const m1 = ease(frame, CUES.oneInventory, 22, EASE_EXPO);
  const m2 = ease(frame, CUES.oneInventory + 10, 22, EASE_EXPO);
  const w1 = measureTracked(COPY.orderLine1, 'sans800', pos.size, -0.03);
  const w2 = measureTracked(COPY.orderLine2, 'sans800', pos.size, -0.03);
  return (
    <g>
      <MaskReveal id={`o3a-${o}`} x={pos.x - 8} y={pos.y1 - pos.size} w={w1 + 24} h={pos.size * 1.3} progress={m1} direction="up">
        <FilmText x={pos.x} y={pos.y1} spec="display" size={pos.size} fill={C.text}>
          {COPY.orderLine1}
        </FilmText>
      </MaskReveal>
      <MaskReveal id={`o3b-${o}`} x={pos.x - 8} y={pos.y2 - pos.size} w={w2 + 24} h={pos.size * 1.3} progress={m2} direction="up">
        <FilmText x={pos.x} y={pos.y2} spec="display" size={pos.size} fill={C.text}>
          {COPY.orderLine2}
        </FilmText>
      </MaskReveal>
    </g>
  );
}

export function Sources({frame, o}: {frame: number; o: LayoutKey}) {
  if (o === 'h') {
    return (
      <g>
        <SourceChip frame={frame} at={CUES.sourcesIn} x={140} y={380} title={COPY.sourceSolana} detail={COPY.sourceSolanaDetail} o={o} />
        <SourceChip frame={frame} at={CUES.sourcesIn + 8} x={140} y={500} title={COPY.sourceRobinhood} detail={COPY.sourceRobinhoodDetail} o={o} />
      </g>
    );
  }
  return (
    <g>
      <SourceChip frame={frame} at={CUES.sourcesIn} x={84} y={400} title={COPY.sourceSolana} detail={COPY.sourceSolanaDetail} o={o} />
      <SourceChip frame={frame} at={CUES.sourcesIn + 8} x={560} y={400} title={COPY.sourceRobinhood} detail={COPY.sourceRobinhoodDetail} o={o} />
    </g>
  );
}

/** Scene 2's labels bow out as the inventory takes order; the headline stays. */
function ExitS2({frame, o}: {frame: number; o: LayoutKey}) {
  const out = 1 - ease(frame, 270, 18, EASE_EXPO);
  if (out <= 0) return null;
  return (
    <g opacity={out}>
      <Labels frame={270} o={o} />
      <FindLines frame={270} o={o} />
    </g>
  );
}

export function Scene3H({frame}: {frame: number}) {
  return (
    <g>
      <AsideHeadline frame={frame} o="h" />
      <ExitS2 frame={frame} o="h" />
      <Structure frame={frame} o="h" />
      <Sources frame={frame} o="h" />
      <Reflow frame={frame} o="h" />
      <BigType frame={frame} o="h" />
    </g>
  );
}

export function Scene3V({frame}: {frame: number}) {
  return (
    <g>
      <AsideHeadline frame={frame} o="v" />
      <ExitS2 frame={frame} o="v" />
      <Structure frame={frame} o="v" />
      <Sources frame={frame} o="v" />
      <Reflow frame={frame} o="v" />
      <BigType frame={frame} o="v" />
    </g>
  );
}
