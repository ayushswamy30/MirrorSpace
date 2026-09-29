import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { hitTarget, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Icon } from './icons';
import { Text } from './Text';

/**
 * Calm tools and crisis help, one tap from every screen. Never locked, never
 * paywalled, never hidden behind onboarding.
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
        style={[styles.pill, { backgroundColor: colors.paperRaised, borderColor: colors.hairline }]}
      >
        <Icon name="calm" color={colors.ink} size={18} />
        <Text variant="caption">calm</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Need help now"
        accessibilityHint="Crisis lines you can call or text"
        onPress={() => router.push('/help')}
        style={[styles.pill, { backgroundColor: colors.paperRaised, borderColor: colors.ink }]}
      >
        <Icon name="help" color={colors.ink} size={18} />
        <Text variant="caption">need help now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space.sm,
    justifyContent: 'center',
    paddingVertical: space.sm
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    minHeight: hitTarget,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2
  }
});
