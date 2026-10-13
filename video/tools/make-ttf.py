#!/usr/bin/env python3
"""Decompress the brand woff2 files to TTF for the librsvg QA rasteriser.

The browser render uses the woff2 originals (video/public/fonts/*.woff2).
fontconfig/librsvg cannot read woff2, so the QA pipeline needs plain TTFs
with the same outlines. Regenerate with:

    pip install fonttools brotli
    python3 tools/make-ttf.py        (run from video/)

The TTFs are git-ignored; the woff2 masters are committed.
"""
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "public/fonts"

for woff in sorted(FONTS.glob("*.woff2")):
    font = TTFont(str(woff))
    font.flavor = None
    out = woff.with_suffix(".ttf")
    font.save(str(out))
    cmap = font.getBestCmap()
    print(f"{woff.name} -> {out.name}  glyphs={len(cmap)}")
