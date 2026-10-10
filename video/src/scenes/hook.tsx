import {C, STROKE} from '../brand/tokens';
import {COPY} from '../brand/copy';
import {CUES} from '../brand/timeline';
import {measureTracked} from '../brand/textMetrics';
import {FilmText, MonoLabel, MaskReveal, Hairline} from '../components/primitives';
import {bump, ease, enter, fadeIn, springIn, stagger, EASE_EXPO} from '../lib/anim';

/**
 * SCENE 1 — THE HOOK (0:00–0:04)
 *
 * A quiet field on the product's own deep blue-black. Tiny account symbols
 * sit almost invisible at the edges. One overlooked item shifts into view.
 * Then the headline — the brand's own line — becomes the whole composition:
 * one line slides into position behind a directional mask, one line rises
 * through a clip mask, and the orange full stop lands as the only accent.
 * No logo, no tunnel.
 */

const EDGE = {
  h: [
    [1748, 148, 26, -8],
    [1836, 372, 20, 5],
    [1672, 968, 24, 10],
    [1332, 116, 18, -4],
    [248, 132, 22, 7],
    [116, 700, 18, -6],
    [436, 972, 24, 4],
    [972, 996, 18, -9],
  ],
  v: [
    [948, 216, 24, -8],
    [988, 512, 18, 5],
    [916, 1648, 24, 10],
    [148, 236, 20, -4],
    [112, 1180, 18, 7],
    [232, 1716, 24, 4],
    [700, 1788, 18, -9],
    [836, 132, 18, -6],
  ],
} as const;

const OVERLOOKED = {h: [1596, 812] as const, v: [836, 1452] as const};

function EdgeSymbols({frame, o}: {frame: number; o: 'h' | 'v'}) {
  return (
    <g>
      {EDGE[o].map(([x, y, s, rot], i) => {
        const o = 0.16 + 0.2 * fadeIn(frame, 6 + stagger(i, 3), 26);
        return (
          <rect
            key={i}
            x={-s / 2}
            y={-s / 2}
            width={s}
            height={s}
            rx={s * 0.3}
            fill="none"
            stroke={C.textMuted}
            strokeWidth={STROKE.hairline}
            opacity={o}
            transform={`translate(${x} ${y}) rotate(${rot})`}
          />
        );
      })}
    </g>
  );
}

function OverlookedItem({frame, fps, o}: {frame: number; fps: number; o: 'h' | 'v'}) {
  const [bx, by] = OVERLOOKED[o];
  const nudge = ease(frame, CUES.firstNudge, 22, EASE_EXPO);
  const x = bx - 22 * (1 - nudge);
  const glow = bump(frame, CUES.firstNudge + 16, 26);
  const labelIn = fadeIn(frame, CUES.firstNudge + 30, 18);
  const labelW = measureTracked(COPY.hookOverlookedLabel, 'mono400', 16, 0.14);
  return (
    <g>
      {glow > 0 ? (
        <circle cx={x} cy={by} r={46 + 26 * glow} fill="none" stroke={C.accentText} strokeWidth={1.2} opacity={0.28 * (1 - glow)} />
      ) : null}
      <rect
        x={x - 24}
        y={by - 24}
        width={48}
        height={48}
        rx={14}
        fill={C.surface}
        stroke={C.accentText}
        strokeWidth={STROKE.thin}
        opacity={0.35 + 0.65 * nudge}
      />
      <circle cx={x} cy={by} r={4.5} fill={C.accentText} opacity={0.4 + 0.6 * nudge} />
      <circle cx={x + 24 - 9} cy={by - 24 + 9} r={3.4 * springIn(frame, CUES.firstNudge + 14, fps)} fill={C.secondary} />
      <MonoLabel x={x + 38} y={by - 22} size={16} fill={C.textSecondary} opacity={labelIn} tracking={0.14}>
        {COPY.hookOverlookedLabel}
      </MonoLabel>
      <Hairline x1={x + 38} y={by - 8} x2={x + 38 + labelW} progress={labelIn} color={C.border} weight={1.2} />
    </g>
  );
}

function Headline({frame, fps, o}: {frame: number; fps: number; o: 'h' | 'v'}) {
  const pos = o === 'h' ? {x: 140, y1: 500, y2: 648, size: 132} : {x: 84, y1: 700, y2: 836, size: 116};
  const w1 = enter(frame, CUES.headlineWord1, 24, -84, 0);
  const m1 = ease(frame, CUES.headlineWord1, 24, EASE_EXPO);
  const m2 = ease(frame, CUES.headlineWord2, 26, EASE_EXPO);
  const stopPop = springIn(frame, CUES.headlinePunch, fps, {damping: 12, stiffness: 220, mass: 0.7, overshoot: false});
  const bodyW = measureTracked('HAS LEFTOVERS', 'sans800', pos.size, -0.03);
  const lineW = measureTracked(COPY.hookLine1, 'sans800', pos.size, -0.03);
  return (
    <g>
      <MaskReveal id={`h1a-${o}`} x={pos.x - 90} y={pos.y1 - pos.size} w={lineW + 120} h={pos.size * 1.3} progress={m1} direction="right">
        <FilmText x={pos.x + w1} y={pos.y1} spec="display" size={pos.size} fill={C.text}>
          {COPY.hookLine1}
        </FilmText>
      </MaskReveal>
      <MaskReveal id={`h1b-${o}`} x={pos.x - 10} y={pos.y2 - pos.size} w={bodyW + measureTracked('.', 'sans800', pos.size, -0.03) + 30} h={pos.size * 1.3} progress={m2} direction="up">
        <FilmText x={pos.x} y={pos.y2} spec="display" size={pos.size} fill={C.text}>
          HAS LEFTOVERS
        </FilmText>
      </MaskReveal>
      <g transform={`translate(${pos.x + bodyW + 4} ${pos.y2}) scale(${0.4 + 0.6 * stopPop})`}>
        <FilmText x={0} y={0} spec="display" size={pos.size} fill={C.secondary}>
          .
        </FilmText>
      </g>
    </g>
  );
}

export function Scene1H({frame, fps}: {frame: number; fps: number}) {
  const kicker = fadeIn(frame, 10, 20);
  return (
    <g>
      <EdgeSymbols frame={frame} o="h" />
      <OverlookedItem frame={frame} fps={fps} o="h" />
      <MonoLabel x={140} y={172} size={18} fill={C.textMuted} opacity={kicker} tracking={0.22}>
        {COPY.hookMicro}
      </MonoLabel>
      <rect x={140 - 26} y={172 - 13} width={9} height={9} rx={2} fill={C.accentText} opacity={kicker} />
      <Headline frame={frame} fps={fps} o="h" />
    </g>
  );
}

export function Scene1V({frame, fps}: {frame: number; fps: number}) {
  const kicker = fadeIn(frame, 10, 20);
  return (
    <g>
      <EdgeSymbols frame={frame} o="v" />
      <OverlookedItem frame={frame} fps={fps} o="v" />
      <MonoLabel x={84} y={236} size={18} fill={C.textMuted} opacity={kicker} tracking={0.22}>
        {COPY.hookMicro}
      </MonoLabel>
      <rect x={84 - 26} y={236 - 13} width={9} height={9} rx={2} fill={C.accentText} opacity={kicker} />
      <Headline frame={frame} fps={fps} o="v" />
    </g>
  );
}
