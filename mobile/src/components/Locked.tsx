import type { ReactNode } from 'react';

import { config } from '@/lib/config';
import { useSession } from '@/lib/session';
import { daysUntil, isUnlocked, type Feature } from '@/lib/unlocks';

import { StyleSheet } from 'react-native';

import { space } from '@/theme/tokens';

import { Art } from './Art';
import { Lede } from './Blocks';
import { AppHeader } from './Header';
import { Loader } from './Loader';
import { Screen } from './Screen';
import { Text } from './Text';

type Props = {
  feature: Feature;
  /** What the space will hold, in one line. */
  promise: string;
  children: ReactNode;
};

/**
 * Renders children once a progressive unlock has opened; until then, a single
 * quiet line about when. Not a paywall and not a streak — the day count is
 * calendar days since the account began, whether or not the app was opened.
 */
export function Locked({ feature, promise, children }: Props) {
  const session = useSession();

  // Pages opened straight from a link or a notification can arrive before
  // the account has loaded; they wait for it rather than guess.
  if (session.status !== 'ready') {
    return (
      <Screen header={<AppHeader />} scroll={false}>
        {session.status === 'error' ? <Text tone="soft">{session.message}</Text> : <Loader fill />}
      </Screen>
    );
  }

  const createdAt = new Date(session.profile.createdAt);

  if (isUnlocked(feature, createdAt, new Date(), config.unlockAll)) return <>{children}</>;

  const days = daysUntil(feature, createdAt);

  return (
    <Screen header={<AppHeader />}>
      <Art name="king" size={150} style={styles.art} />
      <Lede label={days === 1 ? 'opens tomorrow' : `opens in ${days} days`} title={promise} size="title">
        <Text tone="soft">
          {days === 1 ? 'This opens tomorrow.' : `This opens in ${days} days.`} It needs a little of your rhythm first.
        </Text>
      </Lede>
    </Screen>
  );
}

const styles = StyleSheet.create({
  art: { alignSelf: 'flex-end', marginTop: space.lg }
});
