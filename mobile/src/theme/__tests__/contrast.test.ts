import { dark, light, type Palette, type Weather } from '../tokens';

/**
 * WCAG 2.2 AA, both themes (report §6). Body text needs 4.5:1; the care bar
 * outline and other non-text UI need 3:1.
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
    ['soft ink on raised paper', p.inkSoft, p.paperRaised]
  ])('%s is AA for text', (_label, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  test.each(weathers)('signal colour "%s" is AA for text on paper', weather => {
    // The focused tab label and signal-toned text use this colour.
    expect(contrast(p.signal[weather], p.paper)).toBeGreaterThanOrEqual(4.5);
  });

  test('ink outline on raised paper is AA for non-text UI', () => {
    expect(contrast(p.ink, p.paperRaised)).toBeGreaterThanOrEqual(3);
  });
});
