import type { TextStyle } from 'react-native';

/**
 * Two families only: a display serif for the sentences the app speaks, and a
 * monospace for data receipts ("3 nights under 6h"). Both are open-source
 * (SIL OFL), loaded in the root layout.
 */
export const fonts = {
  serifLight: 'Fraunces_300Light',
  serif: 'Fraunces_400Regular',
  serifItalic: 'Fraunces_400Regular_Italic',
  serifMedium: 'Fraunces_500Medium',
  mono: 'JetBrainsMono_400Regular'
} as const;

/**
 * Dynamic Type / font scaling is honoured up to 200%, the ceiling the report
 * sets. Above that, the big serif headlines stop fitting on a phone.
 */
export const maxFontScale = 2;

export type TextVariant =
  | 'reading'
  | 'title'
  | 'body'
  | 'bodyItalic'
  | 'caption'
  | 'receipt'
  | 'label';

export const textVariants: Record<TextVariant, TextStyle> = {
  // The daily reading: the largest thing in the app, and usually the only one.
  reading: { fontFamily: fonts.serifLight, fontSize: 34, lineHeight: 42, letterSpacing: -0.4 },
  title: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 32, letterSpacing: -0.2 },
  body: { fontFamily: fonts.serif, fontSize: 18, lineHeight: 27 },
  bodyItalic: { fontFamily: fonts.serifItalic, fontSize: 18, lineHeight: 27 },
  caption: { fontFamily: fonts.serif, fontSize: 15, lineHeight: 22 },
  receipt: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 19, letterSpacing: 0.2 },
  label: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 16, letterSpacing: 1.2, textTransform: 'lowercase' }
};
