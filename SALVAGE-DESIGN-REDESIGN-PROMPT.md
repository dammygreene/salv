# SALVAGE — Visual Redesign / Design-Lab Prompt

## Read this before touching the UI

The current SALVAGE prototype is functional, but the visual result is **not acceptable**.

The current screenshot looks like a dark crypto dashboard with rectangular metal borders. That is not the intended identity.

The redesign must be treated as a **visual re-art-direction**, not a CSS polish pass.

Reference the attached screenshots:

1. Current SALVAGE prototype: technically clean, but too sharp, too linear, too dashboard-like and too AI-generated.
2. Y2K futurism reference: glossy blue/silver, soft organic forms, luminous translucent materials, layered depth, early-2000s futurist consumer-tech/album-art energy.

The target is **CYBER CHROME Y2K FUTURISM**.

---

# 1. USE THE DESIGN SKILLS

Install/use the design skills before redesigning.

```bash
npx skills add https://github.com/nextlevelbuilder/ui-ux-pro-max-skill --skill ui-ux-pro-max
npx skills add https://github.com/Leonxlnx/taste-skill --skill redesign-existing-projects
npx skills add https://github.com/Leonxlnx/taste-skill --skill gpt-taste
npx skills add https://github.com/Leonxlnx/taste-skill --skill image-to-code
npx skills add https://github.com/0xdesign/design-plugin --skill design-lab
```

If a command/package name differs in the current skill docs, follow the currently documented installation command rather than inventing a replacement.

For this existing codebase, use **redesign-existing-projects** rather than treating the app as a greenfield page.

Use **gpt-taste** aggressively to avoid generic AI frontend patterns.

Use **image-to-code** / the attached references as visual input.

Use **design-lab** to generate multiple distinct design directions before finalizing one.

Do not settle for the first generated design.

---

# 2. FIRST AUDIT THE CURRENT UI

Before changing code, explicitly identify why the current screenshot feels wrong.

Current problems to eliminate:

- excessive sharp rectangular borders
- too many boxes inside boxes
- flat dark surfaces
- generic dashboard composition
- repetitive monospace labels
- generic centered SaaS hero
- excessive 1px outlines
- obvious Tailwind/card-library structure
- fake "futuristic" labels that don't contribute to the experience
- insufficient depth
- insufficient material richness
- insufficient blue/silver futurism
- too little organic curvature
- too little visual hierarchy
- too much UI chrome and not enough actual art direction
- title treatment feels generic rather than branded
- overall page reads as "AI-generated crypto UI"

Do not solve these by adding more gradients or more glows.

The solution is **composition + materials + typography + depth + restraint**.

---

# 3. TARGET ART DIRECTION

## SALVAGE should feel like:

A futuristic consumer-tech machine from approximately 2000–2005.

Imagine:

- high-end Y2K electronics
- glossy silver hardware
- translucent blue acrylic
- futuristic car interiors
- premium CD / MP3 / media hardware
- Japanese/European futurist industrial design
- early-2000s sci-fi interface graphics
- 2000s technology advertising
- chrome + ice-blue + black
- physical objects combined with digital information

The reference should feel:

**futuristic, optimistic, strange, glossy, tactile, premium, slightly alien**

Not dystopian.

Not cyberpunk.

Not military.

Not hacker.

Not "AI startup."

Not "crypto terminal."

---

# 4. IMPORTANT: FUTURISM ≠ CYBERPUNK

Do not use the normal cyberpunk visual vocabulary.

Avoid:

- magenta/purple neon
- green matrix rain
- hacker terminals
- huge neon borders
- glitch spam
- scanline overload
- random code blocks
- skulls
- robots
- dark dystopian scenes

SALVAGE is **clean futurism**.

Think:

**2003 imagined 2025**

rather than:

**2077 dystopia**

---

# 5. SHAPE LANGUAGE

The biggest visual correction:

## STOP MAKING EVERYTHING A RECTANGLE.

Use a mixture of:

- large rounded capsules
- soft bevels
- elliptical shapes
- orbital rings
- curved housings
- pill-shaped controls
- irregular glass/chrome panels
- soft cut corners
- large circular objects
- nested curved surfaces
- smooth arcs
- asymmetric containers

Corners should feel **soft and engineered**, not sharp.

Use `border-radius` deliberately and consistently.

Do not make every component a 12px rounded card either.

The shapes should feel like **physical industrial design**.

---

# 6. MATERIALS

## POLISHED CHROME

Use chrome for high-value controls and branded objects.

Chrome should have:

- bright white highlights
- cool silver mids
- dark reflective edges
- directional reflections
- soft beveling
- subtle environmental color

Chrome should look like metal.

Do not fake chrome with the same generic gradient everywhere.

---

## BLUE ACRYLIC

This is the missing material from the current design.

Introduce translucent icy-blue glass/acrylic surfaces.

Use:

- low-opacity blue
- soft blur
- internal highlights
- translucent overlap
- depth through layers

