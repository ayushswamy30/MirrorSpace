import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { OnboardingStep } from '@/components/OnboardingStep';
import { Text } from '@/components/Text';
import { onboardingPurposes } from '@/lib/consent';
import { INTENTS, useOnboarding } from '@/lib/onboarding';
import { hitTarget, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export default function Intents() {
  const { draft, toggleIntent } = useOnboarding();
  const { colors, signal } = useTheme();

  return (
    <OnboardingStep
      actions={
        <Button
          label={draft.intents.length ? 'continue' : 'skip'}
          onPress={() => router.push(`/onboarding/consent/${onboardingPurposes[0]}`)}
        />
      }
    >
      <Text variant="title">What brings you here?</Text>
      <Text tone="soft">Choose any, or none. You can change this later.</Text>
      <View style={styles.list}>
        {INTENTS.map(intent => {
          const selected = draft.intents.includes(intent.key);
          return (
            <Pressable
              key={intent.key}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={intent.label}
              onPress={() => toggleIntent(intent.key)}
              style={[
                styles.option,
                { borderColor: selected ? signal : colors.hairline, backgroundColor: colors.paperRaised }
              ]}
            >
              <View style={[styles.dot, { borderColor: selected ? signal : colors.inkSoft }]}>
                {selected && <View style={[styles.dotFill, { backgroundColor: signal }]} />}
              </View>
              <Text style={styles.label}>{intent.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: hitTarget + 8,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2
  },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dotFill: { width: 8, height: 8, borderRadius: 4 },
  label: { flex: 1 }
});
