import { Locked } from '@/components/Locked';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';

/** Mirror — reflective chat. Opens on day 3; built in the Mirror chat step. */
export default function Mirror() {
  return (
    <Locked feature="mirror" promise="A place to think out loud, with something that has been paying attention.">
      <Screen>
        <Text variant="label" tone="soft">
          mirror
        </Text>
      </Screen>
    </Locked>
  );
}
