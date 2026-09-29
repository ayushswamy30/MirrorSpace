import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { OnboardingStep } from '@/components/OnboardingStep';
import { Text } from '@/components/Text';
import { consentCopy, onboardingPurposes, withdrawNote, type ConsentPurpose } from '@/lib/consent';
import { useOnboarding } from '@/lib/onboarding';
import { space } from '@/theme/tokens';

/**
 * One consent per screen, never pre-ticked, never bundled with another.
 * "Not now" is as prominent as "allow" in weight and reach, and choosing it
 * changes nothing else about onboarding.
 */
export default function Consent() {
  const { purpose } = useLocalSearchParams<{ purpose: string }>();
  const { setConsent } = useOnboarding();

  const index = onboardingPurposes.indexOf(purpose as ConsentPurpose);
  if (index === -1) return <Redirect href="/onboarding" />;

  const key = onboardingPurposes[index];
  const copy = consentCopy[key];
  const next = onboardingPurposes[index + 1];

  const answer = (granted: boolean) => {
    setConsent(key, granted);
    router.push(next ? `/onboarding/consent/${next}` : '/onboarding/lock');
  };

  return (
    <OnboardingStep
      actions={
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Button label="allow" onPress={() => answer(true)} />
          <Button label="not now" onPress={() => answer(false)} />
        </View>
      }
    >
      <Text variant="title">{copy.title}</Text>

      <View style={{ gap: space.xs }}>
        <Text variant="label" tone="soft">
          what is sent
        </Text>
        {copy.sends.map(line => (
          <Text key={line}>{line}</Text>
        ))}
      </View>

      <View style={{ gap: space.xs }}>
        <Text variant="label" tone="soft">
          never sent
        </Text>
        {copy.neverSends.map(line => (
          <Text key={line}>{line}</Text>
        ))}
      </View>

      <View style={{ gap: space.xs }}>
        <Text variant="label" tone="soft">
          if you say no
        </Text>
        <Text>{copy.declined}</Text>
      </View>

      <Text variant="caption" tone="soft">
        {withdrawNote}
      </Text>
    </OnboardingStep>
  );
}
