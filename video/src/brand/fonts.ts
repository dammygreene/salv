/**
 * Brand type, self-hosted.
 *
 * The site self-hosts Plus Jakarta Sans + JetBrains Mono (see
 * src/styles/tokens.css --font-sans / --font-mono and public/fonts/). The
 * film uses the very same woff2 files, copied into video/public/fonts, so
 * the render never depends on a font CDN and the letterforms are identical
 * to the product's.
 *
 * `FONT_FACE_CSS` is injected into the document for the browser render.
 * The QA rasteriser resolves the same family names through fontconfig
 * (see ~/.config/fontconfig/fonts.conf), which maps the @fontsource family
 * names back onto one family with real weights.
 */

export const FONT_FILES = {
  sans500: 'fonts/plus-jakarta-sans-500.woff2',
  sans700: 'fonts/plus-jakarta-sans-700.woff2',
  sans800: 'fonts/plus-jakarta-sans-800.woff2',
  mono400: 'fonts/jetbrains-mono-400.woff2',
} as const;

export const fontFaceCss = (resolve: (p: string) => string): string => `
@font-face { font-family: 'Plus Jakarta Sans'; font-style: normal; font-weight: 500; font-display: block; src: url('${resolve(FONT_FILES.sans500)}') format('woff2'); }
@font-face { font-family: 'Plus Jakarta Sans'; font-style: normal; font-weight: 700; font-display: block; src: url('${resolve(FONT_FILES.sans700)}') format('woff2'); }
@font-face { font-family: 'Plus Jakarta Sans'; font-style: normal; font-weight: 800; font-display: block; src: url('${resolve(FONT_FILES.sans800)}') format('woff2'); }
@font-face { font-family: 'JetBrains Mono'; font-style: normal; font-weight: 400; font-display: block; src: url('${resolve(FONT_FILES.mono400)}') format('woff2'); }
`;

/** The four faces the film must have loaded before frame 0. */
export const FONT_LOAD_SPECS = [
  {family: 'Plus Jakarta Sans', weight: 500},
  {family: 'Plus Jakarta Sans', weight: 700},
  {family: 'Plus Jakarta Sans', weight: 800},
  {family: 'JetBrains Mono', weight: 400},
] as const;
