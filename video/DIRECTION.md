# CULLER — "Your Wallet Has Leftovers." Motion direction v2

36 s · 60 fps · 2160 frames · 100 BPM (beat = 36 f, bar = 144 f, 15 bars) · 1920×1080 + recomposed 1080×1920.
Single source of truth: `src/brand/timeline.ts` (scene bounds, camera track, anchor track, every sound cue).
Curves & springs: `src/lib/motion.ts`. Nothing else hardcodes an event frame.

## Why v1 felt disconnected (post-mortem)

1. **Seven self-contained compositions.** Each scene built its own layout and entered from nothing; transitions were cross-fades between unrelated coordinate systems, so attention reset six times.
2. **No camera.** "Movement" was objects animating inside a static frame; zooms were local scale tricks, not a point of view.
3. **Uniform motion.** One spring/easing family on everything — tiles, type, dividers — so nothing had weight hierarchy; small things floated and big things snapped.
4. **Sound was a parallel track.** Cues were keyed to scene starts, not to the frame of the visual event; the music pulsed on its own grid while picture cut elsewhere.
5. **The product was abstracted.** Tiles and labels stood in for the real interface, so the film never showed the thing it sells.

## The v2 idea

**One world, one camera, one travelling object.** The whole film lives in a single continuous world per orientation. A virtual camera (keyed track, glide/sweep curves, parallax layers) moves through it; scenes are not compositions but *moments the camera finds*. The product itself provides the continuity: home → `/scan` form → machine running → results → allocation is one page flow in the real product, so the browser frame persists from S2 to S5 and only its *content* navigates.

**The anchor — "the leftover".** One rounded square tile with the exact geometry of the C-mark's squares, in orange: the leftover that doesn't fit the clean ring. It is pushed out of the mark in the opening, becomes the tagline's square period, lifts off as the cursor's focus ring, rides the CullMachine wires as the live dot, becomes the selection frame on a result row, lands as the recorded dot on the allocation, and returns home as the square period of the final tagline. One object, six jobs, zero invented logo changes.

## Motion vocabulary

