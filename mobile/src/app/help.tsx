import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { SubHeader } from '@/components/Header';
import { HelplineList } from '@/components/HelplineList';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { space } from '@/theme/tokens';

/**
 * Need help now. Deliberately plain: no animation, no poetry, no account
 * required — this screen does not touch the session, the network or the
 * database, so it opens in every state the app can be in.
 */
export default function Help() {
  return (
    <Screen edges={['top', 'bottom']} header={<SubHeader title="need help now" leading="close" />}>
      <View style={{ gap: space.md }}>
        <Text variant="title">You don’t have to get through this moment alone.</Text>
        <Text>
          These are free, confidential lines staffed by trained people. Lowkei is not one of them — it can’t
          call anyone for you.
        </Text>
      </View>
      <HelplineList />
      <Button kind="link" label="close" onPress={() => router.back()} />
    </Screen>
  );
}
