# Culler brand kit

## Files
- `svg/` vector masters. Use these first.
  - `culler-logo-on-dark.svg`, `culler-logo-on-light.svg`: full logo, transparent background
  - `culler-mark-on-dark.svg`, `culler-mark-on-light.svg`: symbol only, transparent background
  - `*-white.svg`, `*-black.svg`: one-color versions (print, stamps, embossing)
  - `culler-icon-blue.svg`, `culler-icon-dark.svg`: app icon and avatar
  - `culler-og-image.svg`: social share card
- `png/` ready-made transparent PNGs, avatar (1024), share card (1200x630)
- `favicon/` favicon.svg, favicon.ico (16/32/48), apple-touch-icon, icon-192, icon-512, icon-maskable-512

## Colors (from the app UI)
| Name | Hex | Use |
|---|---|---|
| Ink | `#0A0E1A` | App background, text on light |
| Paper | `#F4F7FF` | Text on dark |
| Brand blue | `#3B63FF` | Primary brand color |
| Blue deep | `#2339D6` | Icon gradient bottom |
| Blue light | `#A8C0FF` | Tile highlights |

Tile gradient on dark: `#4468FF`, `#5C82FF`, `#B4C8FF`. On light: `#1E34B8`, `#2F52F0`, `#6F93FF`.
The orange button and green "verified" colors stay in the product UI and are not part of the logo.

## Type
Wordmark: Plus Jakarta Sans Bold, lowercase, converted to outlines. No font needed.

## Usage
- Clear space: keep at least half the mark's height free on all sides.
- Minimum sizes: full logo 96px wide, mark 20px, use the favicon files below 32px.
- Use the dark-background version on dark and the light-background version on light.
- Do not recolor tiles, stretch, rotate, add shadows, or place on busy images.

## Favicon snippet (Next.js app router)
Put `favicon.ico`, `icon.svg` (favicon.svg renamed), and `apple-icon.png` (apple-touch-icon.png renamed) in `app/`.