- `GLIDE (0.16,1,0.3,1)` — default out-curve: type, rows, chips (the site's own ease).
- `SWEEP (0.65,0,0.35,1)` — camera moves and long travels: accelerates and decelerates over many frames.
- `SOFT (0.33,1,0.68,1)` — long settles (camera arrival, card landings).
- `TUCK (0.5,0,0.75,1)` — exits only.
- Springs (Remotion `spring()`, fps-locked) reserved for micro-interactions: button presses dip and recover on `settle`, status pills land on `settle`, the recorded dot drops on `pop` (one controlled overshoot). Camera and typography never spring; they run on the bezier vocabulary.
- Type enters by mask/clip with weight (leading edge first, tracked mono labels last); never slides in and out mechanically. Exits are masked or carried by the camera, never faded mid-read.

## Timed storyboard (frames @60fps; b = bar, beat = 36f)

**S1 COVER — 0–288 (b0–2).** f0: finished cover already composed (mark + CULLER + tagline + round period) — works as thumbnail. f12–96: mark squares do a staggered micro-settle wave; f60: the 27th square (orange) is pushed out of the mark's gap on `pop`; f60–150: it arcs to the tagline line; f150: lands as the square period (round period cross-fades out) — **cue: cover tick**. f150–232: hold, camera breathes in 1.0→1.06. f232–288: lockup + tagline begin travelling: lockup shrinks toward nav position, tagline stays put (it will become the hero H1 — same words, match cut).
**S2 ENTER — 288–576 (b2–4).** f288–340: browser frame assembles around the page (chrome draws, url types `culler.vercel.app`, nav links stagger); lockup lands as nav brand; tagline is now the hero H1 with sub + CTAs revealed by mask — **cue: frame assemble**. f340–430: camera glides to hero; cursor enters from right edge with anchor as its focus ring. f430–470: cursor travels to "Scan my wallet"; f470: press — button dips on `settle`, ring pulses — **cue: click**; f470–540: camera pushes *with* the press into the button (s→1.75), page content swaps to `/scan` under the push (motivated by the click). f540–576: camera eases back to frame the scan console.
**S3 SCAN — 576–1008 (b4–7).** f576–640: console: header "Open the machine bay.", CullMachine idle, form reveals; f640–700: address types into Solana field (deterministic fixture, mono, caret blink on beat); f700: "Scan wallet" press — **cue: click 2**; f700–740: header swaps to "Checking assets…", machine Wallet node goes live; f740–960: anchor dot rides wire Wallet→Scan (f760 **cue: wire 1**), Scan progress fills while state label steps Reading wallet → Indexing assets → Checking recovery paths → Classifying (each step = one soft tick, f800/840/880); dot rides Scan→Classify (f900 **cue: wire 2**) tallies count 3/2/4 on `settle`; dot rides Classify→Result (f940 **cue: wire 3**), Result figure resolves "0.4821 SOL / SOL value detected"; f960–1032: "Scan complete." — machine settles, camera begins pulling back — **cue: scan complete confirm**; the page scroll starts only after the complete beat lands (f1032), revealing rows already rendering below (overlap, no reset).
**S4 RESULTS — 1008–1296 (b7–9).** f1008: settle; f1032–1120: page scrolls the inventory into view as six rows enter staggered 12f apart, each: mask-wipe left→right, badge lands on a Remotion `spring` (`settle`), reason line last — **cue: row ticks at 1040/1064/1088, on the landings of rows 1/3/5**. f1100–1180: camera pushes toward the REVIEW row; f1180: anchor becomes its selection frame (draws around row on GLIDE); reason + "UNKNOWN — not guessed" chip readable; hold 60f so it reads. f1240–1296: camera glides down-page (row field parallaxes slower) toward allocation section — **cue: glide riser (soft)**.
**S5 ALLOCATION — 1296–1728 (b9–12).** f1296–1360: allocation section resolves: eyebrow "Scan complete", h2 "Your CULLER allocation"; f1360: amount counts up "+1,250 $CULLER" (mono, 24f) with state chip "YOUR CULLER ALLOCATION" — **cue: allocation confirm (warm)**; small mono note "Illustrative example scan" beside amount (mock data, marked). f1440–1560: evidence block: "How your allocation was built", points line, two contribution rows stagger; f1560–1620: proof trio checks draw (recorded, not guessed) — **cue: check ticks ×3**; f1620: anchor lands as recorded dot on the ledger row — **cue: record land**; f1620–1728: hold to read; camera micro-drift only.
**S6 OUTRO — 1728–2160 (b12–15).** f1728–1800: camera pulls back out of the browser (s→0.94) while chrome dims; allocation card lifts out of the page and its rectangle becomes the final card; row tiles + machine squares fly a bezier path into the mark's 26 positions — **cue: outro riser → mark settle tick (f1860)**. f1860–1920: wordmark mask-reveals; f1920: anchor flies from recorded dot to tagline period — **cue: logo resolution bell (f1932)**; f1980: square period lands — **cue: period tick**; f1980–2040: triad "Scan. Calculate. Record." + CTA + url stagger in on GLIDE. f2040–2160: brand hold, 2 s, camera still; music resolves to tonic pad, 2.5 s natural decay; last frame static.

## Sound (one map, `CUES` in timeline.ts)

Soundtrack: warm detuned pad per bar (15-bar arc: i–VI–III–VII colour, resolves to tonic at b12), sub pulse on beats 1+3 from b2, sparse off-beat ticks from b4, pentatonic plucks only at scene handoffs, risers into b2/b9/b12, bell at the logo resolution, decay tail over b15. SFX: only the cues listed above, each scheduled at the exact frame of its visual event, attacks matched to motion attacks (click = 8 ms, wire pass = 40 ms sweep, confirm = 120 ms warm body). No cue before its visual; nothing carries across a boundary except the deliberate risers.

## Truthfulness

Fixture wallet is fictional and labelled illustrative on-screen; scan states/labels/copy are the product's real strings; unknown stays "UNKNOWN — not guessed"; allocation is a recorded off-chain figure ("recorded, not guessed"), never a transfer or claim; registry truth unchanged (one verified, points-gated action, never shown executing).

## Fidelity pass (v3) — the interface IS the product

- **CullMachine is the live vertical node column** (`.node-flow` in
  `src/styles/components.css`): Wallet → Scan → Classify → Result stacked at
  360 px with 22 px wires and port dots, inside the two-column
  `.scan-console` (machine 0.8fr / controls 1.2fr; single column in portrait).
  Status lives in the Scan head, idle tallies show dashes, the Result node
  carries the orange `--secondary-soft` tint. The film never invents layout.
- **Orange is the action colour** (tokens.css): every solid button — hero
  "Scan my wallet", the scan form's "Scan wallet"/"Scanning", the end-card
  CTA — is `--secondary #ff7a1a` with `--text-on-secondary` dark text; the
  allocation amount uses the same orange as `.allocation-result-amount`.
  Blue stays the brand/links/progress colour (`--accent-text` fills the
  machine's progress bar, `--data` lights live node dots).
- **Domain shown is cullerlabs.xyz** (address bar + end card).
- **The end card has no panel**: logo, tagline, triad, CTA and URL sit
  directly on the background; the allocation card's border dissolves as the
  interface tiles condense into the mark.
- **Soundtrack carries a groove bed** under the cue-locked SFX: pad arc from
  bar 0, four-on-floor kick + rolling side-chained bass from bar 4 (the
  scan), off-beat hats and stabs from bar 6, an eighth-note arp lead over the
  results (bars 8–11), everything stripped at bar 12 so the logo bell and
  pad resolve alone into the 1.8 s tail. Original composition, 100 BPM.
