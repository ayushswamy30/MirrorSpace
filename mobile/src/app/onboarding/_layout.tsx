import { Redirect, Stack, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';

import { ageGate, OnboardingProvider } from '@/lib/onboarding';
import { useTheme } from '@/theme/ThemeProvider';

export default function OnboardingLayout() {
  const { colors } = useTheme();
  const pathname = usePathname();
  const [under18, setUnder18] = useState<boolean | null>(null);

  useEffect(() => {
    ageGate.isUnder18().then(setUnder18, () => setUnder18(false));
  }, []);

  if (under18 === null) return null;
  if (under18 && pathname !== '/onboarding/under-18') return <Redirect href="/onboarding/under-18" />;

  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.paper },
          animation: 'fade',
          // Nothing to swipe back into once the age question is answered.
          gestureEnabled: false
        }}
      />
    </OnboardingProvider>
  );
}
