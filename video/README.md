# CULLER — Brand Film: *YOUR WALLET HAS LEFTOVERS*

A 35-second motion graphics film for CULLER, built as a real Remotion project
(React + TypeScript), in two compositions:

| Composition | Size | fps | Frames | Output |
|---|---|---|---|---|
| `CullerBrandFilm` | 1920×1080 | 30 | 1050 | H.264 MP4 |
| `CullerBrandFilmVertical` | 1080×1920 | 30 | 1050 | H.264 MP4 |

The film is an *extension* of the existing product design, not a redesign of
it. Every colour, radius, font, easing curve, status colour and string of
micro-copy is lifted from the live product source (see “Brand extraction”).

---

## Commands

```bash
cd video
npm install

npm run studio          # Remotion Studio (needs network: downloads headless shell)
npm run render          # 1920×1080 H.264 → out/culler-brand-film-1920x1080.mp4
npm run render:vertical # 1080×1920 H.264 → out/culler-brand-film-1080x1920.mp4
npm run render:preview  # quarter-scale quick pass

npm run typecheck       # tsc --noEmit over the whole film
npm run smoke           # Node-side structural checks (no browser needed)
npm run audio           # re-synthesise the original sound layer
npm run metrics         # re-bake HarfBuzz text metrics from the brand fonts
npm run stills          # 20 curated frames + poster per orientation → out/stills/
                        # (browser-free: uses the QA rasteriser)
```

QA / preview pipeline that works **without a browser** (see “Two renderers”):

```bash
node tools/qa.mjs bundle
node tools/qa.mjs frames h 95,200,932 out/qa        # single frames → PNG
node tools/qa.mjs sheet  h out/qa/sheet.png 0:1050:60 4   # contact sheet
node tools/qa.mjs video  h out/preview.mp4 0:1049:1 30   # full-rate preview
```

---

## Brand extraction — nothing invented

| Film token | Value | Source in the product |
|---|---|---|
| background | `#0a0e1b` (+ `#0d1322` raised, `#0b0f1c` sunken vignette) | `src/styles/tokens.css` `--bg/--bg-raised/--surface-sunken` |
| surfaces / panels | `#121a2c`, hover `#182238` | `--surface`, `--surface-hover` |
| borders | `rgba(150,180,255,.1)` / `.2` / accent `rgba(70,100,255,.55)` | `--border`, `--border-strong`, `--border-accent` |
| text | `#f3f5fa` / `#9aa6c3` / `#5f6a88` | `--text`, `--text-secondary`, `--text-muted` |
| **brand blue** | `#0000ff` for large fills; `#4d7aff` for thin lines, paths, small text; `#5ab6ff` for “live” states | `--accent`, `--accent-text`, `--data` (tokens.css explicitly says pure blue reads too dark for thin work) |
| **brand orange** | `#ff7a1a` (+ `#ff9142`) | `--secondary`, `--secondary-hover` — the product’s action colour |
| status colours | ok `#34d399`, warn `#fbbf24`, review `#5ab6ff`, keep muted | `--ok/--warn/--data/--text-muted` + `components.css` badge mapping |
| radii | 8 / 12 / 18 / 24 / pill, scaled ×1.6 for film size | `--r-sm…--r-pill` |
| type | **Plus Jakarta Sans** (500/700/800; display = 800 @ −0.03em) + **JetBrains Mono** for labels/identifiers only | `--font-sans`, `--font-mono`, `.display` in `base.css`; brand kit: “wordmark = Plus Jakarta Sans Bold, lowercase, outlined” |
| easing | `cubic-bezier(0.16,1,0.3,1)` (+ spring variant `0.34,1.56,0.64,1`) | `--ease`, `--ease-spring` |
| logo | the real mark (26 tiles, `#4468FF→#B4C8FF`) + real outlined wordmark, as vector data | `culler-brand-kit/…/svg/culler-{mark,logo}-on-dark.svg`, extracted by `tools/svg-to-ts.mjs` |
| fonts on disk | the site’s own self-hosted woff2 files | `public/fonts/*` → `video/public/fonts/*` |
| copy | hero line, support line, scan/reward vocabulary | `src/app/page.tsx`, live `culler.vercel.app` |
| statuses | `CULLABLE / WATCH / REVIEW / KEEP` | `AssetStatus`, `src/lib/types.ts` |
| asset kinds | `TOKEN / NFT / POSITION / ACCOUNT` | `AssetKind`, `src/lib/types.ts` |
| chains shown | `SOLANA`, `ROBINHOOD CHAIN` with their real read scopes | `src/lib/solana/scanner/scan.ts`, `src/lib/server/robinhoodScanner.ts` |
| classifications/reasons | `EMPTY_TOKEN_ACCOUNT — ZERO BALANCE, RENT RECOVERABLE`, `FUNGIBLE_NO_MARKET — … NOT TREATED AS ZERO`, `NFT_REVIEW — …`, `FUNGIBLE_VALUABLE — …` | `src/lib/cull/registry.ts`, `src/lib/types.ts` |
| reward beat | `CLOSE_EMPTY_TOKEN_ACCOUNT · BASE 100 PTS`, “allocation recorded” | registry `basePoints: 100`; live site “Scan → Calculate → Record” |

