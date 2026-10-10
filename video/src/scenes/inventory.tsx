import {C, STROKE} from '../brand/tokens';
import {COPY} from '../brand/copy';
import {CUES, SCENES} from '../brand/timeline';
import {measureTracked} from '../brand/textMetrics';
import {FilmText, MonoLabel, MaskReveal, Hairline} from '../components/primitives';
import {AssetTile, BackForm} from '../components/assets';
import {ASSETS, LAYOUT, type LayoutKey} from './data';
import {bezierPoint, cubicPath, ease, fadeIn, stagger, EASE_EXPO} from '../lib/anim';

/**
 * SCENE 2 — THE FORGOTTEN INVENTORY (0:04–0:09)
 *
 * The headline shrinks into the corner and becomes a compositional element.
 * The field unfolds: ten original asset tiles travel structured paths in
 * from off-frame, some emerging from behind two large outlined forms, and
 * settle into a deliberately loose constellation. Blue hairlines connect
 * related items; orange flags the two that were overlooked.
 */

/** Pairs connected by blue hairlines in the field. */
const LINKS: [number, number][] = [
  [0, 1],
  [2, 3],
  [5, 6],
  [7, 8],
];

const FORMS = {
  h: [
    {x: 1180, y: 480, size: 560, rot: 8},
    {x: 1560, y: 780, size: 340, rot: -6},
  ],
  v: [
    {x: 540, y: 760, size: 560, rot: 8},
    {x: 420, y: 1180, size: 340, rot: -6},
  ],
} as const;

export function AsideHeadline({frame, o}: {frame: number; o: LayoutKey}) {
  const home = LAYOUT[o].headHome;
  const aside = LAYOUT[o].headAside;
  const t = ease(frame, SCENES.inventory.from, 30, EASE_EXPO);
  const x = home.x + (aside.x - home.x) * t;
  const y1 = home.y1 + (aside.y1 - home.y1) * t;
  const y2 = home.y2 + (aside.y2 - home.y2) * t;
  const size = home.size + (aside.size - home.size) * t;
  const bodyW = measureTracked('HAS LEFTOVERS', 'sans800', size, -0.03);
  return (
    <g>
      <FilmText x={x} y={y1} spec="display" size={size} fill={C.text} opacity={0.92}>
        {COPY.hookLine1}
      </FilmText>
      <FilmText x={x} y={y2} spec="display" size={size} fill={C.text} opacity={0.92}>
        HAS LEFTOVERS
      </FilmText>
      <FilmText x={x + bodyW + size * 0.03} y={y2} spec="display" size={size} fill={C.secondary}>
        .
      </FilmText>
    </g>
  );
}

function Field({frame, o}: {frame: number; o: LayoutKey}) {
  const forms = FORMS[o];
  const formIn = ease(frame, 6, 30, EASE_EXPO);
  return (
    <g>
      {forms.map((f, i) => (
        <BackForm key={i} x={f.x} y={f.y} size={f.size * (0.86 + 0.14 * formIn)} rotation={f.rot} opacity={0.85 * formIn} color={C.borderStrong} />
      ))}
      {/* connective hairlines, drawn under the tiles */}
      {LINKS.map(([a, b], i) => {
        const A = ASSETS[a].scatter[o];
        const B = ASSETS[b].scatter[o];
        const d = cubicPath([A[0], A[1]], [(A[0] + B[0]) / 2, A[1] - 60], [(A[0] + B[0]) / 2, B[1] + 60], [B[0], B[1]]);
        const len = Math.hypot(B[0] - A[0], B[1] - A[1]) * 1.25;
        const p = ease(frame, CUES.fieldPaths + stagger(i, 5), 26, EASE_EXPO);
        return <path key={i} d={d} fill="none" stroke={C.accentText} strokeWidth={STROKE.hairline} opacity={0.4} strokeDasharray={len} strokeDashoffset={len * (1 - p)} />;
      })}
      {ASSETS.map((a, i) => {
        const [sx, sy, ss, rot] = a.scatter[o];
        const at = CUES.fieldOpen + stagger(i, 4);
        const t = ease(frame, at, 30, EASE_EXPO);
        if (t <= 0) return null;
        /* Entries arc up from below the type band so tiles never cross the
           headline or the label column on their way in. */
        const from: [number, number] = o === 'h' ? [sx - 260, sy + 430] : [sx - 40, sy + 640];
        const ctrl1: [number, number] = o === 'h' ? [sx - 210, sy + 140] : [sx - 70, sy + 330];
        const ctrl2: [number, number] = o === 'h' ? [sx - 70, sy + 40] : [sx - 20, sy + 120];
        const [px, py] = bezierPoint(t, from, ctrl1, ctrl2, [sx, sy]);
        const scale = ss * (0.82 + 0.18 * t);
        const flaggedAt = a.flagged ? ease(frame, CUES.fieldFlag + stagger(i, 3), 16, EASE_EXPO) : 0;
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
            rotation={rot * t}
            opacity={t}
            flagged={flaggedAt > 0.5}
          />
        );
      })}
      {/* orange flag pop rings */}
      {ASSETS.filter((a) => a.flagged).map((a) => {
        const [sx, sy] = a.scatter[o];
        const g = bump01(frame, CUES.fieldFlag + 4, 22);
        if (g <= 0) return null;
        return <circle key={a.id} cx={sx} cy={sy} r={78 + 40 * g} fill="none" stroke={C.secondary} strokeWidth={1.4} opacity={0.35 * (1 - g)} />;
      })}
    </g>
  );
}