Think translucent early-2000s electronics.

---

## BLACK GLASS / SCREEN

Use very dark inset surfaces for actual information displays.

These should look like **screens inside hardware**, not cards.

---

## SOFT METAL

Secondary surfaces can be brushed aluminum / gunmetal.

Use subtle directional texture.

---

# 7. COLOR DIRECTION

Primary palette:

- near-black
- graphite
- silver
- chrome
- cold white
- icy blue
- luminous cyan

Optional tiny accent:

- pale electric blue

Do NOT use:

- purple
- hot pink
- rainbow gradients
- orange
- red as a primary accent
- large neon cyan glows everywhere

Blue should feel like reflected light, not nightclub neon.

---

# 8. BACKGROUND

The background should have depth.

Do not use a flat black canvas.

Build a subtle environment using layers:

- black/graphite base
- soft radial blue light
- extremely subtle grain
- faint reflective gradients
- large blurred translucent forms
- optional ultra-faint geometric Y2K texture

The environment should feel like there is **something behind the UI**.

Avoid obvious starfields.

Avoid obvious grids.

Avoid generic aurora gradients.

---

# 9. TYPOGRAPHY

Use a clean geometric display face for:

SALVAGE
large headings
major values

Use a restrained mono face only for:

system metadata
wallet addresses
technical identifiers
status labels
block numbers

Do not turn the whole site into monospace.

The current implementation overuses tiny mono labels. Reduce them substantially.

Typography hierarchy should feel editorial and premium.

Large headings can be visually bold and expressive.

---

# 10. LOGO / WORDMARK

The SALVAGE wordmark must eventually have a distinctive visual mark.

Do not simply use text plus a circle icon.

The eventual mark should feel:

- chrome
- compact
- recognizable
- slightly industrial
- able to work as a favicon
- able to sit on physical-looking hardware

Avoid literal trash cans.

Avoid recycle arrows.

Avoid generic S gradients.

---

# 11. HERO REDESIGN

Do not use the current:

```text
SALVAGE
YOUR WALLET HAS LEFTOVERS.
paragraph
wallet input
```

as a standard centered landing page stack.

Instead build an **object-centric hero**.

The page should feel like a machine/object has entered the scene.

Possible composition:

- oversized chrome/blue SALVAGE device
- wallet scan interface integrated into it
- floating translucent objects around it
- curved layers
- large display surface
- subtle depth
- asymmetrical but balanced composition

The scan control should appear to belong to the machine.

The machine is the hero.

The copy supports it.

---

# 12. WALLET INPUT

Do not make it look like a normal HTML form.

Design it like a futuristic hardware slot / cartridge / console.

Could be:

- a long rounded metallic slot
- translucent blue glass
- soft inset screen
- chrome action button
- tiny status light
- tactile press interaction

It should be visually obvious that this is where the wallet enters the system.

---

# 13. SCAN ANIMATION

The current scan animation feels like a generic loading component.

Replace it with a real **machine activation sequence**.

The user should feel:

1. device wakes up
2. lens/surface activates
3. light passes through
4. wallet information is pulled in
5. assets materialize
6. machine returns a result

Possible animation language:

- light sweep
- radial rings
- expanding/contracting translucent geometry
- data appearing inside a glass display
- mechanical slide
- soft chrome reflection
- tiny status LEDs

Animation should be 60fps and responsive.

Never delay functionality just to play a cinematic animation.

---

# 14. RESULTS

Do not use a conventional four-column dashboard.

Think of results as **compartments / instruments / physical modules**.

For example:

### RECOVER

A large glass module with a bright numerical display.

### SALVAGE

A physical collection tray.

### WATCH

A translucent diagnostic module.

### UNKNOWN

A sealed diagnostic compartment.

Use size differences to establish hierarchy.

Not every module needs equal visual weight.

---

# 15. SALVAGE BIN

Keep the salvage bin concept.

But make it a visually memorable object.

It should feel like:

**a futuristic material recycler**

rather than:

**a trash can icon**

Possible visual direction:

- circular chrome intake
- translucent blue chamber
- glass containment tube
- glowing internal mechanism
- soft curved edges

When assets enter:

- they physically move toward the chamber
- shrink slightly
- disappear behind a glass layer
- the chamber reacts
- counter increments
- tiny particles remain briefly

The interaction should feel physical.

---

# 16. RESULTS SHOULD LOOK LIKE OBJECTS, NOT CARDS

Every asset item should have its own visual identity.

Instead of:

```text
[ICON] TOKEN
price
status
checkbox
```

use:

- asset thumbnail
- small metadata strip
- status light
- quantity
- visual material treatment

Some cards can overlap slightly.

Some can be wider.

Some can use a glass capsule.

Variation is important.

Avoid perfectly repetitive rows.

---

# 17. NAVIGATION

Do not use a normal SaaS navbar.

Navigation should look like part of the machine.

Potential structure:

- chrome wordmark
- compact floating nav capsule
- translucent glass controls
- wallet capsule
- status LED

