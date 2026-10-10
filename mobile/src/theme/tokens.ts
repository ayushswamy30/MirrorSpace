/**
 * Lowkei design tokens — see DESIGN.md.
 *
 * A printed almanac: near-white paper and black ink, inverted at night.
 * Surfaces are separated by rules and space rather than fills, and a selected
 * thing is shown by inverting it. The one colour is the Inner Weather signal,
 * kept to small marks — the weather dot and the current tab — so it reads as
 * a note in the margin, never as decoration.
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
  /** Rules and outlines — drawn thin, so they can be full ink. */
  hairline: string;
  /** Thick section breaks, pressed rows, the search field. */
  band: string;
  /** The rare soft surface: a writing prompt, a sheet. */
  tint: string;
  /** The disc an illustration sits in, a shade lighter than the page. */
  disc: string;
  /** Full-dark rooms (Mirror) keep this in both themes, with light text. */
  void: string;
  /** The one colour, keyed by Inner Weather. Small marks only. */
  signal: Record<Weather, string>;
  /** Frosted glass over the aura: cards, the tab bar, sheets. */
  glass: string;
  /** The bright edge a glass card catches. */
  glassEdge: string;
};

export const light: Palette = {
  paper: '#F7F6FA',
  paperRaised: '#F7F6FA',
  ink: '#14131C',
  inkSoft: '#4F4E66',
  inkFaint: '#B9B8C7',
  hairline: '#14131C',
  band: '#ECEAF4',
  tint: '#F7EEF6',
  disc: '#FFFFFF',
  void: '#08071A',
  signal: {
    clear: '#9A5B1E',
    mild: '#6F6A2A',
    overcast: '#3F6576',
    fog: '#6A6258',
    storm: '#6A4A7E'
  },
  glass: 'rgba(255,255,255,0.52)',
  glassEdge: 'rgba(255,255,255,0.9)'
};

export const dark: Palette = {
  paper: '#0C0B16',
  paperRaised: '#0C0B16',
  ink: '#F2F1F7',
  inkSoft: '#B8B6CC',
  inkFaint: '#46445C',
  hairline: '#F2F1F7',
  band: '#191829',
  tint: '#1E1630',
  disc: '#1B1A2E',
  void: '#08071A',
  signal: {
    clear: '#E0A868',
    mild: '#C9C27A',
    overcast: '#8FB6C7',
    fog: '#B3AA9C',
    storm: '#BFA2D3'
  },
  glass: 'rgba(255,255,255,0.07)',
  glassEdge: 'rgba(255,255,255,0.16)'
};

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
  xxl: 64
} as const;

/** The page's side margin. */
export const gutter = 20;

/** The widest the page column gets (the browser preview, a large phone). */
export const MAX_WIDTH = 430;

/** Soft glass cards and pill buttons; the weather dot is round. */
export const radius = {
  none: 0,
  card: 22,
  pill: 999,
  dot: 999
} as const;

/** Minimum touch target, per platform accessibility guidance. */
export const hitTarget = 44;
