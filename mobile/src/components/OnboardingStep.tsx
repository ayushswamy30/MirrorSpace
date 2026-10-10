import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useEntering } from '@/theme/motion';
import { gutter, hitTarget, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

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
  const { colors } = useTheme();
  // Calm sits on a frosted pill, so it reads over the picture.
  const header = (
    <View style={styles.top}>
      <View style={[styles.pill, { backgroundColor: colors.glass, borderColor: colors.glassEdge }]}>
        <CalmLink />
      </View>
    </View>
  );

  return (
    <Screen edges={['top', 'bottom']} scene="auraEye" contentStyle={styles.content} header={header}>
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
  top: { alignItems: 'flex-end', paddingHorizontal: gutter, paddingTop: space.xs },
  pill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, minHeight: hitTarget - 6, justifyContent: 'center' },
  content: { flexGrow: 1 },
  body: { flex: 1, gap: space.lg, justifyContent: 'center', paddingTop: space.xl },
  actions: { gap: space.sm }
});