function bump01(frame: number, at: number, dur: number): number {
  const t = Math.min(1, Math.max(0, (frame - at) / dur));
  return t <= 0 || t >= 1 ? 0 : Math.sin(t * Math.PI);
}

export function Labels({frame, o}: {frame: number; o: LayoutKey}) {
  const x = LAYOUT[o].margin;
  const y0 = 420;
  return (
    <g>
      {COPY.fieldLabels.map((label, i) => {
        const o = fadeIn(frame, CUES.fieldPaths + 6 + stagger(i, 7), 18);
        const w = measureTracked(label, 'mono400', 17, 0.16);
        return (
          <g key={label} opacity={o}>
            <rect x={x} y={y0 + i * 44 - 12} width={8} height={8} rx={2} fill={i === 1 ? C.secondary : C.accentText} />
            <MonoLabel x={x + 22} y={y0 + i * 44} size={17} fill={C.textSecondary} tracking={0.16}>
              {label}
            </MonoLabel>
            <Hairline x1={x + 22} y={y0 + i * 44 + 10} x2={x + 22 + w} progress={1} color={C.border} weight={1} />
          </g>
        );
      })}
    </g>
  );
}

export function FindLines({frame, o}: {frame: number; o: LayoutKey}) {
  const pos = o === 'h' ? {x: 140, y1: 812, y2: 908, size: 84} : {x: 84, y1: 1560, y2: 1656, size: 80};
  const m1 = ease(frame, CUES.findThings, 22, EASE_EXPO);
  const m2 = ease(frame, CUES.findThings + 10, 22, EASE_EXPO);
  const w1 = measureTracked(COPY.findLine1, 'sans800', pos.size, -0.03);
  const w2 = measureTracked(COPY.findLine2, 'sans800', pos.size, -0.03);
  return (
    <g>
      <MaskReveal id={`f2a-${o}`} x={pos.x - 8} y={pos.y1 - pos.size} w={w1 + 24} h={pos.size * 1.3} progress={m1} direction="up">
        <FilmText x={pos.x} y={pos.y1} spec="display" size={pos.size} fill={C.text}>
          {COPY.findLine1}
        </FilmText>
      </MaskReveal>
      <MaskReveal id={`f2b-${o}`} x={pos.x - 8} y={pos.y2 - pos.size} w={w2 + 24} h={pos.size * 1.3} progress={m2} direction="up">
        <FilmText x={pos.x} y={pos.y2} spec="display" size={pos.size} fill={C.text}>
          {COPY.findLine2}
        </FilmText>
      </MaskReveal>
    </g>
  );
}

export function Scene2H({frame}: {frame: number}) {
  return (
    <g>
      <AsideHeadline frame={frame} o="h" />
      <Labels frame={frame} o="h" />
      <Field frame={frame} o="h" />
      <FindLines frame={frame} o="h" />
    </g>
  );
}

export function Scene2V({frame}: {frame: number}) {
  return (
    <g>
      <AsideHeadline frame={frame} o="v" />
      <Labels frame={frame} o="v" />
      <Field frame={frame} o="v" />
      <FindLines frame={frame} o="v" />
    </g>
  );
}

