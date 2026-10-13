// Dumps every string value in COPY (evaluating copy.ts as plain JS) so the
// metrics generator measures exactly the strings the film puts on screen.
import {readFileSync, writeFileSync} from 'node:fs';

let src = readFileSync('src/brand/copy.ts', 'utf8');
src = src.replace('export const COPY =', 'const COPY =').replace(/ as const/g, '');
const COPY = new Function(src + '\nreturn COPY;')();

const out = [];
const walk = (v) => {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === 'object') Object.values(v).forEach(walk);
};
walk(COPY);
writeFileSync('tools/_copy-strings.json', JSON.stringify([...new Set(out)]));
console.log('dumped', new Set(out).size, 'unique copy strings');
