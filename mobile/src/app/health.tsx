import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SectionLabel } from '@/components/Blocks';
import { Button } from '@/components/Button';
import { SubHeader } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { consentCopy, withdrawNote } from '@/lib/consent';
import { bodyConnected } from '@/lib/body';
import {
  connectBody,
  connectHealth,
  disconnectBody,
  disconnectHealth,
  healthAvailability,
  healthConnected,
  openHealthSettings,
  type HealthAvailability
} from '@/lib/health';
import { space } from '@/theme/tokens';

/**
 * The health consent, asked in context (consent.ts: "asked the first time
 * the person connects Health Connect"): what is read, what never is, then
 * Android's own permission prompt for sleep only. Turning it off is here too,
 * and just as easy.
 */

const UNAVAILABLE: Partial<Record<HealthAvailability, string>> = {
  'not-android': 'Apple Health comes later. For now, sleep can be logged by hand on Today.',
  'needs-app-build': 'Health Connect needs Lowkei’s own app build — Expo Go can’t reach it. Sleep can still be logged by hand on Today.',
  'needs-update': 'Health Connect needs an update from the Play Store first.',
  unavailable: 'Health Connect isn’t available on this phone. Sleep can still be logged by hand on Today.'
};

export default function Health() {
  const copy = consentCopy.health;
  const [availability, setAvailability] = useState<HealthAvailability | null>(null);
  const [connected, setConnected] = useState(false);
  const [body, setBody] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(() => {
    Promise.all([healthAvailability(), healthConnected(), bodyConnected().catch(() => false)])
      .then(([a, c, b]) => {
        setAvailability(a);
        setConnected(c);
        setBody(c && b);
      })
      .catch(() => setAvailability('unavailable'));
  }, []);

  useEffect(refresh, [refresh]);

  const allow = async () => {
    setBusy(true);
    setNote(null);
    try {
      const result = await connectHealth();
      if (result === 'connected') {
        setConnected(true);
        setNote('Connected. Your nights from Health Connect now fill in on Today.');
      } else if (result === 'declined') {
        setNote(copy.declined);
      } else if (result === 'needs-connection') {
        setNote('That needs a connection to record your consent. Nothing was read.');
      } else {
        refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleBody = async () => {
    setBusy(true);
    setNote(null);
    try {
      if (body) {
        await disconnectBody();
        setBody(false);
        setNote('Steps and heart are off, and what was read is gone. Sleep is still connected.');
      } else {
        const result = await connectBody();
        if (result === 'connected') {
          setBody(true);
          setNote('Connected. Steps and heart stay on this phone, and show up on Today when they say something.');
        } else if (result === 'declined') setNote('Nothing more is read. Sleep is still connected.');
      }
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      await disconnectHealth();
      setConnected(false);
      setBody(false);
      setNote('Turned off. The nights read from Health Connect are gone; the ones you logged stay.');
    } finally {
      setBusy(false);
    }
  };

  const blocked = availability ? UNAVAILABLE[availability] : undefined;

  return (
    <Screen edges={['top', 'bottom']} header={<SubHeader title="sleep from your phone" leading="close" />}>
      <Text variant="title">{copy.title}</Text>

      <View style={styles.block}>
        <SectionLabel title="what is read" />
        {copy.sends.map(line => (
          <Text key={line}>{line}</Text>
        ))}
        <SectionLabel title="never" />
        {copy.neverSends.map(line => (
          <Text key={line}>{line}</Text>
        ))}
        <Text variant="caption" tone="soft">
          Nights stay on this phone. A night you log by hand always wins over one read here.
        </Text>
      </View>

      {note && (
        <Text variant="bodyItalic" accessibilityRole="alert">
          {note}
        </Text>
      )}

      {blocked ? (
        <Text tone="soft">{blocked}</Text>
      ) : connected ? (
        <View style={styles.block}>
          <SectionLabel title="steps and heart" />
          <Text tone="soft">
            {body
              ? 'Reading daily steps, resting heart rate and heart-rate variability. Kept on this phone, never sent.'
              : 'Also read daily steps, resting heart rate and heart-rate variability? They stay on this phone and are never sent anywhere — not even to the Mirror.'}
          </Text>
          <Button kind={body ? 'link' : 'outline'} label={body ? 'stop reading steps and heart' : 'allow steps and heart'} disabled={busy} onPress={toggleBody} />
          <SectionLabel title="all of it" />
          <Button kind="outline" label="turn off" disabled={busy} onPress={turnOff} />
          <Button kind="link" label="health connect settings" onPress={openHealthSettings} />
        </View>
      ) : (
        availability && (
          <View style={styles.actions}>
            <Button label="allow" arrow disabled={busy} onPress={allow} />
            <Button kind="link" label="not now" onPress={() => router.back()} />
          </View>
        )
      )}

      <Text variant="caption" tone="soft">
        {withdrawNote}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.lg }
});
