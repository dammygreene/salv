/**
 * Original soundtrack + synchronised interface sound, 100 BPM / 4/4.
 * beat = 36 frames, bar = 144 frames @ 60 fps; 15 bars = 36 s.
 *
 * Every SFX is scheduled from CUES in src/brand/timeline.ts — the same
 * constants that drive the picture — so attacks land on the exact frame of
 * their visual event. The music is a 15-bar arc (intro, development, payoff,
 * resolution) that supports the motion without dictating it.
 * Deterministic: no randomness anywhere; stereo width comes from detuning.
 */
import {writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {CUES, BEAT, BAR, FPS, DURATION} from '../src/brand/timeline.ts';

const SR = 48000;
const N = Math.round(36 * SR);
const Lch = new Float32Array(N);
const Rch = new Float32Array(N);
const f2t = (f) => f / FPS;

function mix(buf, i, v) {
  if (i >= 0 && i < N) buf[i] += v;
}
/** sine with exponential decay envelope */
function tone(freq, atF, dur, amp, {pan = 0, decay = 6, harm = 0, detune = 0} = {}) {
  const t0 = Math.round(f2t(atF) * SR);
  const n = Math.round(dur * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.exp(-decay * t) * Math.min(1, t / 0.008);
    const v = amp * env * (Math.sin(2 * Math.PI * (freq + detune) * t) + harm * Math.sin(4 * Math.PI * (freq + detune) * t));
    mix(pan <= 0 ? Lch : Lch, t0 + i, v * (1 - Math.max(0, pan)));
    mix(Rch, t0 + i, v * (1 + Math.min(0, pan)) );
  }
}
let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0), seed / 4294967296);
/** shaped noise burst; sweep = [f0, f1] one-pole band-pass approximation */
function noise(atF, dur, amp, {pan = 0, sweep = null, q = 0.28, attack = 0.004} = {}) {
  const t0 = Math.round(f2t(atF) * SR);
  const n = Math.round(dur * SR);
  let lp = 0, hp = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const k = t / dur;
    const fc = sweep ? sweep[0] + (sweep[1] - sweep[0]) * k : 6000;
    const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
    const x = rnd() * 2 - 1;
    lp += a * (x - lp);
    hp = x - lp;
    const bp = lp - hp * q;
    prev = bp;
    const env = Math.min(1, t / attack) * (1 - k) * (1 - k);
    const v = amp * env * prev;
    mix(Lch, t0 + i, v * (1 - Math.max(0, pan)));
    mix(Rch, t0 + i, v * (1 + Math.min(0, pan)));
  }
}
/** warm pad chord across one bar */
function pad(bar, root, amp) {
  const atF = bar * BAR;
  const notes = [root, root * 1.1892, root * 1.4983, root * 2];
  const dur = BAR / FPS + 0.5;
  const t0 = Math.round(f2t(atF) * SR);
  const n = Math.round(dur * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.45) * Math.min(1, Math.max(0, (dur - t) / 0.7));
    let v = 0;
    for (let d = 0; d < notes.length; d++) {
      const det = 1 + (d % 2 ? 0.0012 : -0.0011);
      v += Math.sin(2 * Math.PI * notes[d] * det * t) * (d === 3 ? 0.4 : 1);
    }
    const s = (amp * env * v) / 3.4;
    mix(Lch, t0 + i, s * 1.0);
    mix(Rch, t0 + i, s * 0.96 + Math.sin(2 * Math.PI * notes[1] * 1.002 * t) * amp * env * 0.05);
  }
}
function sub(freq, atF, amp = 0.15) {
  const t0 = Math.round(f2t(atF) * SR);
  const n = Math.round(0.4 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.012) * Math.exp(-7 * t);
    const v = amp * env * Math.sin(2 * Math.PI * freq * t);
    mix(Lch, t0 + i, v);
    mix(Rch, t0 + i, v);
  }
}
function riser(atF, dur = 0.9, amp = 0.08) {
  const t0 = Math.round(f2t(atF) * SR);
  const n = Math.round(dur * SR);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const k = i / n;
    const fc = 300 + 2200 * k * k;
    const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
    const x = rnd() * 2 - 1;
    lp += a * (x - lp);
    const v = amp * k * k * lp + amp * 0.35 * k * k * Math.sin(2 * Math.PI * (180 + 520 * k) * (i / SR));
    mix(Lch, t0 + i, v * 0.9);
    mix(Rch, t0 + i, v);
  }
}
function bell(atF) {
  const t0 = Math.round(f2t(atF) * SR);
  const n = Math.round(2.4 * SR);
  const c = 660, m = 660 * 3.53;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const idx = 4 * Math.exp(-3 * t);
    const env = Math.min(1, t / 0.006) * Math.exp(-1.7 * t);
    const v = 0.16 * env * (Math.sin(2 * Math.PI * c * t + idx * Math.sin(2 * Math.PI * m * t)) * 0.7 + 0.3 * Math.sin(2 * Math.PI * 990 * t) + 0.18 * Math.sin(2 * Math.PI * 1320 * t));
    mix(Lch, t0 + i, v);
    mix(Rch, t0 + i, v * 0.95);
  }
}

