import React, {useEffect} from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, continueRender, delayRender} from 'remotion';
import {C} from './brand/tokens';
import {SCENES, SCENE_ORDER, type SceneKey} from './brand/timeline';
import {fontFaceCss, FONT_LOAD_SPECS} from './brand/fonts';
import {Scene1H, Scene1V} from './scenes/hook';
import {Scene2H, Scene2V} from './scenes/inventory';
import {Scene3H, Scene3V} from './scenes/order';
import {Scene4H, Scene4V} from './scenes/reason';
import {Scene5H, Scene5V} from './scenes/process';
import {Scene6H, Scene6V} from './scenes/reveal';
import {Scene7H, Scene7V} from './scenes/final';

/**
 * The film. Both orientations share the timeline and every component; each
 * scene is recomposed per orientation rather than cropped.
 *
 * Scenes are pure functions of the *global* frame, wrapped in <Sequence> so
 * Remotion owns the timing while the SSR QA harness can render any frame
 * with no runtime at all.
 */

export const FILM_DEFAULTS = {audio: true, soundDesign: true};
export type FilmProps = typeof FILM_DEFAULTS;

/** Waits for the four brand faces before Remotion captures frame 0. */
const FontGate: React.FC = () => {
  const [handle] = React.useState(() => delayRender('CULLER brand fonts'));
  useEffect(() => {
    Promise.all(FONT_LOAD_SPECS.map((f) => document.fonts.load(`${f.weight} 100px "${f.family}"`)))
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);
  return null;
};

export function Backdrop({w, h}: {w: number; h: number}) {
  return (
    <g>
      <defs>
        <radialGradient id="culler-vignette" cx="50%" cy="42%" r="78%">
          <stop offset="0%" stopColor={C.bgRaised} />
          <stop offset="62%" stopColor={C.bg} />
          <stop offset="100%" stopColor={C.surfaceSunken} />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="url(#culler-vignette)" />
    </g>
  );
}

type SceneRenderer = (frame: number, fps: number) => React.ReactNode;

const SCENE_RENDERERS: Record<SceneKey, {h: SceneRenderer; v: SceneRenderer}> = {
  hook: {h: (f, fps) => <Scene1H frame={f} fps={fps} />, v: (f, fps) => <Scene1V frame={f} fps={fps} />},
  inventory: {h: (f) => <Scene2H frame={f} />, v: (f) => <Scene2V frame={f} />},
  order: {h: (f) => <Scene3H frame={f} />, v: (f) => <Scene3V frame={f} />},
  reason: {h: (f, fps) => <Scene4H frame={f} fps={fps} />, v: (f, fps) => <Scene4V frame={f} fps={fps} />},
  process: {h: (f) => <Scene5H frame={f} />, v: (f) => <Scene5V frame={f} />},
  reveal: {h: (f) => <Scene6H frame={f} />, v: (f) => <Scene6V frame={f} />},
  final: {h: (f) => <Scene7H frame={f} />, v: (f) => <Scene7V frame={f} />},
};

/** Passes the global frame into a scene from inside its <Sequence>. */
const GlobalFrame: React.FC<{offset: number; render: SceneRenderer}> = ({offset, render}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return <>{render(frame + offset, fps)}</>;
};

export const CullerBrandFilm: React.FC<FilmProps> = ({audio}) => {
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <FontGate />
      <style>{fontFaceCss(staticFile)}</style>
      <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
        <Backdrop w={1920} h={1080} />
        {SCENE_ORDER.map((k) => (
          <Sequence key={k} from={SCENES[k].from} durationInFrames={SCENES[k].duration} layout="none">
            <GlobalFrame offset={SCENES[k].from} render={SCENE_RENDERERS[k].h} />
          </Sequence>
        ))}
      </svg>
      {audio ? <Audio src={staticFile('audio/culler-film-mix.wav')} volume={0.9} /> : null}
    </AbsoluteFill>
  );
};

export const CullerBrandFilmVertical: React.FC<FilmProps> = ({audio}) => {
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <FontGate />
      <style>{fontFaceCss(staticFile)}</style>
      <svg viewBox="0 0 1080 1920" width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
        <Backdrop w={1080} h={1920} />
        {SCENE_ORDER.map((k) => (
          <Sequence key={k} from={SCENES[k].from} durationInFrames={SCENES[k].duration} layout="none">
            <GlobalFrame offset={SCENES[k].from} render={SCENE_RENDERERS[k].v} />
          </Sequence>
        ))}
      </svg>
      {audio ? <Audio src={staticFile('audio/culler-film-mix.wav')} volume={0.9} /> : null}
    </AbsoluteFill>
  );
};
