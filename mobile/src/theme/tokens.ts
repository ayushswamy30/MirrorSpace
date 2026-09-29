/**
 * MirrorSpace design tokens.
 *
 * Black and white, like a printed page: ink on paper, inverted at night.
 * Surfaces are separated by hairline rules rather than fills, and a selected
 * thing is shown by inverting it. The one colour is the Inner Weather signal,
 * kept to small marks — the weather dot in the masthead and the current tab —
 * so it reads as a note in the margin, never as decoration.
 *
 * Every text/background pair used here is checked against WCAG 2.2 AA in
 * __tests__/contrast.test.ts, in both themes. Add a pair there whenever a new
 * one appears on screen.
 */

export type Weather = 'clear' | 'mild' | 'overcast' | 'fog' | 'storm';

export type Palette = {
  /** Page background. */
  paper: string;
  /** Raised surfaces. The same as paper: the page is flat, rules divide it. */
  paperRaised: string;
  /** Body text. */
  ink: string;
  /** Secondary text: captions, receipts, labels. Still AA on paper. */
  inkSoft: string;
  /** Decorative only — never for text a user has to read. */
  inkFaint: string;
  /** Rules and outlines — drawn at hairline width, so they can be full ink. */
  hairline: string;
  /** The one colour, keyed by Inner Weather. Small marks only. */
  signal: Record<Weather, string>;
};

export const light: Palette = {
  paper: '#FFFFFF',
  paperRaised: '#FFFFFF',
  ink: '#000000',
  inkSoft: '#5E5E5E',
  inkFaint: '#B3B3B3',
  hairline: '#000000',
  signal: {
    clear: '#9A5B1E',
    mild: '#6F6A2A',
    overcast: '#3F6576',
    fog: '#6A6258',
    storm: '#6A4A7E'
  }
};

export const dark: Palette = {
  paper: '#000000',
  paperRaised: '#000000',
  ink: '#FFFFFF',
  inkSoft: '#A3A3A3',
  inkFaint: '#4D4D4D',
  hairline: '#FFFFFF',
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

/** Square, like print. Only the weather dot is round. */
export const radius = {
  none: 0,
  dot: 999
} as const;

/** Minimum touch target, per platform accessibility guidance. */
export const hitTarget = 44;