/* ── the 15-bar arc ─────────────────────────────────────────────────── */
const A2 = 110, F2 = 87.31, C3 = 130.81, G2 = 98;
const PROG = [A2, A2, F2, F2, C3, C3, G2, G2, A2, A2, F2, F2, C3, G2, A2];
for (let b = 0; b < 15; b++) {
  const amp = b < 2 ? 0.05 : b < 9 ? 0.062 : b < 12 ? 0.072 : 0.08;
  pad(b, PROG[b], b === 14 ? 0.095 : amp);
  if (b >= 2) {
    sub(PROG[b] / 2, b * BAR, 0.14);
    sub(PROG[b] / 2, b * BAR + 2 * BEAT, 0.11);
  }
  if (b >= 4 && b < 13) {
    noise(b * BAR + BEAT, 0.05, 0.028, {pan: 0.35});
    noise(b * BAR + 3 * BEAT, 0.05, 0.032, {pan: 0.35});
  }
}
/* pentatonic details at handoffs */
const PENTA = [659.25, 783.99, 587.33, 880];
let pi = 0;
for (const c of CUES) {
  if (c.kind === 'pluck') tone(PENTA[pi++ % 4], c.f, 0.6, 0.06, {pan: -0.25, decay: 5, harm: 0.35});
  else if (c.kind === 'tick') { tone(1900, c.f, 0.07, 0.075, {decay: 26, pan: 0.15}); noise(c.f, 0.012, 0.05, {sweep: [3000, 1600]}); }
  else if (c.kind === 'click') { noise(c.f, 0.01, 0.11, {sweep: [5000, 2200]}); tone(150, c.f, 0.09, 0.13, {decay: 22}); }
  else if (c.kind === 'swap') noise(c.f, 0.22, 0.05, {sweep: [1300, 320]});
  else if (c.kind === 'wire') noise(c.f, 0.05, 0.07, {sweep: [700, 2600], pan: -0.2});
  else if (c.kind === 'step') tone(950, c.f, 0.05, 0.045, {decay: 30});
  else if (c.kind === 'confirm') { tone(523.25, c.f, 0.5, 0.085, {decay: 5}); tone(783.99, c.f + 5, 0.6, 0.075, {decay: 4.5}); noise(c.f, 0.02, 0.03); }
  else if (c.kind === 'riser') riser(c.f, 0.9, 0.075);
  else if (c.kind === 'bell') bell(c.f);
}

/* ── master: soft clip, normalise, natural tail ─────────────────────── */
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(Lch[i]), Math.abs(Rch[i]));
const g = 0.5 / peak;
const fadeStart = N - Math.round(1.8 * SR);
const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  const fade = i < fadeStart ? 1 : Math.cos(((i - fadeStart) / (N - fadeStart)) * Math.PI * 0.5);
  data.writeInt16LE(Math.round(Math.tanh(Lch[i] * 1.15) * g * 32767 * fade), i * 4);
  data.writeInt16LE(Math.round(Math.tanh(Rch[i] * 1.15) * g * 32767 * fade), i * 4 + 2);
}
const hdr = Buffer.alloc(44);
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8);
hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34);
hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
const out = path.join('public', 'audio', 'culler-film-mix.wav');
mkdirSync(path.dirname(out), {recursive: true});
writeFileSync(out, Buffer.concat([hdr, data]));
console.log('wrote', out, (N / SR).toFixed(2) + 's', 'cues:', CUES.length);
