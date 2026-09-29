import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { hitTarget, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  /**
   * 'primary' is a solid ink bar across the column — one per screen, the thing
   * to do next. 'quiet' is an underlined text action for everything else.
   */
  kind?: 'primary' | 'quiet';
};

export function Button({ label, kind = 'primary', disabled, style, ...rest }: Props) {
  const { colors } = useTheme();
  const primary = kind === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={state => [
        styles.base,
        primary ? [styles.primary, { backgroundColor: colors.ink }] : styles.quiet,
        { opacity: disabled ? 0.4 : state.pressed ? 0.6 : 1 },
        typeof style === 'function' ? style(state) : style
      ]}
      {...rest}
    >
      <Text
        variant="action"
        tone={primary ? 'ink' : 'soft'}
        style={primary ? { color: colors.paper } : styles.underline}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: hitTarget,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primary: {
    alignSelf: 'stretch',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.none
  },
  quiet: {
    alignSelf: 'center',
    paddingHorizontal: space.sm
  },
  underline: { textDecorationLine: 'underline' }
});
