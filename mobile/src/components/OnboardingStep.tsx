import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useEntering } from '@/theme/motion';
import { gutter, space } from '@/theme/tokens';

import { CalmLink } from './Header';
import { Screen } from './Screen';

type Props = {
  children: ReactNode;
  /** The choices, pinned under the text. */
  actions: ReactNode;
};

/**
 * One question per screen. Calm (and, through it, crisis lines) is reachable
 * here too: onboarding is not a reason for help to be out of reach.
 */
export function OnboardingStep({ children, actions }: Props) {
  const entering = useEntering();
  const later = useEntering(250);

  return (
    <Screen edges={['top', 'bottom']} contentStyle={styles.content} header={<View style={styles.top}><CalmLink /></View>}>
      <Animated.View entering={entering} style={styles.body}>
        {children}
      </Animated.View>
      <Animated.View entering={later} style={styles.actions}>
        {actions}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'flex-end', paddingHorizontal: gutter },
  content: { flexGrow: 1 },
  body: { flex: 1, gap: space.lg, justifyContent: 'center', paddingTop: space.xl },
  actions: { gap: space.sm }
});
