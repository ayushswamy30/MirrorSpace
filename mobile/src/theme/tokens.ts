/**
 * MirrorSpace design tokens.
 *
 * Warm paper and ink, plus one signal colour that shifts with the user's
 * Inner Weather. Nothing else is coloured: text is the interface.
 *
 * Every text/background pair used here is checked against WCAG 2.2 AA in
 * __tests__/contrast.test.ts, in both themes. Add a pair there whenever a new
 * one appears on screen.
 */

export type Weather = 'clear' | 'mild' | 'overcast' | 'fog' | 'storm';

export type Palette = {
  /** Page background. */
  paper: string;
  /** Raised surfaces: sheets, the care bar. */
  paperRaised: string;
  /** Body text. */
  ink: string;
  /** Secondary text: captions, receipts, labels. Still AA on paper. */
  inkSoft: string;
  /** Decorative only — never for text a user has to read. */
  inkFaint: string;
  /** Rules and outlines. */
  hairline: string;
  /** The one colour, keyed by Inner Weather. */
  signal: Record<Weather, string>;
};

export const light: Palette = {
  paper: '#F4EFE6',
  paperRaised: '#FBF8F2',
  ink: '#1C1A17',
  inkSoft: '#5B554C',
  inkFaint: '#A39B8E',
  hairline: '#DDD5C7',
  signal: {
    clear: '#9A5B1E',
    mild: '#6F6A2A',
    overcast: '#3F6576',
    fog: '#6A6258',
    storm: '#6A4A7E'
  }
};

export const dark: Palette = {
  paper: '#121110',
  paperRaised: '#1B1A18',
  ink: '#ECE6DA',
  inkSoft: '#A8A194',
  inkFaint: '#5E584F',
  hairline: '#2B2825',
  signal: {
    clear: '#E0A868',
    mild: '#C9C27A',
    overcast: '#8FB6C7',
    fog: '#B3AA9C',
    storm: '#BFA2D3'
  }
};

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
  xxl: 64
} as const;

export const radius = {
  sm: 6,
  md: 12,
  pill: 999
} as const;

/** Minimum touch target, per platform accessibility guidance. */
export const hitTarget = 44;
