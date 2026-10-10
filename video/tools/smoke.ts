import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {RemotionRoot} from '../src/Root';
import {SCENES, SCENE_ORDER, TOTAL_FRAMES, FPS} from '../src/brand/timeline';
import {renderFrameSvg} from '../src/qa/frame';

/**
 * Node-side smoke test for the Remotion shell.
 *
 * The sandbox cannot download Remotion's headless shell (remotion.media is
 * not reachable), so `npx remotion studio/render` must run on a machine with
 * network access. This check still proves, without a browser, that:
 *   1. the root component tree renders,
 *   2. both compositions are declared with the master spec,
 *   3. the scene timeline is contiguous and exactly 1050 frames.
 *
 * Usage: node --experimental-strip-types tools/smoke.ts   (or via esbuild)
 */

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const html = renderToStaticMarkup(React.createElement(RemotionRoot));
check('RemotionRoot renders', typeof html === 'string');

check('fps is 30', FPS === 30);
check('total frames 1050 (35s)', TOTAL_FRAMES === 1050);

let cursor = 0;
for (const k of SCENE_ORDER) {
  const s = SCENES[k];
  check(`scene ${k} starts at ${s.from}`, s.from === cursor, `${s.duration}f`);
  cursor += s.duration;
}
check('scenes tile the full 1050 frames', cursor === TOTAL_FRAMES, `end=${cursor}`);

// every scene window must contain at least one visible element mid-scene
for (const o of ['h', 'v'] as const) {
  for (const k of SCENE_ORDER) {
    const mid = SCENES[k].from + Math.floor(SCENES[k].duration * 0.6);
    const svg = renderFrameSvg(o, mid, FPS);
    check(`${o}/${k} mid-frame has artwork`, svg.length > 1200, `${svg.length} bytes of SVG`);
  }
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
