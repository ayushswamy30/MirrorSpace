import { Text as RNText, type TextProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { maxFontScale, textVariants, type TextVariant } from '@/theme/typography';

// No signal tone: the weather colour is for small marks, never for words.
type Tone = 'ink' | 'soft';

type Props = TextProps & {
  variant?: TextVariant;
  tone?: Tone;
};

export function Text({ variant = 'body', tone = 'ink', style, ...rest }: Props) {
  const { colors } = useTheme();
  const color = tone === 'soft' ? colors.inkSoft : colors.ink;

  return (
    <RNText
      maxFontSizeMultiplier={maxFontScale}
      style={[textVariants[variant], { color }, style]}
      {...rest}
    />
  );
}
