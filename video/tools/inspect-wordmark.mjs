// Inspection helper: reports the subpath (glyph) structure of the outlined
// wordmark so the Wordmark component can reveal letters individually.
import {readFileSync} from 'node:fs';

const src = readFileSync('src/brand/logoGeometry.ts', 'utf8');
const start = src.indexOf('export const LOGO_GLYPHS: GlyphPath[] = ');
const eq = src.indexOf('=', start);
const arrStart = src.indexOf('[', eq);
const arrEnd = src.indexOf('];', arrStart);
const glyphs = JSON.parse(src.slice(arrStart, arrEnd + 1));

const g = glyphs[0];
const subs = g.d.match(/M[^M]+/g) || [];
console.log('paths:', glyphs.length, '| translate:', g.tx, g.ty, '| fill:', g.fill);
console.log('subpaths (letters):', subs.length);
const ranges = subs.map((s, i) => {
  const pairs = [...s.matchAll(/(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/g)].map((m) => [+m[1], +m[2]]);
  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  return {
    i,
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
});
console.table(ranges);
console.log('letter x-starts for stagger:', ranges.map((r) => r.minX.toFixed(1)).join(', '));
