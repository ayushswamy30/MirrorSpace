import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { gutter, hitTarget, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Icon } from './icons';
import { Text } from './Text';

export function shortDate(now: Date = new Date()): string {
  return now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * The bar on every tab: the wordmark on the left, the screen's context on the
 * right, a rule underneath. The weather dot sits beside the context — the one
 * place colour appears on the page, and small on purpose.
 */
export function AppHeader({ context }: { context?: string }) {
  const { colors, signal } = useTheme();

  return (
    <View style={[styles.bar, { borderBottomColor: colors.hairline }]}>
      <Text variant="label" accessibilityRole="header" accessibilityLabel="MirrorSpace">
        mirror – space
      </Text>
      {context && (
        <View style={styles.context}>
          <View
            style={[styles.dot, { backgroundColor: signal }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <Text variant="label">{context}</Text>
        </View>
      )}
    </View>
  );
}

type SubHeaderProps = {
  title: string;
  /** 'back' pops the stack; 'close' is for full-screen sheets. */
  leading?: 'back' | 'close';
  onLeading?: () => void;
};

/** A pushed screen: a back or close control, the title centred in mono. */
export function SubHeader({ title, leading = 'back', onLeading }: SubHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.bar, { borderBottomColor: colors.hairline }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={leading === 'close' ? 'close' : 'back'}
        onPress={onLeading ?? (() => router.back())}
        hitSlop={8}
        style={styles.leading}
      >
        <Icon name={leading} color={colors.ink} size={22} />
      </Pressable>
      <Text variant="label" accessibilityRole="header" style={styles.centred}>
        {title}
      </Text>
      {/* Balances the leading control so the title stays centred. */}
      <View style={styles.leading} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 52,
    paddingHorizontal: gutter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  context: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 6, height: 6, borderRadius: radius.dot },
  leading: { width: hitTarget, height: hitTarget, justifyContent: 'center' },
  centred: { flex: 1, textAlign: 'center' }
});
