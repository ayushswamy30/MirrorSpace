"""
Turns the ink drawings in assets/art/ into Lowkei's glowing versions in
assets/art-glow/: the line work keeps its shape but takes an iridescent
gradient (each drawing its own pair of hues), with a soft halo of the same
light behind it. One file serves both themes.

    python scripts/art/glow.py
"""

import os

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, '..', '..', 'assets', 'art')
OUT = os.path.join(HERE, '..', '..', 'assets', 'art-glow')

# Gradient maps, deep to light — the scene palettes.
MAPS = {
    'dusk': ['#4B3BD6', '#8E5BFF', '#FF7FB5', '#FFC9A3'],
    'sea': ['#2F5BD0', '#4F9BF0', '#5FD3C0', '#D9FFF1'],
    'sun': ['#C2398F', '#FF6F91', '#FFA36B', '#FFE38A'],
    'lilac': ['#5B3BD6', '#B07BFF', '#FFB3D1', '#FFF0F6'],
}
CHOICE = {
    'eye': 'dusk', 'lily': 'sun', 'swan': 'sea', 'butterfly': 'sun', 'heart': 'sun', 'cat': 'lilac', 'urchin': 'dusk',
    'orchid': 'lilac', 'stamp': 'dusk', 'moka': 'sun', 'kittens': 'lilac', 'king': 'dusk', 'bandage': 'lilac', 'bean': 'sea',
    'beetle': 'sea', 'can': 'dusk', 'city': 'dusk', 'dice': 'sea', 'doll': 'lilac', 'masks': 'dusk', 'swallow': 'sea',
}


def hex_rgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32)


def gradient_map(t, stops):
    """t in [0,1] → colour along the stops."""
    cols = np.stack([hex_rgb(s) for s in stops])
    pos = t * (len(stops) - 1)
    i = np.clip(np.floor(pos).astype(int), 0, len(stops) - 2)
    f = (pos - i)[..., None]
    return cols[i] * (1 - f) + cols[i + 1] * f


def glow(name):
    im = Image.open(os.path.join(SRC, f'{name}.png')).convert('LA')
    lum = np.asarray(im, dtype=np.float32)[..., 0] / 255
    alpha = np.asarray(im, dtype=np.float32)[..., 1] / 255
    ink = (1 - lum) * alpha  # how much ink is at each point
    h, w = ink.shape

    # Colour runs diagonally across the drawing, and gets lighter where the
    # ink is thin, so shading still reads.
    yy, xx = np.mgrid[0:h, 0:w]
    diag = (xx / w * 0.6 + yy / h * 0.4)
    t = np.clip(0.15 + 0.55 * diag + 0.35 * (1 - ink), 0, 1)
    rgb = gradient_map(t, MAPS[CHOICE.get(name, 'dusk')])
    line = np.dstack([rgb, np.clip(ink * 1.15, 0, 1) * 255]).astype(np.uint8)
    line_im = Image.fromarray(line, 'RGBA')

    # A halo: the drawing's shape, blurred, in its lightest two colours.
    pad = int(max(w, h) * 0.14)
    canvas = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    halo_alpha = Image.fromarray((np.clip(ink * 3, 0, 1) * 255).astype(np.uint8), 'L')
    halo_alpha = halo_alpha.resize((w, h)).filter(ImageFilter.GaussianBlur(radius=max(w, h) * 0.045))
    stops = MAPS[CHOICE.get(name, 'dusk')]
    halo_col = Image.new('RGBA', (w, h), tuple(int(v) for v in hex_rgb(stops[2])) + (0,))
    halo_col.putalpha(halo_alpha.point(lambda a: int(a * 0.55)))
    canvas.alpha_composite(halo_col, (pad, pad))
    canvas.alpha_composite(line_im, (pad, pad))
    canvas.save(os.path.join(OUT, f'{name}.png'), optimize=True)
    return canvas.size


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    names = sorted({f[:-4] for f in os.listdir(SRC) if f.endswith('.png') and not f.endswith('-dark.png')})
    for n in names:
        print(n, glow(n))
