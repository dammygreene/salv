import {C, r as rad, STROKE} from '../brand/tokens';
import {COPY} from '../brand/copy';
import {CUES} from '../brand/timeline';
import {measureTracked} from '../brand/textMetrics';
import {FilmText, MonoLabel, MaskReveal, Hairline, VHairline} from '../components/primitives';
import {AssetIcon, AssetTile} from '../components/assets';
import {ASSETS, gridSlot, type LayoutKey} from './data';
import {ease, fadeIn, EASE_EXPO} from '../lib/anim';

/**
 * SCENE 5 — CULL. VERIFY. REWARD. (0:22–0:28)
 *
 * Three typographic beats with one visual idea each, on a rhythm of 60
 * frames. Deliberately quiet: no counters, no coins, no price lines.
 *   CULL   — the ordered inventory, with the leftovers separated from the
 *            kept. A decision, not an action: nothing is deleted on screen.
 *   VERIFY — one row passes a clean confirmation treatment and a drawn
 *            check lands, exactly like the product's own draw-check.
 *   REWARD — resolves into a single restrained orange rule and a ledger
 *            line. The allocation is recorded; it is never shown as money.
 */

const BEATS = [CUES.cullBeat, CUES.verifyBeat, CUES.rewardBeat] as const;
const BEAT_LEN = 60;

function BeatType({frame, o}: {frame: number; o: LayoutKey}) {
  return (
    <g>
      {COPY.steps.map((step, i) => {
        const at = BEATS[i];
        const inT = ease(frame, at, 14, EASE_EXPO);
        const outT = ease(frame, at + BEAT_LEN - 8, 10, EASE_EXPO);
        const op = inT * (1 - outT);
        if (op <= 0.001) return null;
        const pos = o === 'h' ? {x: 140, yi: 320, yw: 486, ym: 552, ws: 168, ms: 20} : {x: 84, yi: 300, yw: 452, ym: 512, ws: 132, ms: 19};
        const lift = (1 - inT) * 40 - outT * 24;
        const w = measureTracked(step.word, 'sans800', pos.ws, -0.03);
        return (
          <g key={step.word} opacity={op} transform={`translate(0 ${lift})`}>
            <MonoLabel x={pos.x} y={pos.yi} size={26} fill={C.accentText} tracking={0.16}>
              {step.index}
            </MonoLabel>
            <MaskReveal id={`bt-${o}-${i}`} x={pos.x - 8} y={pos.yw - pos.ws} w={w + 24} h={pos.ws * 1.3} progress={inT} direction="up">
              <FilmText x={pos.x} y={pos.yw} spec="display" size={pos.ws} fill={C.text}>
                {step.word}
              </FilmText>
            </MaskReveal>
            <MonoLabel x={pos.x} y={pos.ym} size={pos.ms} fill={C.textSecondary} tracking={0.14} opacity={fadeIn(frame, at + 8, 14)}>
              {step.micro}
            </MonoLabel>
          </g>
        );
      })}
    </g>
  );
}

/** Beat 1 — separation of the leftovers from the ordered inventory. */
function CullVisual({frame, o}: {frame: number; o: LayoutKey}) {
  const at = BEATS[0];
  const inT = ease(frame, at, 16, EASE_EXPO);
  const outT = ease(frame, at + BEAT_LEN - 8, 10, EASE_EXPO);
  const op = inT * (1 - outT);
  if (op <= 0.001) return null;
  const center: [number, number] = o === 'h' ? [1420, 520] : [540, 1060];
  const scale = o === 'h' ? 0.8 : 0.72;
  const separated = [0, 5, 7];
  const sep = ease(frame, at + 16, 24, EASE_EXPO);
  const divider = ease(frame, at + 20, 20, EASE_EXPO);
  const noteIn = fadeIn(frame, at + 26, 16);
  const noteW = measureTracked(COPY.cullNote, 'mono400', 17, 0.12);
  const notePos: [number, number] = o === 'h' ? [1000, 830] : [84, 1480];
  return (
    <g opacity={op}>
      <g transform={`translate(${center[0]} ${center[1]}) scale(${scale}) translate(${-center[0]} ${-center[1]})`}>
        {ASSETS.map((a, i) => {
          const [gx, gy] = gridSlot(a.grid, o);
          const isSep = separated.includes(i);
          const dx = isSep ? -330 * sep : 0;
          const dy = isSep ? 210 * sep : 0;
          return (
            <AssetTile
              key={a.id}
              x={gx + dx}
              y={gy + dy}
              size={132}
              kind={a.kind}
              scale={1}
              opacity={isSep ? 1 - 0.35 * sep : 1}
              showText={false}
              flagged={isSep && sep > 0.4}
              fill={isSep ? C.surfaceSunken : C.surface}
            />
          );
        })}
        <VHairline x={center[0] - 392} y1={center[1] - 150} y2={center[1] + 330} progress={divider} color={C.secondary} weight={STROKE.thin} opacity={0.8} />
      </g>
      <MonoLabel x={notePos[0]} y={notePos[1]} size={17} fill={C.textMuted} opacity={noteIn} tracking={0.12}>
        {COPY.cullNote}
      </MonoLabel>
      <Hairline x1={notePos[0]} y={notePos[1] + 12} x2={notePos[0] + noteW} progress={noteIn} color={C.border} weight={1.2} />
    </g>
  );
}

