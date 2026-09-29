import { Redirect, router } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import { ActivityIndicator, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TabBar } from '@/components/TabBar';
import { Text } from '@/components/Text';
import { needsOnboarding, useSession } from '@/lib/session';
import { useTheme } from '@/theme/ThemeProvider';

export default function TabsLayout() {
  const session = useSession();
  const { colors } = useTheme();

  if (session.status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator color={colors.inkSoft} accessibilityLabel="Opening your space" />
      </View>
    );
  }

  if (session.status === 'error') {
    return (
      <Screen scroll={false} contentStyle={{ justifyContent: 'center' }}>
        <Text variant="title">{session.message}</Text>
        <Text tone="soft">Nothing you write is lost; it simply can’t open yet.</Text>
        <Button label="try again" onPress={session.retry} />
        <Button kind="quiet" label="need help now" onPress={() => router.push('/help')} />
      </Screen>
    );
  }

  if (needsOnboarding(session.profile)) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs tabBar={props => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'today' }} />
      <Tabs.Screen name="check-in" options={{ title: 'check-in' }} />
      <Tabs.Screen name="mirror" options={{ title: 'mirror' }} />
      <Tabs.Screen name="chart" options={{ title: 'chart' }} />
      <Tabs.Screen name="circle" options={{ title: 'circle' }} />
    </Tabs>
  );
}
