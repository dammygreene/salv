# CULLER — "Hidden Inventory" · Motion Direction (v4)

One idea carries the film: **your wallet has leftovers.** A wallet is a dark,
almost infinite digital space; forgotten assets, token fragments, collectibles
and empty accounts float in it, half-concealed. CULLER is the signal that
brings this hidden inventory into view. Mystery → discovery → clarity →
brand moment.

This is a brand film, not a walkthrough. The product appears once, framed,
as evidence that CULLER is real — never as a tutorial.

## Format

- 1920×1080 @ 60 fps and a separately composed 1080×1920 @ 60 fps.
- 36 s = 2160 frames. Original soundtrack 100 BPM / 4/4 → beat 36 f, bar 144 f,
  15 bars. `src/brand/timeline.ts` is the only source of truth for scenes,
  events, camera and sound cues; picture and sound share the same numbers.

## The six movements

| # | Frames | Seconds | State of the world |
|---|--------|---------|--------------------|
| 1 Unseen | 0–300 | 0–5 | Near-black. A small unmistakable CULLER-blue signal ignites far away (f36); light travels (f96); the line **YOUR WALLET HAS LEFTOVERS** is swept into the scene by its own light bar; the orange period lands (f252); the camera dives through the type plane (f300). |
| 2 Hidden inventory | 300–720 | 5–12 | A glide through the field. Silhouettes — coins, collectible frames, empty accounts, fragments — emerge in three depth layers with parallax, drift and near-camera crossings. An orange glint (f600): the LEFTOVER, one fragment among the blue. |
| 3 The signal | 720–1140 | 12–19 | The blue signal crosses the field; what it touches ignites (rim light, fill, halo) in three waves; the ignited objects then arrange themselves into a deliberate constellation ring (f1044). The leftover ignites orange (f1008). |
| 4 Clarity | 1140–1560 | 19–26 | The ring flattens toward a plane (f1140) and resolves into the one framed glimpse of the **real interface** (f1260): the live home hero — lockup, nav, H1, orange CTA, assurance line, `cullerlabs.xyz` — lit by a single glass sweep (f1380). No cursor, no clicks, no results. |
| 5 Reveal | 1560–1860 | 26–31 | Everything condenses: constellation + frame edges fly into the tiles of the authentic C-mark (f1560–1728). The lockup completes (f1740) and breathes — deliberate stillness — with the bell (f1764). |
| 6 Close | 1860–2160 | 31–36 | **CULLER** / *Find what's sitting in your wallet* / `cullerlabs.xyz`. The leftover returns home as the tagline's orange period (f1980). The site stays readable to the last frame; 1.8 s audio tail. |

## The LEFTOVER (protagonist object)

One orange rounded square with the mark's tile geometry: the period of the
opening line → a glint in the dark → an ignited fragment → a ring member →
a hover beside the glimpse → the period of the closing tagline. Orange is
reserved for it and for the moments it marks; everything else is CULLER blue
on near-black. The authentic logo is never modified — the leftover always
travels beside it.

## Motion language

- One keyed virtual camera per orientation; four parallax depth planes
  (nebula 0.25 / far field 0.6 / hero plane 1 / near fragments 1.4).
- Shared curves only: `SWEEP` (camera & long travel), `SOFT` (arrivals),
  `GLIDE` (interface & type), `TUCK` (exits), `LINEAR` (deliberate constant
  motion). Remotion `spring()` only for the two micro-pops (period lands,
  leftover ignition). Camera never exceeds ~25 px/frame; scale rate < 0.05.
- Transitions are motivated: the dive through the type plane, near-camera
  fragment crossings, the ring flattening into the glimpse plane, the
  condensation into the mark. No preset wipes, no cut-to-black.
- Stillness is used deliberately: the breathe (1728–1860) and the close hold.

## Sound (original, code-generated, `tools/make-audio.mjs`)

- Bars 0–1 sparse atmosphere: drone pad, dust, the ignite boom (f36).
- Bars 2–4 subtle pulse: sub heartbeats as objects emerge; pluck details on
  reveals (cue-locked).
- Bars 5–7 rhythm enters with the signal: soft kick, rolling bass, off-beat
  hats; ignition blips on the three waves.
- Bars 8–11 texture & groove under the glimpse: eighth-note arp lead,
  stabs, side-chained pad; glass-sweep shimmer (f1380).
- Bar 12 everything drops out — pad, settle boom, bell.
- Bars 13–14 resolution swell; period tick (f1980); url shimmer (f2040);
  1.8 s natural tail. Every SFX sits on the exact frame of its visual event
  (`CUES` in timeline.ts). No whoosh-per-transition, no trailer impacts.

## Brand fidelity

- Palette, radii, type and strokes from `src/styles/tokens.css`:
  bg `#0a0e1b`, surfaces `#121a2c…`, blue `#0000ff` / lifted `#4d7aff`,
  live `#5ab6ff`, action orange `#ff7a1a` with dark text `#1a0d00`.
  Plus Jakarta Sans (display 800, −0.03em) + JetBrains Mono for technical
  text only. No lime, no purple, no cyan-neon.
- The glimpse uses genuine product copy and layout (home hero), the genuine
  lockup/mark geometry (`brand/logoGeometry.ts`) and the genuine domain
  `cullerlabs.xyz`. Nothing is invented: no balances, no scan results, no
  transfers; the off-chain allocation record is never shown as chain activity.

## QA & review loop

Browser-free pipeline: `tools/qa.mjs` renders frames through the same SSR
SVG path as the Remotion composition (HarfBuzz-exact metrics baked in
`brand/textMetrics.ts`), builds contact sheets, encodes 60 fps H.264 and
muxes the WAV. `tools/smoke.ts` (43 checks) guards timeline tiling, cue
ordering, camera continuity and artwork presence per orientation. Review
pass 1 caught: invisible pre-ignition silhouettes, an off-center mark during
the breathe, a heavy halo on the landed period, a hard sweep bar — all fixed
before the final encode.
