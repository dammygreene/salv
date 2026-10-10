#!/usr/bin/env node
/**
 * CULLER Brand Film — original sound design, synthesised from scratch.
 *
 * No samples, no libraries: every cue is generated here as PCM, so the layer
 * is entirely original and licence-free, and it is fully replaceable (drop
 * any file in as public/audio/culler-film-mix.wav).
 *
 * Direction: soft electronic pulses, light mechanical clicks, gentle
 * transition accents, a subtle percussive pulse under the middle scenes, and
 * one restrained bloom for the logo reveal. Nothing aggressive; the film
 * must also work with the audio removed.
 *
 * Usage: node tools/make-audio.mjs   (run from video/)
 */
import {writeFileSync} from 'node:fs';
import {CUES, FPS, TOTAL_FRAMES} from '../src/brand/timeline.ts';

const SR = 48000;
const N = Math.ceil((TOTAL_FRAMES / FPS) * SR);
const L = new Float64Array(N);
const R = new Float64Array(N);

/** Deterministic PRNG so the mix is identical every run. */
let seed = 0x2f6e2b1;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const frameToSample = (f) => Math.round((f / FPS) * SR);

function add(buf, startSample, samples) {
  for (let i = 0; i < samples.length; i++) {
    const idx = startSample + i;
    if (idx < 0 || idx >= N) continue;
    buf[idx] += samples[i];
  }
}

function both(startFrame, samples, gain = 1, pan = 0) {
  const s = frameToSample(startFrame);
  const gl = gain * Math.cos((pan * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  add(L, s, samples.map((v) => v * gl));
  add(R, s, samples.map((v) => v * gr));
}

/** Soft electronic pulse: windowed sine with a fast attack, long-ish decay. */
function pulse(freq, durS, gain, sweepTo = null) {
  const n = Math.floor(durS * SR);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = sweepTo ? freq + (sweepTo - freq) * (i / n) : freq;
    const env = Math.pow(1 - i / n, 2.2) * Math.min(1, i / (SR * 0.004));
    out[i] = Math.sin(2 * Math.PI * f * t) * env * gain;
    out[i] += Math.sin(4 * Math.PI * f * t) * env * gain * 0.18;
  }
  return out;
}

/** Light mechanical click: tiny noise transient + a short high tick. */
function click(gain = 0.5) {
  const n = Math.floor(0.035 * SR);
  const out = new Float64Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.exp(-t * 320);
    const noise = (rnd() * 2 - 1) * env;
    lp += 0.42 * (noise - lp);
    out[i] = (lp * 0.6 + Math.sin(2 * Math.PI * 2400 * t) * env * 0.5) * gain;
  }
  return out;
}

/** Gentle transition accent: airy filtered noise swell, no whoosh cliché. */
function accent(durS = 0.5, gain = 0.22) {
  const n = Math.floor(durS * SR);
  const out = new Float64Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const env = Math.sin(Math.PI * t) ** 2;
    const noise = rnd() * 2 - 1;
    lp += 0.08 * (noise - lp);
    out[i] = lp * env * gain * 3.2;
  }
  return out;
}

/** Subtle percussive heartbeat: low sine thump, very restrained. */
function thump(gain = 0.3) {
  const n = Math.floor(0.16 * SR);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 96 * Math.exp(-t * 9);
    const env = Math.exp(-t * 26) * Math.min(1, i / 40);
    out[i] = Math.sin(2 * Math.PI * f * t) * env * gain;
  }
  return out;
}

/** Logo bloom: low sine pair gliding down + a soft high shimmer. */
function bloom(gain = 0.5) {
  const n = Math.floor(1.5 * SR);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.18) * Math.pow(1 - i / n, 1.6);
    const f = 132 * Math.exp(-t * 0.55);
    out[i] = (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * f * 1.5 * t)) * env * gain * 0.5;
    out[i] += Math.sin(2 * Math.PI * 1320 * t + Math.sin(t * 9) * 2) * env * gain * 0.05;
  }
  return out;
}

/* ── cue sheet, keyed to the film's beat map ─────────────────────────── */

// Scene 1: quiet room tone pulse, the nudge, two type beats, the orange stop.
both(6, pulse(196, 0.5, 0.16), 0.5, -0.3);
both(CUES.firstNudge, click(0.32), 0.8, 0.35);
both(CUES.headlineWord1, pulse(247, 0.34, 0.2), 0.7, -0.2);
both(CUES.headlineWord2, pulse(294, 0.4, 0.2), 0.7, 0.1);
both(CUES.headlinePunch, click(0.5), 0.9, 0.2);
both(CUES.headlinePunch + 2, pulse(392, 0.5, 0.14), 0.6, 0.2);

