import React, {useEffect} from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame, continueRender, delayRender} from 'remotion';
import {C} from './brand/tokens';
import {STAGE, type Ori} from './brand/stage';
import {fontFaceCss, FONT_LOAD_SPECS} from './brand/fonts';
import {World} from './scenes/world';

/**
 * CULLER — "Your wallet has leftovers." 36 s · 60 fps · 2160 frames.
 *
 * One continuous world per orientation: a keyed virtual camera moves through
 * a single stage while the product page navigates inside a persisting browser
 * frame (timeline.ts owns every event frame; motion.ts owns every curve).
 * The same World component is rasterised browser-free by tools/qa.mjs.
 */

export const FILM_DEFAULTS = {audio: true};
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

function FilmBody({o, audio}: {o: Ori; audio: boolean}) {
  const frame = useCurrentFrame();
  const st = STAGE[o];
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <FontGate />
      <style>{fontFaceCss(staticFile)}</style>
      <svg viewBox={`0 0 ${st.w} ${st.h}`} width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
        <Backdrop w={st.w} h={st.h} />
        <World o={o} frame={frame} />
      </svg>
      {audio ? <Audio src={staticFile('audio/culler-film-mix.wav')} volume={0.9} /> : null}
    </AbsoluteFill>
  );
}

export const CullerBrandFilm: React.FC<FilmProps> = ({audio}) => <FilmBody o="h" audio={audio} />;
export const CullerBrandFilmVertical: React.FC<FilmProps> = ({audio}) => <FilmBody o="v" audio={audio} />;
