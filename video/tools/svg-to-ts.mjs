// Converts the real brand-kit SVGs into typed, per-element data so every
// tile of the CULLER mark and every letter of the wordmark can be animated
// independently while staying pixel-identical to the source artwork.
//
// Usage: node tools/svg-to-ts.mjs   (run from video/)
import {readFileSync, writeFileSync} from 'node:fs';

const KIT = '../culler-brand-kit/culler-brand-kit/svg';

function parseRects(svg) {
  const out = [];
  const re = /<rect\s+([^>]*?)\/>/g;
  let m;
  while ((m = re.exec(svg))) {
    const attrs = Object.fromEntries(
      [...m[1].matchAll(/([a-z-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]),
    );
    const t = attrs.transform || '';
    const tr = /translate\(([-\d.]+)\s+([-\d.]+)\)/.exec(t);
    const rot = /rotate\(([-\d.]+)\)/.exec(t);
    out.push({
      x: +attrs.x,
      y: +attrs.y,
      w: +attrs.width,
      h: +attrs.height,
      rx: +attrs.rx,
      fill: attrs.fill,
      opacity: attrs['fill-opacity'] ? +attrs['fill-opacity'] : 1,
      tx: tr ? +tr[1] : 0,
      ty: tr ? +tr[2] : 0,
      rot: rot ? +rot[1] : 0,
    });
  }
  return out;
}

function parsePaths(svg) {
  const out = [];
  const re = /<path\s+([^>]*?)\/>/g;
  let m;
  while ((m = re.exec(svg))) {
    const attrs = Object.fromEntries(
      [...m[1].matchAll(/([a-z-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]),
    );
    const t = attrs.transform || '';
    const tr = /translate\(([-\d.]+)\s+([-\d.]+)\)/.exec(t);
    out.push({d: attrs.d, fill: attrs.fill, tx: tr ? +tr[1] : 0, ty: tr ? +tr[2] : 0});
  }
  return out;
}

function viewBox(svg) {
  const m = /viewBox="([-\d.\s]+)"/.exec(svg);
  return m[1].trim().split(/\s+/).map(Number);
}

const read = (f) => readFileSync(KIT + '/' + f, 'utf8');

const markSvg = read('culler-mark-on-dark.svg');
const logoDarkSvg = read('culler-logo-on-dark.svg');
const logoLightSvg = read('culler-logo-on-light.svg');

const markTiles = parseRects(markSvg);
const logoTiles = parseRects(logoDarkSvg);
const logoGlyphs = parsePaths(logoDarkSvg);
const lightGlyphs = parsePaths(logoLightSvg);

const lines = [];
lines.push('/**');
lines.push(' * Authentic CULLER brand geometry, extracted verbatim from the vector masters');
lines.push(' * in culler-brand-kit/culler-brand-kit/svg/ by tools/svg-to-ts.mjs.');
lines.push(' *');
lines.push(' * Do not hand-edit. Regenerate with: node tools/svg-to-ts.mjs');
lines.push(' *');
lines.push(' * MARK_TILES   - the rounded squares that form the "C" symbol. Each keeps its');
lines.push(' *                own position, rotation, size, blue-ramp colour and opacity so');
lines.push(' *                the mark can be assembled tile by tile.');
lines.push(' * LOGO_GLYPHS  - the outlined lowercase "culler" lettering (Plus Jakarta Sans');
lines.push(' *                Bold converted to outlines, per the brand kit). Real vector');
lines.push(' *                outlines, so the wordmark stays flat, crisp and font-independent.');
lines.push(' */');
lines.push('');
lines.push('export type MarkTile = {');
lines.push('  x: number;');
lines.push('  y: number;');
lines.push('  w: number;');
lines.push('  h: number;');
lines.push('  rx: number;');
lines.push('  fill: string;');
lines.push('  opacity: number;');
lines.push('  tx: number;');
lines.push('  ty: number;');
lines.push('  rot: number;');
lines.push('};');
lines.push('');
lines.push('export type GlyphPath = {d: string; fill: string; tx: number; ty: number};');
lines.push('');
lines.push('export const MARK_VIEWBOX = ' + JSON.stringify(viewBox(markSvg)) + ';');
lines.push('export const LOGO_VIEWBOX = ' + JSON.stringify(viewBox(logoDarkSvg)) + ';');
lines.push('');
lines.push('/** Symbol only. ' + markTiles.length + ' tiles. */');
lines.push('export const MARK_TILES: MarkTile[] = ' + JSON.stringify(markTiles, null, 2) + ';');
lines.push('');
lines.push('/** Full logo symbol tiles (' + logoTiles.length + ') — same ramp as MARK_TILES. */');
lines.push('export const LOGO_TILES: MarkTile[] = ' + JSON.stringify(logoTiles, null, 2) + ';');
lines.push('');
lines.push('/** Outlined wordmark for dark backgrounds (' + logoGlyphs.length + ' path). */');
lines.push('export const LOGO_GLYPHS: GlyphPath[] = ' + JSON.stringify(logoGlyphs, null, 2) + ';');
lines.push('');
lines.push('/** Outlined wordmark for light backgrounds (' + lightGlyphs.length + ' path). */');
lines.push('export const LOGO_GLYPHS_LIGHT: GlyphPath[] = ' + JSON.stringify(lightGlyphs, null, 2) + ';');
lines.push('');

writeFileSync('src/brand/logoGeometry.ts', lines.join('\n'));
console.log(
  'wrote src/brand/logoGeometry.ts:',
  markTiles.length + ' mark tiles,',
  logoTiles.length + ' logo tiles,',
  logoGlyphs.length + ' dark glyphs,',
  lightGlyphs.length + ' light glyphs,',
  Math.round(lines.join('\n').length / 1024) + 'KB',
);
