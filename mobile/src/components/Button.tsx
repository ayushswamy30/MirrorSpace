import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { hitTarget, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Icon } from './icons';
import { Text } from './Text';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  /**
   * primary — a solid ink pill with a soft glow, the one thing to do next.
   * outline — a glass pill, for a secondary action that still needs weight.
   * link    — underlined mono text, for everything else.
   */
  kind?: 'primary' | 'outline' | 'link';
  /** Ends the label with → (the reference's "DIVE DEEPER →"). */
  arrow?: boolean;
};

export function Button({ label, kind = 'primary', arrow = false, disabled, style, ...rest }: Props) {
  const { colors, signal } = useTheme();
  const variant = kind;
  const color = variant === 'primary' ? colors.paper : colors.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={state => [
        styles.base,
        variant === 'primary' && [styles.box, styles.glow, { backgroundColor: colors.ink, shadowColor: signal }],
        variant === 'outline' && [styles.box, styles.outline, { borderColor: colors.ink, backgroundColor: colors.glass }],
        variant === 'link' && styles.link,
        { opacity: disabled ? 0.4 : state.pressed ? 0.6 : 1 },
        typeof style === 'function' ? style(state) : style
      ]}
      {...rest}
    >
      <View style={styles.row}>
        <Text variant="action" style={[{ color }, variant === 'link' && styles.underline]}>
          {label}
        </Text>
        {arrow && <Icon name="arrow" color={color} size={14} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: hitTarget,
    justifyContent: 'center',
    alignSelf: 'flex-start'
  },
  box: {
    paddingHorizontal: space.lg + 4,
    paddingVertical: space.md,
    borderRadius: radius.pill
  },
  glow: { shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  outline: { borderWidth: 1 },
  link: { paddingVertical: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  underline: { textDecorationLine: 'underline' }
});
