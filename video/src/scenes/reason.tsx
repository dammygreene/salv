import {C, r as rad, STATUS_COLOR} from '../brand/tokens';
import {COPY} from '../brand/copy';
import {CUES} from '../brand/timeline';
import {measureTracked} from '../brand/textMetrics';
import {statusPillWidth} from '../components/primitives';
import {FilmText, MonoLabel, MaskReveal, Hairline, StatusPill} from '../components/primitives';
import {AssetIcon, AssetTile} from '../components/assets';
import {ASSETS, gridSlot, LAYOUT, rowSlot, type LayoutKey} from './data';
import {Structure, Sources} from './order';
import {AsideHeadline} from './inventory';
import {bezierPoint, ease, fadeIn, springIn, EASE_EXPO} from '../lib/anim';

/**
 * SCENE 4 — EVERY ITEM GETS A REASON (0:15–0:22)
 *
 * The geometric inventory resolves into the product itself: one panel, four
 * rows, the four real AssetStatus values, and no invented numbers. Each row
 * sets its state with a quiet spring; one row opens to show its reason —
 * the product explains its decisions instead of presenting a bare score.
 * Values stay honest: where CULLER has no market data it says so.
 */

const EXPAND_INDEX = 1;

function lerpRect(a: {x: number; y: number; w: number; h: number}, b: {x: number; y: number; w: number; h: number}, t: number) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    w: a.w + (b.w - a.w) * t,
    h: a.h + (b.h - a.h) * t,
  };
}

function expandExtra(frame: number, fps: number, key: LayoutKey): number {
  const amount = key === 'h' ? 56 : 64;
  return amount * springIn(frame, CUES.rowExpand, fps, {damping: 24, stiffness: 150, mass: 0.8});
}

function Rows({frame, fps, o}: {frame: number; fps: number; o: LayoutKey}) {
  const R = LAYOUT[o].rows;
  const extra = expandExtra(frame, fps, o);
  const nameSize = o === 'h' ? 30 : 30;
  return (
    <g>
      {COPY.rows.map((row, i) => {
        const slot = rowSlot(i, o);
        const yShift = i > EXPAND_INDEX ? extra : 0;
        const y = slot.y + yShift;
        const h = slot.h + (i === EXPAND_INDEX ? extra : 0);
        const wipe = ease(frame, 468 + i * 8, 18, EASE_EXPO);
        if (wipe <= 0) return null;
        const st = STATUS_COLOR[row.status];
        const setState = springIn(frame, CUES.rowState[i], fps, {damping: 14, stiffness: 200, mass: 0.7});
        const tint = ease(frame, CUES.rowState[i], 16, EASE_EXPO);
        const pillW = statusPillWidth(row.status, 17);
        const reasonIn = i === EXPAND_INDEX ? ease(frame, CUES.rowExpand + 10, 16, EASE_EXPO) : 0;
        const reasonW = measureTracked(row.reason, 'mono400', o === 'h' ? 17 : 16, 0.04);
        return (
          <g key={row.name}>
            <MaskReveal id={`row-${o}-${i}`} x={R.x} y={y} w={R.w} h={h} progress={wipe} direction="right">
              <rect x={R.x} y={y} width={R.w} height={h} rx={rad('lg')} fill={C.surface} stroke={C.border} strokeWidth={1.4} />
              {/* state tint + left bar */}
              <rect x={R.x} y={y} width={R.w} height={h} rx={rad('lg')} fill={st.bg} opacity={tint * 0.75} />
              <rect x={R.x} y={y + 14} width={4} height={(h - 28) * tint} rx={2} fill={st.fg} />
              {/* icon */}
              <g transform={`translate(${R.x + 58} ${y + 46})`} opacity={wipe}>
                <AssetIcon kind={ASSETS[i].kind} color={st.fg} size={40} />
              </g>
              {/* names */}
              <FilmText x={R.x + 104} y={y + 42} spec="h3" size={nameSize} fill={C.text} opacity={wipe}>
                {row.name}
              </FilmText>
              <MonoLabel x={R.x + 104} y={y + 72} size={16} fill={C.textMuted} opacity={wipe * 0.9} tracking={0.06}>
                {row.meta}
              </MonoLabel>
              {/* expanded reason */}
              {i === EXPAND_INDEX && reasonIn > 0 ? (
                <g opacity={reasonIn}>
                  <Hairline x1={R.x + 104} y={y + 92} x2={R.x + 104 + reasonW} progress={reasonIn} color={C.border} weight={1.2} />
                  <MonoLabel x={R.x + 104} y={y + 122} size={o === 'h' ? 17 : 16} fill={C.textSecondary} tracking={0.04}>
                    {row.reason}
                  </MonoLabel>
                </g>
              ) : null}
              {/* status pill */}
              <StatusPill
                x={R.x + R.w - pillW - 36}
                y={y + (i === EXPAND_INDEX ? 30 : 30)}
                label={row.status}
                fg={st.fg}
                bg={C.surfaceHover}
                border={st.border}
                height={40}
                opacity={setState}
                scale={0.7 + 0.3 * setState}
              />
            </MaskReveal>
          </g>
        );
      })}
    </g>
  );
}

