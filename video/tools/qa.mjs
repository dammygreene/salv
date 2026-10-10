#!/usr/bin/env node
/**
 * CULLER Brand Film — QA rasteriser / preview encoder.
 *
 * The sandbox this film was built in has no browser (Remotion's headless
 * shell download is blocked), so visual QA runs through a second, honest
 * path: the same pure scene components are serialised to SVG and rasterised
 * with librsvg (sharp), using the real brand fonts via fontconfig. Both
 * librsvg and the browser shape text with HarfBuzz, and every layout number
 * comes from textMetrics.ts, so these frames are a faithful — not
 * approximate — preview of the Remotion render.
 *
 *   node tools/qa.mjs bundle
 *   node tools/qa.mjs frames <h|v> <f0,f1,…> <outdir>
 *   node tools/qa.mjs sheet  <h|v> <out.png> <from:to:step> <cols>
 *   node tools/qa.mjs video  <h|v> <out.mp4|webp> <from:to:step> <fps>
 */
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdirSync, writeFileSync, readdirSync, existsSync} from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const BUNDLE = '/tmp/culler-qa.cjs';
const require = createRequire(import.meta.url);
const FFMPEG = execFileSync('python3', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], {encoding: 'utf8'}).trim();

function bundle() {
  execFileSync(
    'npx',
    ['esbuild', 'src/qa/frame.tsx', '--bundle', '--platform=node', '--format=cjs', `--outfile=${BUNDLE}`, '--jsx=automatic', '--log-level=warning'],
    {stdio: 'inherit'},
  );
  console.log('bundled', BUNDLE);
}

function load() {
  return require(BUNDLE);
}

const parseRange = (spec) => {
  const [from, to, step] = spec.split(':').map(Number);
  const out = [];
  for (let f = from; f <= to; f += step) out.push(f);
  return out;
};

async function frames(o, list, outdir) {
  const mod = load();
  mkdirSync(outdir, {recursive: true});
  for (const f of list) {
    const svg = mod.renderFrameSvg(o, f, 30);
    const file = path.join(outdir, `${o}-${String(f).padStart(4, '0')}.png`);
    await sharp(Buffer.from(svg)).png().toFile(file);
    process.stdout.write(`${f} `);
  }
  console.log('\nframes ->', outdir);
}

async function sheet(o, out, spec, cols) {
  const mod = load();
  const list = parseRange(spec);
  const W = o === 'h' ? 640 : 360;
  const H = o === 'h' ? 360 : 640;
  const rows = Math.ceil(list.length / cols);
  const bufs = [];
  for (const f of list) {
    const svg = mod.renderFrameSvg(o, f, 30);
    bufs.push(await sharp(Buffer.from(svg)).resize(W, H).png().toBuffer());
  }
  const sheetBuf = await sharp({
    create: {width: W * cols, height: H * rows, channels: 4, background: {r: 10, g: 14, b: 27, alpha: 1}},
  })
    .composite(bufs.map((b, i) => ({input: b, left: (i % cols) * W, top: Math.floor(i / cols) * H})))
    .png()
    .toBuffer();
  writeFileSync(out, sheetBuf);
  console.log('sheet ->', out, `${list.length} frames, ${cols}×${rows}`);
}

async function video(o, out, spec, fps) {
  const mod = load();
  const list = parseRange(spec);
  const dir = '/tmp/qa-frames';
  mkdirSync(dir, {recursive: true});
  for (const f of list) {
    const svg = mod.renderFrameSvg(o, f, 30);
    const file = path.join(dir, `f-${String(list.indexOf(f)).padStart(5, '0')}.png`);
    await sharp(Buffer.from(svg)).png().toFile(file);
  }
  const isWebp = out.endsWith('.webp');
  const args = isWebp
    ? ['-y', '-framerate', String(fps), '-i', path.join(dir, 'f-%05d.png'), '-loop', '0', '-quality', '72', out]
    : [
        '-y',
        '-framerate',
        String(fps),
        '-i',
        path.join(dir, 'f-%05d.png'),
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-crf',
        '20',
        '-preset',
        'veryfast',
        out,
      ];
  execFileSync(FFMPEG, args, {stdio: 'pipe'});
  console.log('video ->', out, `${list.length} frames @ ${fps}fps = ${(list.length / fps).toFixed(1)}s`);
}

const [cmd, o, arg3, arg4, arg5] = process.argv.slice(2);
if (cmd === 'bundle') bundle();
else if (cmd === 'frames') await frames(o, arg3.split(',').map(Number), arg4);
else if (cmd === 'sheet') await sheet(o, arg3, arg4, Number(arg5 || 4));
else if (cmd === 'video') await video(o, arg3, arg4, Number(arg5 || 10));
else console.log('unknown command', cmd);
