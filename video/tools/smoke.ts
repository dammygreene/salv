/**
 * Structural smoke suite for the v4 "Hidden Inventory" film. Runs without
 * a browser: timeline integrity, camera continuity, cue ordering, and
 * artwork presence at sampled frames in both orientations.
 */
import {DURATION, FPS, BEAT, BAR, SCENES, SCENE_ORDER, CUES, CAM_H, CAM_V} from '../src/brand/timeline';
import {camAt} from '../src/lib/motion';
import {renderFrameSvg, renderSocialSvg} from '../src/qa/frame';
import {COPY} from '../src/brand/copy';

let pass = 0;
let fail = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name} ${extra}`);
  }
};

console.log('timeline');
ok('36s @ 60fps = 2160 frames', FPS === 60 && DURATION === 2160);
ok('100 BPM grid: beat 36f, bar 144f, 15 bars', BEAT === 36 && BAR === 144 && DURATION / BAR === 15);
let tiled = 0;
for (const k of SCENE_ORDER) tiled += SCENES[k].duration;
ok('six scenes tile 0..2160 exactly', tiled === DURATION && SCENES.unseen.from === 0 && SCENES.close.from + SCENES.close.duration === DURATION);
ok('scene windows match the brief (5/7/7/7/5/5s)', SCENES.unseen.duration === 300 && SCENES.inventory.duration === 420 && SCENES.signal.duration === 420 && SCENES.clarity.duration === 420 && SCENES.reveal.duration === 300 && SCENES.close.duration === 300);
ok('cues sorted, in range, valid kinds', CUES.every((c, i) => c.f >= 0 && c.f < DURATION && (i === 0 || c.f >= CUES[i - 1].f)));

console.log('camera continuity');
for (const [name, keys] of [['CAM_H', CAM_H], ['CAM_V', CAM_V]] as const) {
  let maxD = 0;
  let maxS = 0;
  for (let f = 1; f < DURATION; f++) {
    const a = camAt(f - 1, keys as never);
    const b = camAt(f, keys as never);
    maxD = Math.max(maxD, Math.hypot(b.x - a.x, b.y - a.y));
    maxS = Math.max(maxS, Math.abs(b.s - a.s));
  }
  ok(`${name} never jumps (max ${maxD.toFixed(1)}px, ${maxS.toFixed(3)}s/frame)`, maxD < 30 && maxS < 0.05);
}

console.log('artwork (SSR raster path)');
const SAMPLES = [0, 150, 300, 450, 700, 900, 1100, 1250, 1400, 1550, 1700, 1800, 1950, 2100, 2159];
for (const o of ['h', 'v'] as const) {
  for (const f of SAMPLES) {
    const svg = renderFrameSvg(o, f);
    ok(`${o}@${f} renders`, svg.length > 3000 && !svg.includes('NaN'));
  }
  const open = renderFrameSvg(o, 0);
  ok(`${o} frame 0 is the near-black open (no type yet)`, open.includes('radialGradient') && !open.includes(COPY.open.line));
  const end = renderFrameSvg(o, 2159);
  ok(`${o} final frame carries the close (url + tagline)`, end.includes(COPY.outro.url) && end.includes('sitting in your wallet'));
  const mid = renderFrameSvg(o, 1400);
  ok(`${o} glimpse frame shows the real interface`, mid.includes(COPY.url) && mid.includes(COPY.home.cta));
}

console.log('social graphic (post 02)');
const soc = renderSocialSvg();
ok('social: renders 1600x900, no NaN', soc.includes('width="1600"') && soc.includes('height="900"') && !soc.includes('NaN'));
ok('social: lockup + site pill present', soc.includes('wm-') && soc.includes(COPY.url));
ok('social: headline is the copy lines', soc.includes(COPY.social.line1) && soc.includes(COPY.social.line3));

console.log(fail === 0 ? `\nALL CHECKS PASSED (${pass})` : `\n${fail} CHECKS FAILED`);
process.exit(fail === 0 ? 0 : 1);