/** Tiles from scene 3's grid fly into their row (or collapse into "+N"). */
function TileMorph({frame, o}: {frame: number; o: LayoutKey}) {
  const R = LAYOUT[o].rows;
  return (
    <g>
      {ASSETS.map((a, i) => {
        const [gx, gy] = gridSlot(a.grid, o);
        const isRow = a.row >= 0;
        const slot = isRow ? rowSlot(a.row, o) : null;
        const tx = isRow && slot ? R.x + 58 : R.x + R.w - 90 - (i % 3) * 26;
        const ty = isRow && slot ? slot.y + 46 : R.y - 34;
        const at = 462 + i * 4;
        const t = ease(frame, at, 26, EASE_EXPO);
        if (t >= 1) return null;
        const [px, py] = bezierPoint(t, [gx, gy], [(gx + tx) / 2, gy - 60], [(gx + tx) / 2, ty - 30], [tx, ty]);
        const scale = 1 - 0.55 * t;
        return (
          <AssetTile
            key={a.id}
            x={px}
            y={py}
            size={132}
            kind={a.kind}
            scale={scale}
            opacity={isRow ? 1 - t * t : 0.9 * (1 - t)}
          />
        );
      })}
    </g>
  );
}

function PanelShell({frame, o}: {frame: number; o: LayoutKey}) {
  const gp = LAYOUT[o].gridPanel;
  const pn = LAYOUT[o].panel;
  const t = ease(frame, 462, 30, EASE_EXPO);
  const box = lerpRect({x: gp.x, y: gp.y, w: gp.w, h: gp.h}, {x: pn.x, y: pn.y, w: pn.w, h: pn.h}, t);
  const headerIn = fadeIn(frame, 470, 18);
  const moreW = measureTracked('+6', 'mono400', 16, 0.08);
  const moreIn = fadeIn(frame, 502, 14);
  return (
    <g>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={rad('xl')} fill={C.surface} stroke={C.borderStrong} strokeWidth={1.6} />
      <g opacity={headerIn}>
        <MonoLabel x={box.x + 40} y={box.y + 52} size={17} fill={C.textSecondary} tracking={0.14}>
          {COPY.panelTitle}
        </MonoLabel>
        <MonoLabel x={box.x + box.w - 40} y={box.y + 52} size={15} fill={C.textMuted} anchor="end" tracking={0.12}>
          {COPY.panelMeta}
        </MonoLabel>
        <Hairline x1={box.x + 40} y={box.y + 72} x2={box.x + box.w - 40} progress={headerIn} color={C.border} weight={1.4} />
      </g>
      <g opacity={moreIn}>
        <rect x={box.x + box.w - 40 - moreW - 34} y={box.y + 30} width={moreW + 34} height={34} rx={17} fill={C.surfaceHover} stroke={C.border} strokeWidth={1.2} />
        <MonoLabel x={box.x + box.w - 40 - moreW - 17} y={box.y + 52} size={16} fill={C.textSecondary} tracking={0.08}>
          {'+6'}
        </MonoLabel>
      </g>
      <rect x={box.x + 40 - 26} y={box.y + 52 - 13} width={9} height={9} rx={2} fill={C.accentText} opacity={headerIn} />
    </g>
  );
}

