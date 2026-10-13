/**
 * STATIC SOCIAL GRAPHIC — post 02 ("take a look at what you've been
 * leaving behind").
 *
 * Not motion graphics: one composed picture, rendered through the same
 * SSR-SVG → librsvg path as the film QA, so type, colour and the mark are
 * pixel-identical to the product and the film.
 *
 * Composition: the hidden-inventory field from the film, held still — a
 * dark cluster of forgotten wallet remnants around one small blue signal,
 * with the orange LEFTOVER among them — set against a stacked editorial
 * headline, the lockup and the site pill. Three lines of type, one URL.
 */
import {C, STROKE} from '../brand/tokens';
import {COPY} from '../brand/copy';
import {measure} from '../brand/textMetrics';
import {CullerLockup} from '../components/brand';
import {FilmText} from '../components/primitives';

export const SOCIAL_W = 1600;
export const SOCIAL_H = 900;

type Kind = 'coin' | 'frame' | 'empty' | 'frag';
/** angle°, distance from the signal, kind, size, ignition 0…1 */
const FIELD: [number, number, Kind, number, number][] = [
  [20, 122, 'coin', 46, 1],
  [75, 152, 'frame', 54, 0.9],
  [130, 132, 'empty', 40, 1],
  [185, 162, 'coin', 60, 0.8],
  [240, 142, 'frame', 48, 0.95],
  [300, 172, 'empty', 44, 0.75],
  [15, 318, 'frag', 26, 0.35],
  [100, 288, 'coin', 52, 0.3],
  [160, 302, 'frame', 58, 0.22],
  [210, 282, 'empty', 46, 0.3],
  [265, 302, 'coin', 44, 0.18],
  [320, 276, 'frag', 30, 0.4],
  [0, 332, 'frame', 40, 0.12],
  [140, 362, 'frag', 24, 0.1],
];

/** deterministic dust — depth without noise */
const DUST: [number, number, number, number][] = [
  [842, 168, 1.6, 0.22], [968, 92, 1.2, 0.16], [1244, 78, 1.4, 0.2], [1462, 150, 1.2, 0.15],
  [1548, 300, 1.6, 0.2], [1520, 640, 1.3, 0.16], [1420, 764, 1.7, 0.22], [1180, 828, 1.3, 0.16],
  [942, 780, 1.5, 0.18], [806, 560, 1.2, 0.14], [760, 320, 1.4, 0.16], [1060, 210, 1.2, 0.14],
  [1310, 120, 1.2, 0.14], [880, 660, 1.1, 0.12], [1476, 486, 1.2, 0.14], [1024, 560, 1.1, 0.12],
];

const CX = 1180;
const CY = 424;

function Shape({x, y, kind, s, rev}: {x: number; y: number; kind: Kind; s: number; rev: number}) {
  const fill = C.surface;
  const fillOp = 0.12 + 0.5 * rev;
  const stroke = C.accentText;
  const strokeOp = 0.16 + 0.5 * rev;
  const w = STROKE.thin;
  return (
    <g transform={`translate(${x} ${y})`}>
      {rev > 0.5 && <circle r={s * 1.1} fill="url(#sg-sig)" opacity={0.2 * rev} />}
      {kind === 'coin' && (
        <>
          <circle r={s / 2} fill={fill} fillOpacity={fillOp} stroke={stroke} strokeOpacity={strokeOp} strokeWidth={w} />
          <circle r={s * 0.28} fill="none" stroke={stroke} strokeOpacity={strokeOp * 0.9} strokeWidth={w} />
        </>
      )}
      {kind === 'frame' && (
        <>
          <rect x={-s / 2} y={-s / 2} width={s} height={s} rx={s * 0.22} fill={fill} fillOpacity={fillOp} stroke={stroke} strokeOpacity={strokeOp} strokeWidth={w} />
          <rect x={-s * 0.28} y={-s * 0.28} width={s * 0.56} height={s * 0.56} rx={s * 0.12} fill="none" stroke={stroke} strokeOpacity={strokeOp * 0.85} strokeWidth={w} />
        </>
      )}
      {kind === 'empty' && (
        <rect x={-s / 2} y={-s / 2} width={s} height={s} rx={s * 0.24} fill={C.surfaceSunken} fillOpacity={0.25 + 0.3 * rev} stroke={stroke} strokeOpacity={strokeOp * 0.8} strokeWidth={w} strokeDasharray="6 9" />
      )}
      {kind === 'frag' && (
        <rect x={-s / 2} y={-s / 2} width={s} height={s} rx={s * 0.3} fill={fill} fillOpacity={fillOp} stroke={stroke} strokeOpacity={strokeOp} strokeWidth={w} />
      )}
    </g>
  );
}