/** Beat 2 — one row passes the confirmation treatment. */
function VerifyVisual({frame, o}: {frame: number; o: LayoutKey}) {
  const at = BEATS[1];
  const inT = ease(frame, at, 16, EASE_EXPO);
  const outT = ease(frame, at + BEAT_LEN - 8, 10, EASE_EXPO);
  const op = inT * (1 - outT);
  if (op <= 0.001) return null;
  const card = o === 'h' ? {x: 1000, y: 470, w: 780, h: 116} : {x: 84, y: 940, w: 912, h: 128};
  const sweep = ease(frame, at + 10, 20, EASE_EXPO);
  const check = ease(frame, at + 28, 16, EASE_EXPO);
  const noteIn = fadeIn(frame, at + 30, 16);
  const noteW = measureTracked(COPY.verifyNote, 'mono400', 17, 0.12);
  const row = COPY.rows[0];
  const badgeX = card.x + card.w - 66;
  const badgeY = card.y + card.h / 2;
  return (
    <g opacity={op}>
      <g opacity={inT}>
        <rect x={card.x} y={card.y} width={card.w} height={card.h} rx={rad('lg')} fill={C.surface} stroke={C.border} strokeWidth={1.6} />
        <g transform={`translate(${card.x + 58} ${card.y + card.h / 2})`}>
          <AssetIcon kind="ACCOUNT" color={C.accentText} size={42} />
        </g>
        <FilmText x={card.x + 104} y={card.y + card.h / 2 - 8} spec="h3" size={30} fill={C.text}>
          {row.name}
        </FilmText>
        <MonoLabel x={card.x + 104} y={card.y + card.h / 2 + 24} size={16} fill={C.textMuted} tracking={0.06}>
          {row.meta}
        </MonoLabel>
        {/* the confirmation sweep — the film's single scan pass */}
        <Hairline x1={card.x + 24} y={card.y + card.h - 18} x2={card.x + card.w - 24} progress={sweep} color={C.accentText} weight={STROKE.regular} opacity={0.9} />
        {/* drawn check, same gesture as the product's DrawCheck */}
        <g transform={`translate(${badgeX} ${badgeY})`}>
          <circle r={26} fill={C.accentSoft} stroke={C.borderAccent} strokeWidth={1.4} opacity={check} />
          <path
            d="M -10 0 L -3 8 L 11 -9"
            fill="none"
            stroke={C.accentText}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={34}
            strokeDashoffset={34 * (1 - check)}
            opacity={check}
          />
        </g>
      </g>
      <MonoLabel x={card.x} y={card.y + card.h + 52} size={17} fill={C.textMuted} opacity={noteIn} tracking={0.12}>
        {COPY.verifyNote}
      </MonoLabel>
      <Hairline x1={card.x} y={card.y + card.h + 64} x2={card.x + noteW} progress={noteIn} color={C.border} weight={1.2} />
    </g>
  );
}

