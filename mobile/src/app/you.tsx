import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Band, Row, SectionLabel, SettingRow } from '@/components/Blocks';
import { Button } from '@/components/Button';
import { SubHeader } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { eraseEverything, setConsent, shareExport } from '@/lib/account';
import { authenticate, lockAvailability, useAppLock } from '@/lib/appLock';
import type { ConsentPurpose } from '@/lib/consent';
import { disableReminders, enableReminders, remindersEnabled } from '@/lib/reminders';
import { useSession } from '@/lib/session';
import { dayNumber } from '@/lib/unlocks';
import { space } from '@/theme/tokens';

/**
 * You — the reference's settings page, for MirrorSpace: who this space is,
 * the lock, what may be used, and the person's own data. Every control says
 * plainly what it does; withdrawing a consent is exactly as easy as giving it.
 */

type Erase = 'idle' | 'confirm' | 'erasing';

export default function You() {
  const session = useSession();
  const lock = useAppLock();
  const [note, setNote] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [erase, setErase] = useState<Erase>('idle');
  const [pending, setPending] = useState<Partial<Record<ConsentPurpose, boolean>>>({});
  const [reminder, setReminder] = useState(false);

  useEffect(() => {
    remindersEnabled()
      .then(setReminder)
      .catch(() => undefined);
  }, []);

  if (session.status !== 'ready') {
    return (
      <Screen edges={['top', 'bottom']} header={<SubHeader title="you" />}>
        <Text tone="soft">Your space isn’t open yet.</Text>
      </Screen>
    );
  }

  const { profile, offline } = session;
  const day = dayNumber(new Date(profile.createdAt));

  const toggleLock = async (on: boolean) => {
    setNote(null);
    if (on && (await lockAvailability()) === 'no-passcode') {
      setNote('Set a screen lock on your phone first — the app lock uses it.');
      return;
    }
    // Both ways need the owner: nobody else should turn the lock off.
    if (!(await authenticate())) return;
    await lock.setEnabled(on);
  };

  const toggleReminder = async (on: boolean) => {
    setNote(null);
    try {
      if (on) {
        const allowed = await enableReminders();
        setReminder(allowed);
        if (!allowed) setNote('Notifications are off for MirrorSpace in your phone’s settings.');
      } else {
        await disableReminders();
        setReminder(false);
      }
    } catch (err) {
      console.error('Reminder change failed:', err);
      setNote('That didn’t work. Nothing changed.');
    }
  };

  const toggleConsent = async (purpose: ConsentPurpose, granted: boolean) => {
    setNote(null);
    setPending(p => ({ ...p, [purpose]: granted }));
    try {
      await setConsent(purpose, granted);
      await session.refreshProfile();
    } catch {
      setNote('That needs a connection. Nothing changed.');
    } finally {
      setPending(p => {
        const next = { ...p };
        delete next[purpose];
        return next;
      });
    }
  };

  const consentValue = (purpose: ConsentPurpose) => pending[purpose] ?? profile.consents[purpose]?.granted ?? false;

  const runExport = async () => {
    setNote(null);
    setExporting(true);
    try {
      const data = await shareExport();
      if (data.serverError) {
        setNote('Exported what is on this phone. The server couldn’t be reached, so its part is missing — try again online.');
      }
    } catch (err) {
      console.error('Export failed:', err);
      setNote('The export didn’t work. Nothing was lost.');
    } finally {
      setExporting(false);
    }
  };

  const runErase = async () => {
    setErase('erasing');
    try {
      await eraseEverything();
      session.retry();
      router.replace('/');
    } catch (err) {
      console.error('Erase failed:', err);
      setErase('confirm');
      setNote('Erasing needs a connection, so nothing was deleted. Try again when you’re online.');
    }
  };

  return (
    <Screen edges={['top', 'bottom']} header={<SubHeader title="you" />}>
      <View>
        <Text variant="title">Your space</Text>
        <Text variant="mono" tone="soft">
          {`day ${day} · ${profile.isAnonymous ? 'no account — this phone only' : profile.email ?? 'account'}${offline ? ' · offline' : ''}`}
        </Text>
      </View>

      {note && (
        <Text variant="bodyItalic" accessibilityRole="alert">
          {note}
        </Text>
      )}

      <View>
        <SectionLabel title="reminder" />
        <SettingRow
          title="Daily reminder"
          subtitle="Once a day at most, around when you usually check in — never after you have"
          value={reminder}
          onValueChange={toggleReminder}
        />
      </View>

      <View>
        <SectionLabel title="privacy" />
        <SettingRow
          title="App lock"
          subtitle="Face, fingerprint or passcode to open"
          value={lock.enabled}
          onValueChange={toggleLock}
        />
        <SettingRow
          title="Readings from your numbers"
          subtitle="Counts and averages only — never your words"
          value={consentValue('readings')}
          onValueChange={v => toggleConsent('readings', v)}
          disabled={offline}
        />
        <SettingRow
          title="AI reflections"
          subtitle="Send a vent page or a Mirror message to an AI, to reflect it back"
          value={consentValue('ai_reflections')}
          onValueChange={v => toggleConsent('ai_reflections', v)}
          disabled={offline}
        />
      </View>

      <View>
        <SectionLabel title="your data" />
        <Row
          title={exporting ? 'Gathering…' : 'Download everything'}
          subtitle="Check-ins, pages, your plan and your account, as one file"
          onPress={exporting ? undefined : runExport}
        />
      </View>

      <Band />

      <View style={styles.block}>
        <SectionLabel title="erase" rule={false} />
        {erase === 'idle' ? (
          <Button kind="link" label="erase everything" onPress={() => setErase('confirm')} />
        ) : (
          <View style={styles.block}>
            <Text>
              This deletes your account and everything on this phone — check-ins, pages, your plan. It can’t be undone,
              and nothing is kept.
            </Text>
            <View style={styles.actions}>
              <Button
                kind="outline"
                label={erase === 'erasing' ? 'erasing…' : 'erase'}
                disabled={erase === 'erasing'}
                onPress={runErase}
              />
              {erase === 'confirm' && (
                <Button kind="link" label="keep everything" onPress={() => setErase('idle')} />
              )}
            </View>
          </View>
        )}
      </View>

      <View style={styles.block}>
        <SectionLabel title="about" />
        <Text tone="soft">
          The Mirror is software, not a person, and not a therapist. MirrorSpace can’t call anyone for you — crisis lines
          are under calm, then help.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.lg }
});
