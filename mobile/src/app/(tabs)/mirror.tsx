import { Locked } from '@/components/Locked';
import { AppHeader } from '@/components/Header';
import { Screen } from '@/components/Screen';

/** Mirror — reflective chat. Opens on day 3; built in the Mirror chat step. */
export default function Mirror() {
  return (
    <Locked title="mirror" feature="mirror" promise="A place to think out loud, with something that has been paying attention.">
      <Screen header={<AppHeader context="mirror" />}>{null}</Screen>
    </Locked>
  );
}
