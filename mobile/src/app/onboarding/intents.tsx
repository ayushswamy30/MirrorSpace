import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { OnboardingStep } from '@/components/OnboardingStep';
import { Text } from '@/components/Text';
import { onboardingPurposes } from '@/lib/consent';
import { INTENTS, useOnboarding } from '@/lib/onboarding';
import { hitTarget, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export default function Intents() {
  const { draft, toggleIntent } = useOnboarding();
  const { colors } = useTheme();

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
      <View style={[styles.list, { borderTopColor: colors.hairline }]}>
        {INTENTS.map(intent => {
          const selected = draft.intents.includes(intent.key);
          return (
            <Pressable
              key={intent.key}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={intent.label}
              onPress={() => toggleIntent(intent.key)}
              style={[styles.option, { borderBottomColor: colors.hairline }]}
            >
              <View
                style={[
                  styles.box,
                  { borderColor: colors.ink, backgroundColor: selected ? colors.ink : 'transparent' }
                ]}
              />
              <Text style={styles.label}>{intent.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  // A ruled list, like a printed form: a rule above, one under each line.
  list: { borderTopWidth: StyleSheet.hairlineWidth },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: hitTarget + 8,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  // Filled when chosen: the same inversion as a selected word.
  box: { width: 16, height: 16, borderWidth: 1 },
  label: { flex: 1 }
});