/** Beat 3 — the ledger line and one restrained orange rule. */
function RewardVisual({frame, o}: {frame: number; o: LayoutKey}) {
  const at = BEATS[2];
  const inT = ease(frame, at, 16, EASE_EXPO);
  const outT = ease(frame, at + BEAT_LEN - 6, 12, EASE_EXPO);
  const op = inT * (1 - outT);
  if (op <= 0.001) return null;
  const base: [number, number] = o === 'h' ? [1000, 500] : [84, 980];
  const lineIn = ease(frame, at + 14, 22, EASE_EXPO);
  const ptsIn = ease(frame, at + 26, 16, EASE_EXPO);
  const noteIn = fadeIn(frame, at + 30, 16);
  const actionW = measureTracked('CLOSE_EMPTY_TOKEN_ACCOUNT', 'mono400', 22, 0.08);
  const ptsW = measureTracked('BASE 100 PTS', 'mono400', 22, 0.08);
  const noteW = measureTracked(COPY.rewardNote, 'mono400', 17, 0.12);
  return (
    <g opacity={op}>
      <g opacity={inT}>
        <rect x={base[0]} y={base[1] - 30} width={10} height={10} rx={2.5} fill={C.secondary} />
        <MonoLabel x={base[0] + 30} y={base[1]} size={22} fill={C.text} tracking={0.08}>
          {'CLOSE_EMPTY_TOKEN_ACCOUNT'}
        </MonoLabel>
        <g opacity={ptsIn}>
          <rect x={base[0] + actionW + 60} y={base[1] - 32} width={ptsW + 36} height={44} rx={22} fill={C.secondarySoft} stroke={C.borderSecondary} strokeWidth={1.4} />
          <MonoLabel x={base[0] + actionW + 78} y={base[1]} size={22} fill={C.secondary} tracking={0.08}>
            {'BASE 100 PTS'}
          </MonoLabel>
        </g>
        <Hairline x1={base[0]} y={base[1] + 34} x2={base[0] + actionW + ptsW + 140} progress={lineIn} color={C.secondary} weight={STROKE.regular} />
        <MonoLabel x={base[0]} y={base[1] + 84} size={17} fill={C.textMuted} tracking={0.1} opacity={ptsIn}>
          {COPY.steps[2].micro}
        </MonoLabel>
      </g>
      <MonoLabel x={base[0]} y={base[1] + 150} size={17} fill={C.textMuted} opacity={noteIn} tracking={0.12}>
        {COPY.rewardNote}
      </MonoLabel>
      <Hairline x1={base[0]} y={base[1] + 162} x2={base[0] + noteW} progress={noteIn} color={C.border} weight={1.2} />
    </g>
  );
}

function ClosingLines({frame, o}: {frame: number; o: LayoutKey}) {
  const pos = o === 'h' ? {x: 140, y1: 760, y2: 856, size: 84} : {x: 84, y1: 1600, y2: 1696, size: 80};
  const m1 = ease(frame, CUES.clearProcess, 22, EASE_EXPO);
  const m2 = ease(frame, CUES.clearProcess + 10, 22, EASE_EXPO);
  const w1 = measureTracked(COPY.processLine1, 'sans800', pos.size, -0.03);
  const w2 = measureTracked(COPY.processLine2, 'sans800', pos.size, -0.03);
  return (
    <g>
      <MaskReveal id={`p5a-${o}`} x={pos.x - 8} y={pos.y1 - pos.size} w={w1 + 24} h={pos.size * 1.3} progress={m1} direction="up">
        <FilmText x={pos.x} y={pos.y1} spec="display" size={pos.size} fill={C.text}>
          {COPY.processLine1}
        </FilmText>
      </MaskReveal>
      <MaskReveal id={`p5b-${o}`} x={pos.x - 8} y={pos.y2 - pos.size} w={w2 + 24} h={pos.size * 1.3} progress={m2} direction="up">
        <FilmText x={pos.x} y={pos.y2} spec="display" size={pos.size} fill={C.text}>
          {COPY.processLine2}
        </FilmText>
      </MaskReveal>
    </g>
  );
}

export function Scene5H({frame}: {frame: number}) {
  return (
    <g>
      <CullVisual frame={frame} o="h" />
      <VerifyVisual frame={frame} o="h" />
      <RewardVisual frame={frame} o="h" />
      <BeatType frame={frame} o="h" />
      <ClosingLines frame={frame} o="h" />
    </g>
  );
}

export function Scene5V({frame}: {frame: number}) {
  return (
    <g>
      <CullVisual frame={frame} o="v" />
      <VerifyVisual frame={frame} o="v" />
      <RewardVisual frame={frame} o="v" />
      <BeatType frame={frame} o="v" />
      <ClosingLines frame={frame} o="v" />
    </g>
  );
}