Text metrics are baked with **HarfBuzz** against those exact font files
(`tools/make-metrics.py` → `src/brand/textMetrics.ts`), so type placement is
identical in the browser render and in the librsvg QA rasteriser.

---

## Structure

```
video/
  index.ts                  registerRoot
  remotion.config.ts        h264 / jpeg / concurrency
  src/
    Root.tsx                the two <Composition>s
    Film.tsx                Backdrop, Sequence wiring, fonts gate, <Audio>
    brand/
      tokens.ts             motion design tokens (surfaces→easing→stroke)
      timeline.ts           1050-frame beat map (CUES) shared by film + audio
      copy.ts               every on-screen string
      fonts.ts              @font-face for the self-hosted woff2 files
      logoGeometry.ts       generated: real mark tiles + outlined wordmark
      textMetrics.ts        generated: HarfBuzz advances per string/style
    lib/anim.ts             phase/ease/spring/bezier-path helpers (deterministic)
    components/
      primitives.tsx        FilmText, MonoLabel, MaskReveal, Hairline, Panel,
                            StatusPill, DataPath
      assets.tsx            AssetIcon (4 original geometric icons), AssetTile,
                            BackForm
      brand.tsx             CullerMark (tile assembly), CullerWordmark (clip
                            reveal), CullerLockup
    scenes/                 hook · inventory · order · reason · process ·
                            reveal · final   (each exports H + V variants)
    qa/frame.tsx            pure SSR frame renderer used by the QA pipeline
  tools/
    svg-to-ts.mjs           brand SVG → logoGeometry.ts
    make-metrics.py         fonts → textMetrics.ts (HarfBuzz)
    make-audio.mjs          original synthesised sound layer → WAV
    qa.mjs                  SVG → PNG / contact sheets / preview encodes
    smoke.ts                structural checks (timeline, compositions)
  public/
    fonts/                  the site's woff2 (+ ttf for the rasteriser)
    audio/culler-film-mix.wav
```

Scenes are **pure functions of the global frame**; `<Sequence>` only supplies
timing inside Remotion. That is what makes the film deterministic and lets the
same components be rasterised, frame-checked and encoded without a browser.

---

## Two renderers, one artwork

* **Master renderer — Remotion in a browser.** `npm run render` produces the
  shipping MP4s. Requires outbound network once, because Remotion downloads
  its headless Chrome shell on first use.
* **QA renderer — librsvg via sharp.** This sandbox has no browser and
  `remotion.media` is unreachable, so `tools/qa.mjs` serialises the identical
  scene tree to SVG and rasterises it with the same HarfBuzz-shaped fonts.
  Layout numbers come from `textMetrics.ts`, so QA frames are a faithful
  preview, not an approximation. Preview MP4s in `out/` were encoded from
  these frames with ffmpeg 7 (`imageio-ffmpeg`).

Both orientations were reviewed frame-by-frame through contact sheets during
production; `out/qa/` holds the evidence sheets, and `out/` holds the two
full-rate preview encodes — muxed with the AAC sound layer, verified at
`Duration: 00:00:35.00`, 30 fps, h264 + aac stereo — plus `out/stills/`
(curated frames and a poster per orientation, the last frame holding static
by design so it works as standalone promo art).

---

## Sound

`public/audio/culler-film-mix.wav` is synthesised from scratch by
`tools/make-audio.mjs` (seeded PRNG → identical every run; the WAV is
git-ignored and regenerated with `npm run audio`): soft pulses,
mechanical clicks, gentle transition accents, a restrained 2-beat pulse under
the middle scenes and one low bloom under the logo reveal. Cues are keyed to
the same `CUES` beat map as the picture. It is optional and replaceable:
`<CullerBrandFilm audio={false} />`, or drop any licensed mix in at the same
path. The film reads completely without it.

---

## Truthfulness rules honoured

* No asset is ever deleted, closed or transferred on screen. The CULL beat
  states `BIN IS A DECISION, NOT AN ACTION`; VERIFY states
  `REVIEW BEFORE SIGNING`; REWARD shows a recorded allocation, never money.
* No balances, prices, analytics or partner logos are invented. Where CULLER
  has no market data the film says so (`FUNGIBLE_NO_MARKET — NO PRICE SOURCE
  FOUND, NOT TREATED AS ZERO`).
* Only the two chains the product actually scans are named, each with its
  real read scope.
* The end card carries the live demo domain `culler.vercel.app`
  (`COPY.finalUrl` — swap for the production domain at ship time) and the
  product’s own privacy line. No QR codes, no social handles.
