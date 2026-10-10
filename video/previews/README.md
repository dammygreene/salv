# Preview encodes

Committed so the film can be watched and reviewed without running a render.

- `culler-brand-film-1920x1080-preview.mp4` — 1920×1080, 30 fps, 35.00 s, H.264 + AAC stereo (the film's sound layer)
- `culler-brand-film-1080x1920-preview.mp4` — the vertical recomposition, same specs

These were produced by the browser-free QA pipeline (`node tools/qa.mjs video h|v … 0:1049:1 30`, then the mix muxed with ffmpeg). That pipeline rasterises the
scenes' own SVG output instead of driving Remotion's Chrome renderer, so it is
faithful to the compositions but not pixel-identical to a Remotion master.

For master quality, on any machine with network access:

```bash
npm install
npm run render           # → out/culler-brand-film.mp4
npm run render:vertical  # → out/culler-brand-film-vertical.mp4
```

Local renders land in `out/`, which stays untracked; only these two preview
encodes are committed. Regenerate them with `npm run audio`,
`node tools/qa.mjs bundle`, the `qa.mjs video` encode, and the ffmpeg mux
documented in `../README.md`.
