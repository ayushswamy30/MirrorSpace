"""
Builds assets/pictures/<slot>.webp — every picture the app shows — from the
originals in design/images/ (see design/image-prompts.md for the 26 slots).

    python mobile/scripts/pictures.py
"""

import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
ORIGINALS = os.path.join(ROOT, 'design', 'images')
OUT = os.path.join(ROOT, 'mobile', 'assets', 'pictures')

# slot → longest side, in pixels
SLOTS = {
    'sky-clear': 1600,
    'sky-mild': 1600,
    'sky-overcast': 1600,
    'sky-fog': 1600,
    'sky-storm': 1600,
    'sky-dawn': 1600,
    'room-mirror': 1600,
    'room-circle': 1600,
    'room-welcome': 1600,
    'room-calm': 1600,
    'mood-wound-up': 1100,
    'mood-bright': 1100,
    'mood-heavy': 1100,
    'mood-easy': 1100,
    'sticker-lily': 640,
    'sticker-koi': 640,
    'sticker-orchid': 640,
    'sticker-butterfly': 640,
    'sticker-sun': 640,
    'sticker-jelly-cat': 640,
    'sticker-cloud': 640,
    'sticker-ghost': 640,
    'sticker-star-child': 640,
    'sticker-flower-frame': 640,
    'sticker-eye': 640,
    'sticker-cherries': 640,
}


def original(slot):
    for ext in ('png', 'jpg', 'jpeg', 'webp'):
        path = os.path.join(ORIGINALS, f'{slot}.{ext}')
        if os.path.exists(path):
            return Image.open(path)
    raise SystemExit(f'{slot}: no image in design/images')


def main():
    os.makedirs(OUT, exist_ok=True)
    for slot, size in SLOTS.items():
        im = original(slot).convert('RGB')
        im.thumbnail((size, size), Image.LANCZOS)
        im.save(os.path.join(OUT, f'{slot}.webp'), 'WEBP', quality=80, method=6)
    print(f'{len(SLOTS)} pictures')


if __name__ == '__main__':
    main()
