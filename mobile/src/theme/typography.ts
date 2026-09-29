import type { TextStyle } from 'react-native';

/**
 * Editorial, like a printed almanac: a crisp serif for the sentences the app
 * speaks, small spaced capitals in a grotesk for labels and actions, and a
 * monospace for data receipts ("3 nights under 6h"). All three are
 * open-source (SIL OFL), loaded in the root layout.
 */
export const fonts = {
  serifLight: 'Newsreader_300Light',
  serif: 'Newsreader_400Regular',
  serifItalic: 'Newsreader_400Regular_Italic',
  serifMedium: 'Newsreader_500Medium',
  sans: 'Inter_500Medium',
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
  | 'label'
  | 'action';

export const textVariants: Record<TextVariant, TextStyle> = {
  // The daily reading: the largest thing in the app, and usually the only one.
  reading: { fontFamily: fonts.serifLight, fontSize: 36, lineHeight: 42, letterSpacing: -0.6 },
  title: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 32, letterSpacing: -0.3 },
  body: { fontFamily: fonts.serif, fontSize: 18, lineHeight: 26 },
  bodyItalic: { fontFamily: fonts.serifItalic, fontSize: 18, lineHeight: 26 },
  caption: { fontFamily: fonts.serif, fontSize: 16, lineHeight: 22 },
  receipt: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 19, letterSpacing: 0.2 },
  // Section heads, the masthead, tab names. Capitals are a style only: screen
  // readers still get the words, not spelled-out letters.
  label: { fontFamily: fonts.sans, fontSize: 11, lineHeight: 16, letterSpacing: 1.8, textTransform: 'uppercase' },
  // What a button says.
  action: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, letterSpacing: 1.6, textTransform: 'uppercase' }
};
