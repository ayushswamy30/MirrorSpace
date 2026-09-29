import { getLocales } from 'expo-localization';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { HelplineList } from '@/components/HelplineList';
import { Masthead } from '@/components/Masthead';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { helplinesFor } from '@/lib/helplines';
import { space } from '@/theme/tokens';

/**
 * The response to an elevated or acute screening (report §8).
 *
 * elevated — an interruption: a breath, one grounding step, the lines.
 * acute    — a crisis card: the local line first, one tap to call or text.
 *
 * Like help, this touches no session, network or database, and is plain on
 * purpose: no animation, nothing to scroll past before the numbers. It never
 * closes itself, and closing it is always allowed — it is an offer, not a
 * lock.
 */
export default function Crisis() {
  const { tier } = useLocalSearchParams<{ tier?: string }>();
  // Anything unexpected is treated as elevated: showing the lines to someone
  // who didn't need them is the safer mistake.
  const acute = tier === 'acute';

  return acute ? <Acute /> : <Elevated />;
}

function Acute() {
  const region = getLocales()[0]?.regionCode ?? null;
  const line = helplinesFor(region)[0];

  return (
    <Screen edges={['top', 'bottom']}>
      <Masthead title="right now" dateline={null} />
      <Text variant="reading">Please talk to someone right now.</Text>
      <Text>
        You don’t have to act on what you’re feeling. The people on these lines are trained for exactly this moment,
        and it’s free and confidential.
      </Text>

      {line && (
        <View style={styles.primary}>
          {line.call && (
            <Button
              label={`call ${line.name}`}
              accessibilityLabel={`Call ${line.name} on ${line.display}`}
              onPress={() => Linking.openURL(`tel:${line.call}`)}
            />
          )}
          {line.text && (
            <Button
              kind="quiet"
              label={`text ${line.display}`}
              accessibilityLabel={`Text ${line.name} on ${line.display}`}
              onPress={() => Linking.openURL(`sms:${line.text}`)}
            />
          )}
        </View>
      )}

      <HelplineList />
      <Button kind="quiet" label="back to mirrorspace" onPress={() => router.back()} />
    </Screen>
  );
}

function Elevated() {
  return (
    <Screen edges={['top', 'bottom']}>
      <Masthead title="a moment" dateline={null} />
      <Text variant="reading">That sounds like a lot to carry.</Text>
      <Text>What you wrote is saved, and it stays on this phone. Before anything else:</Text>
      <Text variant="bodyItalic">
        Breathe out slowly, longer than you breathed in. Then name three things you can see from where you are.
      </Text>

      <Button label="breathe for a minute" onPress={() => router.replace('/calm')} />

      <Text tone="soft">If it’s more than a moment, these lines are free, confidential and open now:</Text>
      <HelplineList />
      <Button kind="quiet" label="i’m okay for now" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  primary: { gap: space.sm }
});