// Scene 2: field opens — soft pulses per tile, accents on paths and flags.
for (let i = 0; i < 10; i++) both(CUES.fieldOpen + i * 4, pulse(330 + i * 14, 0.22, 0.1), 0.5, (i % 5) / 3 - 0.7);
both(CUES.fieldPaths, accent(0.6, 0.16), 0.7, 0);
both(CUES.fieldFlag, click(0.42), 0.85, 0.4);
both(CUES.fieldFlag + 6, pulse(220, 0.5, 0.16, 180), 0.6, 0.4);
both(CUES.findThings, pulse(174, 0.6, 0.22), 0.8, -0.2);

// Scene 3: reflow rhythm + source convergence + lock.
for (let i = 0; i < 10; i++) both(CUES.reflowStart + i * 3, click(0.16), 0.55, ((i * 37) % 10) / 6 - 0.8);
both(CUES.sourcesIn, accent(0.7, 0.2), 0.75, -0.3);
both(CUES.sourcesIn + 8, accent(0.7, 0.18), 0.75, 0.3);
both(CUES.reflowLock, thump(0.34), 0.9, 0);
both(CUES.reflowLock + 4, pulse(147, 0.7, 0.2), 0.8, 0);
both(CUES.oneInventory, pulse(196, 0.5, 0.2), 0.8, -0.15);

// Scene 4: panel, four states, the expansion.
both(CUES.panelIn, accent(0.5, 0.18), 0.8, 0);
CUES.rowState.forEach((f, i) => {
  both(f, click(0.4), 0.85, i % 2 ? 0.25 : -0.25);
  both(f + 2, pulse(262 * (1 + i * 0.12), 0.3, 0.14), 0.6, i % 2 ? 0.25 : -0.25);
});
both(CUES.rowExpand, accent(0.45, 0.16), 0.8, 0.1);
both(CUES.everyItem, pulse(174, 0.6, 0.2), 0.8, -0.15);

// Scene 5: a quiet 2-beat pulse under each stage; clicks on the decisions.
for (let b = 0; b < 3; b++) {
  const at = [CUES.cullBeat, CUES.verifyBeat, CUES.rewardBeat][b];
  both(at, thump(0.3), 0.9, 0);
  both(at + 30, thump(0.22), 0.7, 0);
  both(at + 12, click(0.3), 0.8, b === 2 ? 0.3 : -0.2);
}
both(CUES.verifyBeat + 28, pulse(523, 0.35, 0.16), 0.7, 0.1);
both(CUES.rewardBeat + 14, pulse(392, 0.8, 0.18, 330), 0.7, 0.2);
both(CUES.clearProcess, pulse(196, 0.6, 0.2), 0.8, 0);

// Scene 6: collapse, mark assembly ticks, the bloom under the reveal.
both(CUES.collapse, accent(0.6, 0.2), 0.8, 0);
for (let i = 0; i < 26; i++) both(CUES.markAssemble + Math.floor(i * 0.9), click(0.1 + (i / 26) * 0.14), 0.5, Math.sin(i) * 0.6);
both(CUES.markAssemble + 6, bloom(0.55), 0.95, 0);
both(CUES.wordmarkIn, accent(0.5, 0.14), 0.8, 0);
both(CUES.revealCopy, pulse(247, 0.5, 0.14), 0.7, 0);

// Scene 7: one final soft pulse, then silence for the hold.
both(CUES.finalCard, pulse(196, 0.9, 0.2, 165), 0.85, 0);
both(CUES.finalCard + 4, click(0.24), 0.7, 0);

/* ── master: gentle soft-clip, fade tails, write 16-bit stereo WAV ───── */
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const norm = peak > 0 ? 0.5 / peak : 1;
const fadeOutStart = N - Math.floor(0.6 * SR);
const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  const fade = i > fadeOutStart ? Math.max(0, 1 - (i - fadeOutStart) / (N - fadeOutStart)) : 1;
  const sl = Math.tanh(L[i] * norm * 1.6) * fade;
  const sr = Math.tanh(R[i] * norm * 1.6) * fade;
  data.writeInt16LE(Math.max(-1, Math.min(1, sl)) * 32767, i * 4);
  data.writeInt16LE(Math.max(-1, Math.min(1, sr)) * 32767, i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);
writeFileSync('public/audio/culler-film-mix.wav', Buffer.concat([header, data]));
console.log('wrote public/audio/culler-film-mix.wav', ((44 + data.length) / 1e6).toFixed(1), 'MB ·', (N / SR).toFixed(2), 's · peak', peak.toFixed(3));
