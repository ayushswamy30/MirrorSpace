import type { ReactNode } from 'react';

import { config } from '@/lib/config';
import { useProfile } from '@/lib/session';
import { daysUntil, isUnlocked, type Feature } from '@/lib/unlocks';

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
  const profile = useProfile();
  const createdAt = new Date(profile.createdAt);

  if (isUnlocked(feature, createdAt, new Date(), config.unlockAll)) return <>{children}</>;

  const days = daysUntil(feature, createdAt);

  return (
    <Screen>
      <Text variant="title">{promise}</Text>
      <Text tone="soft">
        {days === 1 ? 'This opens tomorrow.' : `This opens in ${days} days.`} It needs a little of your rhythm first.
      </Text>
    </Screen>
  );
}
