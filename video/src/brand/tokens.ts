/**
 * CULLER — Motion Design Tokens
 * =============================
 * Every value here is lifted from the live CULLER product, not invented.
 *
 * Source of truth:
 *   • src/styles/tokens.css          — surfaces, text, borders, radii, accents,
 *                                      status colours, type scale, easing.
 *   • src/styles/base.css            — the `.display` headline treatment
 *                                      (Plus Jakarta Sans 800, -0.03em tracking).
 *   • src/styles/components.css      — status badge + asset card geometry.
 *   • culler-brand-kit/…/README.md   — logo tile gradient (#4468FF → #B4C8FF),
 *                                      Ink #0A0E1A, Paper #F4F7FF.
 *   • src/lib/types.ts               — AssetStatus / AssetKind / ScanState enums.
 *   • src/lib/data.ts                — assetStatusLabel, scanStateLabel, howItWorks.
 *   • src/lib/cull/registry.ts       — what CULLER actually supports today.
 *
 * Rule carried over from tokens.css: pure #0000ff reads very dark against the
 * near-black base, so thin lines, small text, paths and progress fills use the
 * lifted tint #4d7aff. Large solid fills may use the pure accent. That
 * distinction is preserved in `blue` below and used consistently across scenes.
 */

/** The product's own colour-scheme name — the site is `color-scheme: dark`. */
export const COLOR_SCHEME = 'dark' as const;

export const C = {
  /* ── surfaces (tokens.css) ───────────────────────────── */
  bg: '#0a0e1b',
  bgRaised: '#0d1322',
  surface: '#121a2c',
  surfaceHover: '#182238',
  surfaceSunken: '#0b0f1c',

  /* ── borders (tokens.css, rgba values) ───────────────── */
  border: 'rgba(150, 180, 255, 0.1)',
  borderStrong: 'rgba(150, 180, 255, 0.2)',
  borderAccent: 'rgba(70, 100, 255, 0.55)',

  /* ── text (tokens.css) ───────────────────────────────── */
  text: '#f3f5fa',
  textSecondary: '#9aa6c3',
  textMuted: '#5f6a88',
  textOnAccent: '#ffffff',
  /** tokens.css: orange pairs with dark text, not white. */
  textOnSecondary: '#1a0d00',

  /* ── blue: primary brand anchor (tokens.css) ─────────── */
  /** Large solid fills, shapes, mapping surfaces. */
  accent: '#0000ff',
  accentHover: '#2a4bff',
  /** Lifted tint — thin lines, small text, paths, progress fills. */
  accentText: '#4d7aff',
  accentTextHover: '#86a8ff',
  accentSoft: 'rgba(0, 0, 255, 0.16)',
  accentSoftStrong: 'rgba(0, 0, 255, 0.28)',

  /* ── orange: the action colour (tokens.css) ──────────── */
  secondary: '#ff7a1a',
  secondaryHover: '#ff9142',
  secondarySoft: 'rgba(255, 122, 26, 0.14)',
  secondarySoftStrong: 'rgba(255, 122, 26, 0.3)',
  borderSecondary: 'rgba(255, 141, 56, 0.5)',

  /* ── live / in-progress indicator (tokens.css) ───────── */
  data: '#5ab6ff',
  dataSoft: 'rgba(90, 182, 255, 0.14)',

  /* ── status (tokens.css + components.css badges) ─────── */
  ok: '#34d399',
  okSoft: 'rgba(52, 211, 153, 0.14)',
  warn: '#fbbf24',
  warnSoft: 'rgba(251, 191, 36, 0.14)',
  danger: '#f87171',
  dangerSoft: 'rgba(248, 113, 113, 0.14)',

  /* ── brand-kit logo ramp (culler-brand-kit README) ───── */
  logoTileDeep: '#4468FF',
  logoTileMid: '#5C82FF',
  logoTileLight: '#B4C8FF',
  brandBlue: '#3B63FF',
  blueDeep: '#2339D6',
  blueLight: '#A8C0FF',
  ink: '#0A0E1A',
  paper: '#F4F7FF',
} as const;