It can float independently from the main content.

---

# 18. VISUAL DEPTH

The current interface feels like a screenshot of HTML.

The new version should have at least 3 depth layers:

### BACKGROUND

environment / light / texture

### OBJECT LAYER

chrome, acrylic, machine components

### INFORMATION LAYER

actual UI text and data

Use blur, reflection, overlap and shadow to separate these layers.

---

# 19. AVOID AI-SLOP PATTERNS

Strictly avoid:

- every section inside a rounded card
- gradient text for headings
- giant centered hero text
- random pill badges
- arbitrary decorative dots
- excessive glowing borders
- floating gradient blobs
- "AI powered" visual clichés
- random 3D cubes
- excessive noise
- repeated component shapes
- identical card widths everywhere
- decorative monospace labels with no meaning
- fake technical numbers
- arbitrary orbital diagrams used only because they look futuristic

Every visual detail must have a reason.

---

# 20. DESIGN LAB PROCESS

Use the Design Lab before committing.

Generate **5 genuinely different SALVAGE homepage directions**.

Do not generate five color variations of the same layout.

Explore:

### Direction A
Glossy Y2K consumer electronics

### Direction B
Futurist industrial machine

### Direction C
Blue acrylic / chrome media device

### Direction D
Organic futuristic interface

### Direction E
Premium 2000s sci-fi software / hardware hybrid

Then compare them side-by-side.

Choose the strongest composition, not the safest one.

Synthesize the chosen direction.

Generate a `DESIGN_PLAN.md` / design memory if the tool creates one.

---

# 21. IMAGE REFERENCE RULE

The attached Y2K reference should influence:

- material
- lighting
- color
- depth
- composition
- futurist mood

Do NOT literally copy its objects or layout.

Extract the visual principles.

The reference has:

- glossy silver
- saturated cool blue
- translucent layers
- spherical/organic forms
- luminous highlights
- layered depth
- futuristic optimism
- visual richness

SALVAGE should translate those principles into a usable product.

---

# 22. DESKTOP COMPOSITION

At 1440px:

The hero should not be a narrow centered box.

Use the full viewport.

Allow large negative space around the hero object.

Create visual tension through asymmetry.

Possible structure:

left:
brand/copy

center:
large SALVAGE machine

right:
small system telemetry

But do not make this rigid.

Use the design skill to explore the strongest composition.

---

# 23. MOBILE COMPOSITION

At 390px and 430px:

Do not simply stack desktop cards.

Instead create a compact single-device composition.

The machine remains visually important.

The wallet control remains prominent.

Results become vertically layered modules.

Do not sacrifice the futuristic identity just because the screen is small.

---

# 24. MOTION DIALS

Set the taste skill direction approximately toward:

DESIGN_VARIANCE: 8/10
MOTION_INTENSITY: 7/10
VISUAL_DENSITY: 4/10

The page should be expressive and animated but not cramped.

The taste skill uses these three dials for layout experimentation, motion depth and visual density.

---

# 25. ACCESSIBILITY / QUALITY

Maintain:

- keyboard navigation
- visible focus
- semantic controls
- reduced motion
- safe text wrapping
- no clipped wallet addresses
- usable 375px+ layouts
- adequate contrast
- touch-friendly controls

Do not sacrifice usability for aesthetics.

---

# 26. IMPLEMENTATION

Keep the current functionality:

- wallet connection state
- scan states
- scan completion
- asset classification
- salvage bin
- transaction review
- Proof of Salvage
- mobile layout
- reduced motion

Rebuild the visual system around them.

Prefer actual CSS/material construction over image backgrounds where possible.

Use SVG/CSS for interface graphics.

Use WebGL/Three.js only where it genuinely adds value and remains performant.

Do not add unnecessary dependencies.

---

# 27. SUCCESS TEST

After implementation, ask:

### Question 1

Does this look like a normal crypto dashboard?

If yes: redesign it again.

### Question 2

Does it look like a generic AI-generated futuristic UI?

If yes: redesign it again.

### Question 3

Does it look like a dark website with chrome borders?

If yes: redesign it again.

### Question 4

Does it feel like a futuristic physical device / operating environment from the Y2K era?

If yes: continue.

### Question 5

Can the SALVAGE brand be recognized from one screenshot with the text hidden?

If no: strengthen the visual identity.

---

# 28. FINAL QA

Render and inspect at:

- 1440x900
- 1280x800
- 1024x768
- 768x1024
- 430x932
- 390x844
- 375x812

Do not report "visual QA passed" simply because the page technically renders.

Evaluate against this art direction.

The current screenshot is the baseline of what **not** to repeat.

The final result should have:

**soft forms**
**chrome**
**icy blue**
**translucent acrylic**
**layered depth**
**Y2K futurism**
**premium typography**
**distinctive object-centric interaction**
**real visual authorship**

The target is not "clean".

The target is:

# **FUTURE, BUT FROM 2003.**
