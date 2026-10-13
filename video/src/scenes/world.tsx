/**
 * The v4 film as ONE continuous world per orientation: a dark digital
 * space with four parallax depth planes (nebula / far field / hero plane /
 * near fragments) moved by a single keyed virtual camera. Scenes are not
 * compositions — they are states of this world: the line, the field, the
 * signal, the glimpse, the mark, the close.
 */
import React from 'react';
import {C} from '../brand/tokens';
import {CAM_H, CAM_V} from '../brand/timeline';
import {STAGE, type Ori} from '../brand/stage';
import {camAt} from '../lib/motion';
import {Nebula, Field, Foreground, Signal, OpenLine, Glimpse, Condense, Close, Leftover} from './space';

function CamLayer({o, frame, depth, children}: {o: Ori; frame: number; depth: number; children: React.ReactNode}) {
  const st = STAGE[o];
  const cam = camAt(frame, o === 'h' ? CAM_H : CAM_V);
  const s = 1 + (cam.s - 1) * depth;
  const cx = st.w / 2 + (cam.x - st.w / 2) * depth;
  const cy = st.h / 2 + (cam.y - st.h / 2) * depth;
  return <g transform={`translate(${st.w / 2} ${st.h / 2}) scale(${s}) translate(${-cx} ${-cy})`}>{children}</g>;
}

export function World({o, frame}: {o: Ori; frame: number}) {
  const st = STAGE[o];
  return (
    <g>
      <rect x={0} y={0} width={st.w} height={st.h} fill={C.bg} />
      <CamLayer o={o} frame={frame} depth={0.25}>
        <Nebula o={o} frame={frame} />
      </CamLayer>
      <CamLayer o={o} frame={frame} depth={0.6}>
        <Field o={o} frame={frame} layer={0.55} />
      </CamLayer>
      <CamLayer o={o} frame={frame} depth={1}>
        <Field o={o} frame={frame} layer={1} />
        <Signal o={o} frame={frame} />
        <OpenLine o={o} frame={frame} />
        <Glimpse o={o} frame={frame} />
        <Condense o={o} frame={frame} />
        <Close o={o} frame={frame} />
        <Leftover o={o} frame={frame} />
      </CamLayer>
      <CamLayer o={o} frame={frame} depth={1.4}>
        <Field o={o} frame={frame} layer={1.3} />
        <Foreground o={o} frame={frame} />
      </CamLayer>
    </g>
  );
}
