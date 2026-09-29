import { Text as RNText, type TextProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { maxFontScale, textVariants, type TextVariant } from '@/theme/typography';

type Tone = 'ink' | 'soft' | 'signal';

type Props = TextProps & {
  variant?: TextVariant;
  tone?: Tone;
};

export function Text({ variant = 'body', tone = 'ink', style, ...rest }: Props) {
  const { colors, signal } = useTheme();
  const color = tone === 'signal' ? signal : tone === 'soft' ? colors.inkSoft : colors.ink;

  return (
    <RNText
      maxFontSizeMultiplier={maxFontScale}
      style={[textVariants[variant], { color }, style]}
      {...rest}
    />
  );
}
