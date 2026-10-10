import type { Weather } from './tokens';

/**
 * Auras — the soft, drifting colour behind every page. Lowkei's look is paper
 * and ink with light coming through it: airbrushed pastel glows by day,
 * luminous colour on deep indigo by night. Each Inner Weather has its own
 * palette, so the whole app quietly takes on the colour of the day.
 *
 * Colour stays in the aura, never under text at full strength: every glow is
 * drawn at `strength` over the page, and the contrast test checks text on the
 * strongest blend of each palette.
 */

export type AuraName = Weather | 'dawn' | 'void';

type Palettes = Record<AuraName, readonly [string, string, string, string]>;

export const auraLight: Palettes = {
  /** Before there's a day to read: periwinkle, pink, peach, mint. */
  dawn: ['#8FA2FF', '#FF9EC8', '#FFC08A', '#9EEBD6'],
  clear: ['#FFB778', '#FF94C2', '#FFD873', '#B9A2FF'],
  mild: ['#86E3BC', '#BDEB93', '#93CBFF', '#FFD9A0'],
  overcast: ['#8FA2FF', '#B9A2FF', '#86B8F2', '#D9B8FF'],
  fog: ['#C4BCF2', '#B7CBEF', '#F0C2DA', '#D3CCF5'],
  storm: ['#7F72FF', '#B97BFF', '#6F94FF', '#FF8FD0'],
  /** The Mirror's room. */
  void: ['#5B4BFF', '#C24BFF', '#2F7BFF', '#FF5FB8']
};

export const auraDark: Palettes = {
  dawn: ['#5B5BFF', '#D24B9E', '#E07A4F', '#2BB59A'],
  clear: ['#E08A3C', '#D2508C', '#E0B23C', '#8B5BFF'],
  mild: ['#2BB59A', '#6FBF4A', '#3C8DE0', '#5B6BFF'],
  overcast: ['#5B6BFF', '#8E5BFF', '#3C7BE0', '#C05BD0'],
  fog: ['#6A6ACF', '#4F7FBF', '#A05B9E', '#7E6FD0'],
  storm: ['#6B4BFF', '#B03FE0', '#2F5BD0', '#E0408E'],
  void: ['#5B4BFF', '#C24BFF', '#2F7BFF', '#FF5FB8']
};

/** How strongly the glow shows over the page, at its centre. */
export const auraStrength = { light: 0.42, dark: 0.33, void: 0.42 } as const;

export function auraFor(weather: Weather | null, scheme: 'light' | 'dark', room?: 'void') {
  if (room === 'void') return auraDark.void;
  const set = scheme === 'dark' ? auraDark : auraLight;
  return set[weather ?? 'dawn'];
}

/** `fg` laid over `bg` at `alpha` — what the eye sees where a glow is strongest. */
export function blend(bg: string, fg: string, alpha: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(i, i + 2), 16);
  const out = [1, 3, 5].map(i => Math.round(ch(bg, i) * (1 - alpha) + ch(fg, i) * alpha));
  return `#${out.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}
