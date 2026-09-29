import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAppLock } from '@/lib/appLock';
import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { HelplineList } from './HelplineList';
import { Screen } from './Screen';
import { Text } from './Text';

/**
 * Drawn over everything while the app is locked or out of the foreground.
 * Crisis lines stay reachable without unlocking: needing help should never
 * depend on a face scan working.
 */
export function LockScreen() {
  const { locked, covered, unlock } = useAppLock();
  const { colors } = useTheme();
  const [showHelp, setShowHelp] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!locked && !covered) return null;

  // Out of the foreground and not locked: a plain cover for the app switcher.
  if (!locked) {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.paper }]} />;
  }

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Screen edges={['top', 'bottom']} contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <Text variant="title">MirrorSpace is locked.</Text>
        {failed && <Text tone="soft">That didn’t work. You can try again, or use your passcode.</Text>}
        <Button
          label="unlock"
          onPress={async () => {
            setFailed(!(await unlock()));
          }}
        />
        {showHelp ? (
          <HelplineList />
        ) : (
          <Button kind="link" label="need help now" onPress={() => setShowHelp(true)} />
        )}
      </Screen>
    </View>
  );
}
