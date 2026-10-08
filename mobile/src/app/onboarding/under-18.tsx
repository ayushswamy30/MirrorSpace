import { DevSettings } from 'react-native';

import { Button } from '@/components/Button';
import { HelplineList } from '@/components/HelplineList';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { ageGate } from '@/lib/onboarding';

/**
 * The end of the road for now. No way forward, no way to re-answer: a teen
 * version needs its own legal review and parental-consent design (report §8).
 * The kindest thing this screen can do is point somewhere real.
 *
 * The one exception is a development build, where a tester who tapped the
 * wrong answer can undo it. `__DEV__` is false in every release build, so
 * that link is not in the app people install.
 */
export default function Under18() {
  return (
    <Screen edges={['top', 'bottom']}>
      <Text variant="title">Lowkei isn’t open to people under 18 yet.</Text>
      <Text>
        That’s about keeping you safe, not about you. If things feel heavy right now, these people are there to
        listen, for free:
      </Text>
      <HelplineList />
      {__DEV__ && (
        <Button
          kind="link"
          label="undo — development builds only"
          onPress={async () => {
            await ageGate.resetForTesting();
            DevSettings.reload();
          }}
        />
      )}
    </Screen>
  );
}