/** Status badge colours, exactly as components.css maps each AssetStatus. */
export const STATUS_COLOR = {
  CULLABLE: {fg: C.ok, bg: C.okSoft, border: 'rgba(52, 211, 153, 0.3)'},
  WATCH: {fg: C.warn, bg: C.warnSoft, border: 'rgba(251, 191, 36, 0.3)'},
  REVIEW: {fg: C.data, bg: C.dataSoft, border: 'rgba(79, 209, 255, 0.3)'},
  KEEP: {fg: C.textMuted, bg: C.surfaceHover, border: C.border},
} as const;

/** Radii (tokens.css). Scaled up for 1920×1080 film frames by `r()`. */
export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

/**
 * The product's radii are authored for a ~1440px-wide CSS viewport. On a
 * 1920px film frame the same UI is drawn larger, so radii scale with it —
 * this keeps corner curvature proportional to the product's own look rather
 * than looking pinched.
 */
export const FILM_RADIUS_SCALE = 1.6;
export const r = (token: keyof typeof RADIUS): number => {
  const value = RADIUS[token];
  return value >= 999 ? 999 : Math.round(value * FILM_RADIUS_SCALE);
};

export const SHADOW = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
  md: '0 12px 32px rgba(0, 0, 0, 0.45)',
  lg: '0 24px 64px rgba(0, 0, 0, 0.55)',
  accent: '0 8px 24px rgba(255, 122, 26, 0.35)',
} as const;

/**
 * Typography — tokens.css declares exactly two families:
 *   --font-sans: "Plus Jakarta Sans"  (everything, incl. display at weight 800)
 *   --font-mono: "JetBrains Mono"     (addresses, hashes, technical labels only)
 * The brand kit confirms the wordmark is Plus Jakarta Sans Bold, lowercase.
 */
export const FONT = {
  sans: 'Plus Jakarta Sans',
  mono: 'JetBrains Mono',
} as const;

/** Type scale, remapped from tokens.css's clamp() range to fixed film sizes. */
export const TYPE = {
  /** `.display` — hero headline only. base.css: weight 800, -0.03em, lh 1.04. */
  display: {family: FONT.sans, weight: 800, tracking: '-0.03em', lineHeight: 1.04},
  h1: {family: FONT.sans, weight: 700, tracking: '-0.02em', lineHeight: 1.08},
  h2: {family: FONT.sans, weight: 700, tracking: '-0.01em', lineHeight: 1.15},
  h3: {family: FONT.sans, weight: 600, tracking: '-0.01em', lineHeight: 1.2},
  body: {family: FONT.sans, weight: 500, tracking: '0em', lineHeight: 1.6},
  strong: {family: FONT.sans, weight: 700, tracking: '0em', lineHeight: 1.3},
  /** Technical labels, identifiers, status + diagnostic text. */
  label: {family: FONT.mono, weight: 400, tracking: '0.06em', lineHeight: 1.4},
  mono: {family: FONT.mono, weight: 400, tracking: '0.01em', lineHeight: 1.4},
} as const;

/**
 * Motion tokens, derived from the product's own easing + duration values in
 * tokens.css and re-expressed in frames at 30fps.
 *   --ease:        cubic-bezier(0.16, 1, 0.3, 1)   → t-fast 150ms / base 250ms / slow 450ms
 *   --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)
 * At 30fps: 150ms ≈ 4.5f, 250ms ≈ 7.5f, 450ms ≈ 13.5f.
 */
export const MOTION = {
  /** Remotion spring configs. damping chosen to match the product's easing feel. */
  snap: {damping: 200, mass: 0.7, stiffness: 120, overshootClamping: true},
  settle: {damping: 26, mass: 0.9, stiffness: 130},
  glide: {damping: 40, mass: 1.1, stiffness: 70},
  /** CSS cubic-bezier(0.16, 1, 0.3, 1) — used for Easing.bezier() calls. */
  easeExpo: [0.16, 1, 0.3, 1] as const,
  /** CSS cubic-bezier(0.34, 1.56, 0.64, 1) */
  easeSpringCss: [0.34, 1.56, 0.64, 1] as const,
  fast: 5,
  base: 8,
  slow: 14,
} as const;

/** Hairline stroke weight used by every panel, icon, path and divider. */
export const STROKE = {
  hairline: 1.6,
  thin: 2,
  regular: 2.6,
  bold: 3.4,
} as const;

/** 8px base grid — the product's spacing rhythm, scaled for film frames. */
export const GRID = 8 * FILM_RADIUS_SCALE;
