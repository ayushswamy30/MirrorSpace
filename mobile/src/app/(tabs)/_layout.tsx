import { Redirect, router } from 'expo-router';
import { View } from 'react-native';
import { Tabs } from 'expo-router/tabs';

import { Button } from '@/components/Button';
import { Loader } from '@/components/Loader';
import { Screen } from '@/components/Screen';
import { TabBar, TabInsetProvider } from '@/components/TabBar';
import { CircleSync } from '@/components/CircleSync';
import { HealthSync } from '@/components/HealthSync';
import { PushSync } from '@/components/PushSync';
import { ReflectionSync } from '@/components/ReflectionSync';
import { ReminderSync } from '@/components/ReminderSync';
import { WeatherSync } from '@/components/WeatherSync';
import { Text } from '@/components/Text';
import { needsAccount, needsOnboarding, useSession } from '@/lib/session';

export default function TabsLayout() {
  const session = useSession();

  if (session.status === 'loading') {
    return (
      <View style={{ flex: 1 }}>
        <Loader fill size={72} label={session.waking ? 'Waking up' : 'Opening your space'} />
        {session.waking && (
          <Text variant="mono" tone="soft" style={{ position: 'absolute', bottom: 120, left: 0, right: 0, textAlign: 'center' }}>
            Waking up — the first open can take a moment.
          </Text>
        )}
      </View>
    );
  }

  if (session.status === 'error') {
    return (
      <Screen scroll={false} contentStyle={{ justifyContent: 'center' }}>
        <Text variant="title">{session.message}</Text>
        <Text tone="soft">Nothing you write is lost; it simply can’t open yet.</Text>
        <Button label="try again" onPress={session.retry} />
        <Button kind="link" label="need help now" onPress={() => router.push('/help')} />
      </Screen>
    );
  }

  if (session.status === 'signed-out') {
    return <Redirect href="/onboarding" />;
  }

  if (needsAccount(session.profile)) {
    return <Redirect href="/account?mode=keep" />;
  }

  if (needsOnboarding(session.profile)) {
    return <Redirect href="/onboarding/age" />;
  }

  return (
    <TabInsetProvider>
      <WeatherSync />
      <ReminderSync />
      <HealthSync />
      <CircleSync />
      <PushSync />
      <ReflectionSync />
      {/* Tabs cross-fade: one page gives way to the next, like turning a leaf. */}
      <Tabs tabBar={props => <TabBar {...props} />} screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Tabs.Screen name="index" options={{ title: 'today' }} />
        <Tabs.Screen name="check-in" options={{ title: 'check-in' }} />
        <Tabs.Screen name="circle" options={{ title: 'circle' }} />
        <Tabs.Screen name="mirror" options={{ title: 'mirror' }} />
        <Tabs.Screen name="chart" options={{ title: 'chart' }} />
        <Tabs.Screen name="you" options={{ title: 'you' }} />
      </Tabs>
    </TabInsetProvider>
  );
}
