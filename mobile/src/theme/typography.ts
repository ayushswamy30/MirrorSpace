import type { TextStyle } from 'react-native';

/**
 * Three families, all SIL OFL, loaded in the root layout (see DESIGN.md):
 *
 *   Instrument Serif — what the app says: headlines, row titles, Do/Don't.
 *   Inter            — body paragraphs and subtitles.
 *   DM Mono          — the interface's own voice: labels, tabs, buttons,
 *                      links, data lines and long reads.
 */
export const fonts = {
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  mono: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium'
} as const;

/**
 * Dynamic Type / font scaling is honoured up to 200%, the ceiling the report
 * sets. Above that, the big serif headlines stop fitting on a phone.
 */
export const maxFontScale = 2;

export type TextVariant =
  | 'reading'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodyItalic'
  | 'caption'
  | 'receipt'
  | 'mono'
  | 'label'
  | 'action';

export const textVariants: Record<TextVariant, TextStyle> = {
  // The day's headline ("Be patient."): the largest thing in the app.
  reading: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 44, letterSpacing: -0.4 },
  title: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 34, letterSpacing: -0.2 },
  // Row titles, Do/Don't items, chosen words.
  heading: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 27 },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 23 },
  // Prompts: the question a writing sheet asks.
  bodyItalic: { fontFamily: fonts.serifItalic, fontSize: 20, lineHeight: 26 },
  // Subtitles under a row title ("through tonight").
  caption: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19 },
  // Long reads and data lines.
  receipt: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 21 },
  // The small grey sentence-case mono of "Do" / "Don't".
  mono: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 17 },
  // Section labels, the wordmark, tab names. Capitals are a style only:
  // screen readers still get the words, not spelled-out letters.
  label: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 16, letterSpacing: 1.3, textTransform: 'uppercase' },
  // What a button or link says.
  action: {
    fontFamily: fonts.monoMedium,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 1.3,
    textTransform: 'uppercase'
  }
};
