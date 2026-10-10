import { dark, light, type Palette, type Weather } from '../tokens';
import { auraDark, auraLight, auraStrength, blend } from '../aura';

/**
 * WCAG 2.2 AA, both themes (report §6). Body text needs 4.5:1; outlines
 * and other non-text UI need 3:1.
 */

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const weathers: Weather[] = ['clear', 'mild', 'overcast', 'fog', 'storm'];

describe.each<[string, Palette]>([
  ['light', light],
  ['dark', dark]
])('%s theme', (_, p) => {
  test.each([
    ['ink on paper', p.ink, p.paper],
    ['ink on raised paper', p.ink, p.paperRaised],
    ['soft ink on paper', p.inkSoft, p.paper],
    ['soft ink on raised paper', p.inkSoft, p.paperRaised],
    // Selected words, tags and the primary button are inverted.
    ['paper on ink', p.paper, p.ink],
    // Pressed rows and the search field sit on the band.
    ['soft ink on band', p.inkSoft, p.band],
    // The writing sheet: its prompt, its text and its placeholder.
    ['ink on tint', p.ink, p.tint],
    ['soft ink on tint', p.inkSoft, p.tint]
  ])('%s is AA for text', (_label, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  test.each(weathers)('signal colour "%s" is AA for text on paper', weather => {
    // Used for small marks (the weather dot, the current tab), which need
    // only 3:1 — held to the text bar anyway, so it can carry text if needed.
    expect(contrast(p.signal[weather], p.paper)).toBeGreaterThanOrEqual(4.5);
  });

  test('ink outline on raised paper is AA for non-text UI', () => {
    expect(contrast(p.ink, p.paperRaised)).toBeGreaterThanOrEqual(3);
  });

  test('light text in the void room is AA', () => {
    expect(contrast(dark.ink, p.void)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark.inkSoft, p.void)).toBeGreaterThanOrEqual(4.5);
  });

  test('rules and outlines are AA for non-text UI', () => {
    // Chip and field outlines are the only sign they can be tapped.
    expect(contrast(p.hairline, p.paper)).toBeGreaterThanOrEqual(3);
  });
});

describe('text over the aura', () => {
  // Where a glow is strongest, the page is the palette colour laid over paper
  // at the aura's strength. Body text and captions must still read there.
  const cases: [string, Palette, typeof auraLight, number][] = [
    ['light', light, auraLight, auraStrength.light],
    ['dark', dark, auraDark, auraStrength.dark]
  ];
  for (const [scheme, p, set, alpha] of cases) {
    for (const [name, colours] of Object.entries(set)) {
      if (name === 'void') continue;
      test.each(colours)(`${scheme} ${name}: ink and soft ink on %s`, colour => {
        const bg = blend(p.paper, colour, alpha);
        expect(contrast(p.ink, bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.inkSoft, bg)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe('text on surfaces over pictures', () => {
  // A translucent surface over a picture shows the picture through it; the
  // worst case is the brightest or darkest pixel a picture can have.
  const over = (surface: string, under: string) => {
    const [r, g, b, a] = surface.match(/[\d.]+/g)!.map(Number);
    const fg = `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
    return blend(under, fg, a);
  };
  test.each<[string, Palette]>([
    ['light', light],
    ['dark', dark]
  ])('%s: ink and soft ink stay AA on the frost label and the sheet, over any picture', (_, p) => {
    for (const surface of [p.frost, p.sheet]) {
      for (const under of ['#FFFFFF', '#000000']) {
        const bg = over(surface, under);
        expect(contrast(p.ink, bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.inkSoft, bg)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
