import { Redirect, router } from 'expo-router';
import { Tabs } from 'expo-router/tabs';

import { Button } from '@/components/Button';
import { Loader } from '@/components/Loader';
import { Screen } from '@/components/Screen';
import { TabBar } from '@/components/TabBar';
import { CircleSync } from '@/components/CircleSync';
import { HealthSync } from '@/components/HealthSync';
import { PushSync } from '@/components/PushSync';
import { ReminderSync } from '@/components/ReminderSync';
import { WeatherSync } from '@/components/WeatherSync';
import { Text } from '@/components/Text';
import { needsOnboarding, useSession } from '@/lib/session';

export default function TabsLayout() {
  const session = useSession();

  if (session.status === 'loading') {
    return <Loader fill size={72} label="Opening your space" />;
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

  if (needsOnboarding(session.profile)) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <>
      <WeatherSync />
      <ReminderSync />
      <HealthSync />
      <CircleSync />
      <PushSync />
      {/* Tabs cross-fade: one page gives way to the next, like turning a leaf. */}
      <Tabs tabBar={props => <TabBar {...props} />} screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Tabs.Screen name="index" options={{ title: 'today' }} />
        <Tabs.Screen name="check-in" options={{ title: 'check-in' }} />
        <Tabs.Screen name="circle" options={{ title: 'circle' }} />
        <Tabs.Screen name="mirror" options={{ title: 'mirror' }} />
        <Tabs.Screen name="chart" options={{ title: 'chart' }} />
        <Tabs.Screen name="you" options={{ title: 'you' }} />
      </Tabs>
    </>
  );
}
