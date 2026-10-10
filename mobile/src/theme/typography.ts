import type { TextStyle } from 'react-native';

/**
 * Three families, all SIL OFL, loaded in the root layout (see DESIGN.md):
 *
 *   Fraunces — what the app says: headlines, readings, row titles. A soft,
 *              warm serif; the voice of a friend, not an almanac.
 *   DM Sans  — everything else you read and touch: body, labels, tabs,
 *              buttons, links. Sentence case, never shouting.
 *   DM Mono  — numbers only: data lines, receipts, the code you type.
 */
export const fonts = {
  serif: 'Fraunces_400Regular',
  serifItalic: 'Fraunces_400Regular_Italic',
  serifBold: 'Fraunces_600SemiBold',
  sans: 'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  sansBold: 'DMSans_600SemiBold',
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
  reading: { fontFamily: fonts.serif, fontSize: 36, lineHeight: 42, letterSpacing: -0.6 },
  title: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  // Row titles, Do/Don't items, chosen words.
  heading: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  body: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 24 },
  // Prompts: the question a writing sheet asks.
  bodyItalic: { fontFamily: fonts.serifItalic, fontSize: 19, lineHeight: 26 },
  // Subtitles under a row title ("through tonight").
  caption: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20 },
  // Long reads and data lines.
  receipt: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 21 },
  // Small soft notes ("Do" / "Don't", hints).
  mono: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18 },
  // Section labels, the wordmark, tab names: small, medium-weight, sentence case.
  label: { fontFamily: fonts.sansBold, fontSize: 13, lineHeight: 18, letterSpacing: 0.2 },
  // What a button or link says.
  action: { fontFamily: fonts.sansBold, fontSize: 15, lineHeight: 20, letterSpacing: 0.1 }
};
