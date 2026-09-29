import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { useEntering } from '@/theme/motion';
import { space } from '@/theme/tokens';

import { CareBar } from './CareBar';
import { Screen } from './Screen';

type Props = {
  children: ReactNode;
  /** The choices, pinned under the text. */
  actions: ReactNode;
};

/**
 * One question per screen. Calm tools and crisis lines are reachable here too:
 * onboarding is not a reason for help to be out of reach.
 */
export function OnboardingStep({ children, actions }: Props) {
  const entering = useEntering();
  const later = useEntering(250);

  return (
    <Screen edges={['top', 'bottom']} contentStyle={styles.content}>
      <Animated.View entering={entering} style={styles.body}>
        {children}
      </Animated.View>
      <Animated.View entering={later} style={styles.actions}>
        {actions}
      </Animated.View>
      <CareBar />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  body: { flex: 1, gap: space.lg, justifyContent: 'center', paddingTop: space.xl },
  actions: { gap: space.sm }
});
