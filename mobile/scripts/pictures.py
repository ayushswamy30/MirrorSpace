"""
Builds assets/pictures/<slot>.webp — every picture the app shows — from the
originals in design/images/ (see design/image-prompts.md for the 26 slots).

Until an original exists for a slot, a placeholder is taken from the
reference zip ("all_images (1).zip" in the repo root). Placeholders are
other artists' work, for this project only: assets/pictures/ stays out of git
while any slot is a placeholder (see the root .gitignore).

    python mobile/scripts/pictures.py
"""

import io
import os
import zipfile

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
ORIGINALS = os.path.join(ROOT, 'design', 'images')
ZIP = os.path.join(ROOT, 'all_images (1).zip')
OUT = os.path.join(ROOT, 'mobile', 'assets', 'pictures')

# slot → (longest side, placeholder from the zip)
SLOTS = {
    'sky-clear': (1600, '1000275575'),
    'sky-mild': (1600, '1000275568'),
    'sky-overcast': (1600, '1000275570'),
    'sky-fog': (1600, '1000275560'),
    'sky-storm': (1600, '1000275562'),
    'sky-dawn': (1600, '1000275573'),
    'room-mirror': (1600, '1000275557'),
    'room-circle': (1600, '1000275559'),
    'room-welcome': (1600, '1000275581'),
    'room-calm': (1600, '1000275576'),
    'mood-wound-up': (1100, '1000275561'),
    'mood-bright': (1100, '1000275579'),
    'mood-heavy': (1100, '1000275578'),
    'mood-easy': (1100, '1000275569'),
    'sticker-lily': (640, '1000275579'),
    'sticker-koi': (640, '1000275576'),
    'sticker-orchid': (640, '1000275572'),
    'sticker-butterfly': (640, '1000275574'),
    'sticker-sun': (640, '1000275575'),
    'sticker-jelly-cat': (640, '1000275563'),
    'sticker-cloud': (640, '1000275567'),
    'sticker-ghost': (640, '1000275559'),
    'sticker-star-child': (640, '1000275558'),
    'sticker-flower-frame': (640, '1000275566'),
    'sticker-eye': (640, '1000275581'),
    'sticker-cherries': (640, '1000275583'),
}


def original(slot):
    for ext in ('png', 'jpg', 'jpeg', 'webp'):
        path = os.path.join(ORIGINALS, f'{slot}.{ext}')
        if os.path.exists(path):
            return Image.open(path)
    return None


def main():
    os.makedirs(OUT, exist_ok=True)
    zip_file = zipfile.ZipFile(ZIP) if os.path.exists(ZIP) else None
    entries = {os.path.splitext(os.path.basename(n))[0]: n for n in zip_file.namelist()} if zip_file else {}
    placeholders = []
    for slot, (size, ref) in SLOTS.items():
        im = original(slot)
        if im is None:
            if ref not in entries:
                raise SystemExit(f'{slot}: no original in design/images and no placeholder zip')
            im = Image.open(io.BytesIO(zip_file.read(entries[ref])))
            placeholders.append(slot)
        im = im.convert('RGB')
        im.thumbnail((size, size), Image.LANCZOS)
        im.save(os.path.join(OUT, f'{slot}.webp'), 'WEBP', quality=80, method=6)
    print(f'{len(SLOTS) - len(placeholders)} originals, {len(placeholders)} placeholders')
    if placeholders:
        print('placeholders:', ', '.join(placeholders))


if __name__ == '__main__':
    main()
