import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { gutter, hitTarget, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Icon } from './icons';
import { Text } from './Text';

/**
 * Calm tools and crisis help, one tap from every screen. Never locked, never
 * paywalled, never hidden behind onboarding.
 *
 * Not part of the reference design — it is the safety design's addition, set
 * in the same mono so it belongs to the page. "Need help now" is the one
 * boxed thing in the bar: it must never be missed.
 */
export function CareBar() {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Calm tools"
        accessibilityHint="Breathing, grounding and sounds"
        onPress={() => router.push('/calm')}
        style={({ pressed }) => [styles.item, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Icon name="calm" color={colors.ink} size={16} />
        <Text variant="action" style={styles.underline}>
          calm
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Need help now"
        accessibilityHint="Crisis lines you can call or text"
        onPress={() => router.push('/help')}
        style={({ pressed }) => [styles.item, styles.urgent, { borderColor: colors.ink, opacity: pressed ? 0.6 : 1 }]}
      >
        <Icon name="help" color={colors.ink} size={16} />
        <Text variant="action">need help now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: gutter,
    paddingVertical: space.xs
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    minHeight: hitTarget
  },
  urgent: { borderWidth: 1, paddingHorizontal: space.md },
  underline: { textDecorationLine: 'underline' }
});