export function PostGraphic() {
  const size = 96;
  const lh = 100;
  const x = 96;
  const base1 = 402;
  const lines = [COPY.social.line1, COPY.social.line2, COPY.social.line3];
  const last = lines[2];
  const track = -0.03 * size;
  const endX = x + measure(last, 'sans800', size) + track * (last.length - 1);
  const period = Math.round(size * 0.2);
  const urlW = measure(COPY.url, 'mono400', 24) + 0.01 * 24 * COPY.url.length;
  const pillW = Math.round(46 + urlW + 28);

  return (
    <g>
      <defs>
        <radialGradient id="sg-amb">
          <stop offset="0" stopColor={C.accent} stopOpacity={0.12} />
          <stop offset="1" stopColor={C.accent} stopOpacity={0} />
        </radialGradient>
        <radialGradient id="sg-sig">
          <stop offset="0" stopColor={C.accentText} stopOpacity={0.5} />
          <stop offset="1" stopColor={C.accentText} stopOpacity={0} />
        </radialGradient>
        <radialGradient id="sg-left">
          <stop offset="0" stopColor={C.secondary} stopOpacity={0.32} />
          <stop offset="1" stopColor={C.secondary} stopOpacity={0} />
        </radialGradient>
        <radialGradient id="sg-vig" cx="0.5" cy="0.5" r="0.72">
          <stop offset="0.62" stopColor="#04060c" stopOpacity={0} />
          <stop offset="1" stopColor="#04060c" stopOpacity={0.72} />
        </radialGradient>
      </defs>

      {/* ambient depth behind the cluster */}
      <ellipse cx={CX} cy={CY} rx={470} ry={400} fill="url(#sg-amb)" />

      {DUST.map(([dx, dy, dr, dop], i) => (
        <circle key={i} cx={dx} cy={dy} r={dr} fill={C.accentText} opacity={dop} />
      ))}

      {/* the hidden inventory, held still */}
      {FIELD.map(([a, d, kind, s, rev], i) => {
        const rad = (a * Math.PI) / 180;
        return <Shape key={i} x={CX + Math.cos(rad) * d} y={CY + Math.sin(rad) * d * 0.92} kind={kind} s={s} rev={rev} />;
      })}

      {/* the signal */}
      <circle cx={CX} cy={CY} r={74} fill="url(#sg-sig)" />
      <circle cx={CX} cy={CY} r={26} fill="none" stroke={C.accentText} strokeOpacity={0.35} strokeWidth={STROKE.hairline} />
      <circle cx={CX} cy={CY} r={8} fill={C.accentText} />
      <circle cx={CX} cy={CY} r={3.2} fill="#dce6ff" />

      {/* the LEFTOVER */}
      <g transform="translate(1322 548)">
        <circle r={50} fill="url(#sg-left)" />
        <rect x={-20} y={-20} width={40} height={40} rx={10} fill={C.secondary} />
        <rect x={-20} y={-20} width={40} height={40} rx={10} fill="none" stroke={C.secondaryHover} strokeOpacity={0.5} strokeWidth={STROKE.hairline} />
      </g>

      {/* lockup */}
      <CullerLockup x={x} y={104} markHeight={52} />

      {/* headline */}
      {lines.map((ln, i) => (
        <FilmText key={i} x={x} y={base1 + i * lh} spec="display" size={size} fill={C.text}>
          {ln}
        </FilmText>
      ))}
      <rect x={endX + 16} y={base1 + 2 * lh - period} width={period} height={period} rx={4.5} fill={C.secondary} />

      {/* site pill */}
      <g>
        <rect x={x} y={748} width={pillW} height={56} rx={28} fill={C.surface} fillOpacity={0.92} stroke={C.borderStrong} strokeWidth={STROKE.hairline} />
        <circle cx={x + 27} cy={776} r={5} fill={C.accentText} />
        <text x={x + 46} y={784} fontFamily="JetBrains Mono" fontSize={24} letterSpacing={0.24} fill={C.textSecondary}>
          {COPY.url}
        </text>
      </g>

      <rect width={SOCIAL_W} height={SOCIAL_H} fill="url(#sg-vig)" />
    </g>
  );
}
