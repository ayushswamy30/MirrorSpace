import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';

/**
 * Calm tools — breathing (box, 4-7-8, physiological sigh), 5-4-3-2-1
 * grounding and offline sounds. Filled in by the calm tools step; like help,
 * it must never depend on the session or the network.
 */
export default function Calm() {
  return (
    <Screen edges={['top', 'bottom']}>
      <Text variant="title">Breathe out, slowly, for longer than you breathed in.</Text>
      <Button kind="link" label="need help now" onPress={() => router.replace('/help')} />
      <Button kind="link" label="close" onPress={() => router.back()} />
    </Screen>
  );
}
