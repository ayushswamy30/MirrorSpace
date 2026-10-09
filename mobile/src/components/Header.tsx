import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { dark, gutter, hitTarget, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Icon } from './icons';
import { Text } from './Text';

export function shortDate(now: Date = new Date()): string {
  return now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Calm tools, one tap from every screen (report §7): a small link at the top
 * right, where the reference keeps its date control. Crisis lines are one
 * tap further, in calm's own header.
 */
export function CalmLink({ ink }: { ink?: string }) {
  const { colors } = useTheme();
  const color = ink ?? colors.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Calm tools"
      accessibilityHint="Breathing, grounding, sounds, and crisis lines"
      onPress={() => router.push('/calm')}
      hitSlop={8}
      style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon name="calm" color={color} size={16} />
      <Text variant="label" style={{ color }}>
        calm
      </Text>
    </Pressable>
  );
}

/**
 * The bar on every tab, after the reference: the wordmark with the weather
 * dot beside it — the one place colour appears on the page, and small on
 * purpose — and calm alone on the right, where the reference keeps its date.
 * No rule: the page's air does the dividing. `onVoid` sets it light on the
 * dark Mirror room, whatever the theme.
 */
export function AppHeader({ onVoid = false, extra }: { onVoid?: boolean; /** Beside calm, e.g. Today's date control. */ extra?: ReactNode }) {
  const { colors, signal, weather } = useTheme();
  const ink = onVoid ? dark.ink : colors.ink;
  const dot = onVoid ? dark.signal[weather ?? 'fog'] : signal;

  return (
    <View style={[styles.bar, onVoid && { backgroundColor: colors.void }]}>
      <View style={styles.brand}>
        <Text variant="label" accessibilityRole="header" accessibilityLabel="Lowkei" style={{ color: ink }}>
          lowkei
        </Text>
        <View
          style={[styles.dot, { backgroundColor: dot }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </View>
      <View style={styles.right}>
        {extra}
        <CalmLink ink={ink} />
      </View>
    </View>
  );
}

type SubHeaderProps = {
  title: string;
  /** 'back' pops the stack; 'close' is for full-screen sheets. */
  leading?: 'back' | 'close';
  onLeading?: () => void;
  /** An action on the right, such as calm's link to crisis lines. */
  trailing?: ReactNode;
};

/** A pushed screen: a back or close control, the title centred in mono, no rule. */
export function SubHeader({ title, leading = 'back', onLeading, trailing }: SubHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={leading === 'close' ? 'close' : 'back'}
        onPress={onLeading ?? (() => router.back())}
        hitSlop={8}
        style={styles.side}
      >
        <Icon name={leading} color={colors.ink} size={22} />
      </Pressable>
      <Text variant="label" accessibilityRole="header" style={styles.centred}>
        {title}
      </Text>
      {/* Also balances the leading control so the title stays centred. */}
      <View style={[styles.side, styles.trailing]}>{trailing}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 52,
    paddingHorizontal: gutter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  dot: { width: 6, height: 6, borderRadius: radius.dot },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, minHeight: hitTarget },
  side: { minWidth: hitTarget, height: hitTarget, justifyContent: 'center' },
  trailing: { alignItems: 'flex-end' },
  centred: { flex: 1, textAlign: 'center' }
});
