import {renderToStaticMarkup} from 'react-dom/server';
import {Backdrop} from '../Film';
import {World} from '../scenes/world';
import {STAGE, type Ori} from '../brand/stage';
import {PostGraphic, SOCIAL_W, SOCIAL_H} from '../social/postGraphic';

/**
 * Deterministic single-frame renderer used by the QA pipeline.
 *
 * The film is one pure function of the global frame per orientation, so the
 * exact artwork the Remotion browser renders can also be serialised to
 * standalone SVG and rasterised without a browser. tools/qa.mjs uses this to
 * produce review frames, contact sheets and preview encodes.
 */
export function renderFrameSvg(o: Ori, frame: number): string {
  const st = STAGE[o];
  return renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" width={st.w} height={st.h} viewBox={`0 0 ${st.w} ${st.h}`}>
      <Backdrop w={st.w} h={st.h} />
      <World o={o} frame={frame} />
    </svg>,
  );
}

/** Static social graphic (post 02) — one composed picture, same raster path. */
export function renderSocialSvg(): string {
  return renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" width={SOCIAL_W} height={SOCIAL_H} viewBox={`0 0 ${SOCIAL_W} ${SOCIAL_H}`}>
      <Backdrop w={SOCIAL_W} h={SOCIAL_H} />
      <PostGraphic />
    </svg>,
  );
}