function BigType({frame, o}: {frame: number; o: LayoutKey}) {
  const pos = o === 'h' ? {x: 140, y1: 780, y2: 876, size: 84} : {x: 84, y1: 1580, y2: 1676, size: 80};
  const m1 = ease(frame, CUES.everyItem, 22, EASE_EXPO);
  const m2 = ease(frame, CUES.everyItem + 10, 22, EASE_EXPO);
  const w1 = measureTracked(COPY.reasonLine1, 'sans800', pos.size, -0.03);
  const w2 = measureTracked(COPY.reasonLine2, 'sans800', pos.size, -0.03);
  return (
    <g>
      <MaskReveal id={`r4a-${o}`} x={pos.x - 8} y={pos.y1 - pos.size} w={w1 + 24} h={pos.size * 1.3} progress={m1} direction="up">
        <FilmText x={pos.x} y={pos.y1} spec="display" size={pos.size} fill={C.text}>
          {COPY.reasonLine1}
        </FilmText>
      </MaskReveal>
      <MaskReveal id={`r4b-${o}`} x={pos.x - 8} y={pos.y2 - pos.size} w={w2 + 24} h={pos.size * 1.3} progress={m2} direction="up">
        <FilmText x={pos.x} y={pos.y2} spec="display" size={pos.size} fill={C.text}>
          {COPY.reasonLine2}
        </FilmText>
      </MaskReveal>
    </g>
  );
}

/** Scene 3's whole composition exits as the interface takes over. */
function ExitPrev({frame, o}: {frame: number; o: LayoutKey}) {
  const out = 1 - ease(frame, 450, 18, EASE_EXPO);
  if (out <= 0) return null;
  return (
    <g opacity={out}>
      <AsideHeadline frame={450} o={o} />
      <Structure frame={450} o={o} />
      <Sources frame={450} o={o} />
      {o === 'h' ? (
        <g>
          <FilmText x={140} y={780} spec="display" size={84} fill={C.text}>
            {COPY.orderLine1}
          </FilmText>
          <FilmText x={140} y={876} spec="display" size={84} fill={C.text}>
            {COPY.orderLine2}
          </FilmText>
        </g>
      ) : (
        <g>
          <FilmText x={84} y={1560} spec="display" size={80} fill={C.text}>
            {COPY.orderLine1}
          </FilmText>
          <FilmText x={84} y={1656} spec="display" size={80} fill={C.text}>
            {COPY.orderLine2}
          </FilmText>
        </g>
      )}
    </g>
  );
}

export function Scene4H({frame, fps}: {frame: number; fps: number}) {
  return (
    <g>
      <ExitPrev frame={frame} o="h" />
      <PanelShell frame={frame} o="h" />
      <TileMorph frame={frame} o="h" />
      <Rows frame={frame} fps={fps} o="h" />
      <BigType frame={frame} o="h" />
    </g>
  );
}

export function Scene4V({frame, fps}: {frame: number; fps: number}) {
  return (
    <g>
      <ExitPrev frame={frame} o="v" />
      <PanelShell frame={frame} o="v" />
      <TileMorph frame={frame} o="v" />
      <Rows frame={frame} fps={fps} o="v" />
      <BigType frame={frame} o="v" />
    </g>
  );
}
