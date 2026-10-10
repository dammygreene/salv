import React from 'react';
import {Composition} from 'remotion';
import {CullerBrandFilm, CullerBrandFilmVertical, FILM_DEFAULTS} from './Film';
import {FPS, HEIGHT, TOTAL_FRAMES, V_HEIGHT, V_WIDTH, WIDTH} from './brand/timeline';

/**
 * CULLER Brand Film — compositions.
 *
 * CullerBrandFilm         1920×1080 · 30fps · 1050 frames (35s)
 * CullerBrandFilmVertical 1080×1920 · 30fps · 1050 frames (35s)
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CullerBrandFilm"
        component={CullerBrandFilm}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={FILM_DEFAULTS}
      />
      <Composition
        id="CullerBrandFilmVertical"
        component={CullerBrandFilmVertical}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={V_WIDTH}
        height={V_HEIGHT}
        defaultProps={FILM_DEFAULTS}
      />
    </>
  );
};
