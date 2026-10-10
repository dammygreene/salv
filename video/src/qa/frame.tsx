import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {SCENES, SCENE_ORDER, type SceneKey} from '../brand/timeline';
import {Backdrop} from '../Film';
import {Scene1H, Scene1V} from '../scenes/hook';
import {Scene2H, Scene2V} from '../scenes/inventory';
import {Scene3H, Scene3V} from '../scenes/order';
import {Scene4H, Scene4V} from '../scenes/reason';
import {Scene5H, Scene5V} from '../scenes/process';
import {Scene6H, Scene6V} from '../scenes/reveal';
import {Scene7H, Scene7V} from '../scenes/final';

/**
 * Deterministic single-frame renderer used by the QA pipeline.
 *
 * Scenes are pure functions of the global frame, so the exact artwork the
 * Remotion browser renders can also be serialised to standalone SVG and
 * rasterised without a browser. This is what tools/qa.mjs uses to produce
 * review frames, contact sheets and preview encodes.
 */

type SceneRenderer = (frame: number, fps: number) => React.ReactNode;

const RENDERERS: Record<SceneKey, {h: SceneRenderer; v: SceneRenderer}> = {
  hook: {h: (f, fps) => <Scene1H frame={f} fps={fps} />, v: (f, fps) => <Scene1V frame={f} fps={fps} />},
  inventory: {h: (f) => <Scene2H frame={f} />, v: (f) => <Scene2V frame={f} />},
  order: {h: (f) => <Scene3H frame={f} />, v: (f) => <Scene3V frame={f} />},
  reason: {h: (f, fps) => <Scene4H frame={f} fps={fps} />, v: (f, fps) => <Scene4V frame={f} fps={fps} />},
  process: {h: (f) => <Scene5H frame={f} />, v: (f) => <Scene5V frame={f} />},
  reveal: {h: (f) => <Scene6H frame={f} />, v: (f) => <Scene6V frame={f} />},
  final: {h: (f) => <Scene7H frame={f} />, v: (f) => <Scene7V frame={f} />},
};

export const sceneAt = (frame: number): SceneKey =>
  SCENE_ORDER.find((k) => frame >= SCENES[k].from && frame < SCENES[k].from + SCENES[k].duration) ?? 'final';

export function renderFrameSvg(o: 'h' | 'v', frame: number, fps = 30): string {
  const w = o === 'h' ? 1920 : 1080;
  const h = o === 'h' ? 1080 : 1920;
  const body = RENDERERS[sceneAt(frame)][o](frame, fps);
  return renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Backdrop w={w} h={h} />
      <g>{body}</g>
    </svg>,
  );
}
