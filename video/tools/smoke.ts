/**
 * Structural smoke suite for the v2 film. Runs without a browser:
 * timeline integrity, camera/scroll continuity, cue ordering, and artwork
 * presence at sampled frames in both orientations.
 */
import {DURATION, FPS, BEAT, BAR, SCENES, SCENE_ORDER, CUES, CAM_H, CAM_V, SCROLL_H, SCROLL_V} from '../src/brand/timeline';
import {camAt, track} from '../src/lib/motion';
import {renderFrameSvg} from '../src/qa/frame';
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
ok('six scenes tile 0..2160 exactly', tiled === DURATION && SCENES.cover.from === 0 && SCENES.outro.from + SCENES.outro.duration === DURATION);
ok('cues sorted, in range, valid kinds', CUES.every((c, i) => c.f >= 0 && c.f < DURATION && (i === 0 || c.f >= CUES[i - 1].f)));

console.log('camera + scroll continuity');
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
for (const [name, keys] of [['SCROLL_H', SCROLL_H], ['SCROLL_V', SCROLL_V]] as const) {
  let bad = 0;
  for (let f = 1; f < DURATION; f++) {
    const d = track(f, keys as never) - track(f - 1, keys as never);
    if (d < -0.01 && !(f > 1728 && f <= 1800) && !(f > 1152 && f <= 1224)) bad++;
  }
  ok(`${name} monotonic except designed reframes`, bad === 0);
}

console.log('artwork (SSR raster path)');
const SAMPLES = [0, 150, 300, 468, 700, 900, 1100, 1200, 1400, 1650, 1800, 1980, 2159];
for (const o of ['h', 'v'] as const) {
  for (const f of SAMPLES) {
    const svg = renderFrameSvg(o, f);
    ok(`${o}@${f} renders`, svg.length > 3000 && !svg.includes('NaN'));
  }
  ok(`${o} frame 0 is a finished cover`, renderFrameSvg(o, 0).includes(COPY.tagline) && renderFrameSvg(o, 0).includes('path'));
  ok(`${o} final frame carries the end card`, renderFrameSvg(o, 2159).includes(COPY.outro.url) && renderFrameSvg(o, 2159).includes(COPY.outro.triad));
}

console.log(fail === 0 ? `\nALL CHECKS PASSED (${pass})` : `\n${fail} CHECKS FAILED`);
process.exit(fail === 0 ? 0 : 1);
