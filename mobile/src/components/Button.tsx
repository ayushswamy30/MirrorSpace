import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { hitTarget, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  /** 'quiet' is a text-only action for secondary choices. */
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
        primary && { borderColor: colors.ink, borderWidth: StyleSheet.hairlineWidth * 2 },
        { opacity: disabled ? 0.4 : state.pressed ? 0.6 : 1 },
        typeof style === 'function' ? style(state) : style
      ]}
      {...rest}
    >
      <Text variant={primary ? 'body' : 'caption'} tone={primary ? 'ink' : 'soft'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: hitTarget,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start'
  }
});
