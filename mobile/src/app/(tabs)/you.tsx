import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Art } from '@/components/Art';
import { Band, Lede, Segmented, SettingGroup, SettingLink, SettingRow } from '@/components/Blocks';
import { Button } from '@/components/Button';
import { AppHeader } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { eraseEverything, setConsent, shareExport } from '@/lib/account';
import { authenticate, lockAvailability, useAppLock } from '@/lib/appLock';
import type { ConsentPurpose } from '@/lib/consent';
import { databaseEncryption } from '@/lib/db/database';
import { healthConnected, healthPlatform } from '@/lib/health';
import type { Appearance } from '@/lib/appearance';
import {
  disableReminders,
  enableReminders,
  remindersEnabled,
  remindersSupported,
  sendTestReminder
} from '@/lib/reminders';
import { useSession } from '@/lib/session';
import { dayNumber } from '@/lib/unlocks';
import { space } from '@/theme/tokens';
import { useAppearance } from '@/theme/ThemeProvider';

/**
 * You — the last tab, the reference's settings page, for MirrorSpace: how the
 * app looks, the reminder, the lock, what may be used, and the person's own
 * data. Every control says plainly what it does; withdrawing a consent is
 * exactly as easy as giving it.
 */

const APPEARANCES = [
  { key: 'system', label: 'system' },
  { key: 'light', label: 'light' },
  { key: 'dark', label: 'dark' }
] as const satisfies readonly { key: Appearance; label: string }[];

type Erase = 'idle' | 'confirm' | 'erasing';

export default function You() {
  const session = useSession();
  const lock = useAppLock();
  const { appearance, setAppearance } = useAppearance();
  const [note, setNote] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [erase, setErase] = useState<Erase>('idle');
  const [pending, setPending] = useState<Partial<Record<ConsentPurpose, boolean>>>({});
  const [reminder, setReminder] = useState(false);
  const [health, setHealth] = useState(false);

  useEffect(() => {
    remindersEnabled()
      .then(setReminder)
      .catch(() => undefined);
    healthConnected()
      .then(setHealth)
      .catch(() => undefined);
  }, []);

  if (session.status !== 'ready') {
    return (
      <Screen header={<AppHeader />}>
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

  const testReminder = async () => {
    setNote(null);
    try {
      if (await sendTestReminder()) setNote('A test reminder is on its way — give it five seconds.');
    } catch (err) {
      console.error('Test reminder failed:', err);
      setNote('The test reminder didn’t go out.');
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

  const encryption = databaseEncryption();

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
    <Screen header={<AppHeader />}>
      <Lede label={`day ${day}`} title="Your space." size="title">
        <Text variant="mono" tone="soft">
          {`${profile.isAnonymous ? 'no account — this phone only' : profile.email ?? 'account'}${offline ? ' · offline' : ''}`}
        </Text>
      </Lede>

      {note && (
        <Text variant="bodyItalic" accessibilityRole="alert">
          {note}
        </Text>
      )}

      <SettingGroup title="Appearance">
        <Segmented options={APPEARANCES} value={appearance} onChange={setAppearance} bleed={false} />
      </SettingGroup>

      <SettingGroup title="Notifications">
        <SettingRow
          title="Daily reminder"
          subtitle={
            remindersSupported
              ? 'Once a day at most, around when you usually check in — never after you have'
              : 'Needs MirrorSpace’s own app build — Expo Go can’t send reminders'
          }
          value={reminder}
          onValueChange={toggleReminder}
          disabled={!remindersSupported}
        />
        {reminder && (
          <SettingLink title="Send a test" subtitle="See one arrive in five seconds" onPress={testReminder} />
        )}
      </SettingGroup>

      <SettingGroup title="Sleep">
        <SettingLink
          title="Sleep from Health Connect"
          subtitle={
            healthPlatform() === 'not-android'
              ? 'Apple Health comes later — log sleep by hand on Today'
              : health
                ? 'On — your nights fill in by themselves'
                : 'Off — read your nights instead of logging them'
          }
          onPress={() => router.push('/health')}
        />
      </SettingGroup>

      <SettingGroup title="Privacy">
        {encryption && (
          <SettingLink
            title={encryption.encrypted ? 'Encrypted on this phone' : 'Not encrypted in Expo Go'}
            subtitle={
              encryption.encrypted
                ? `SQLCipher ${encryption.cipher.split(' ')[0]} · the key never leaves this phone`
                : 'MirrorSpace’s own build encrypts everything you write'
            }
          />
        )}
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
      </SettingGroup>

      <SettingGroup title="Your data">
        <SettingLink
          title={exporting ? 'Gathering…' : 'Download everything'}
          subtitle="Check-ins, pages, nights, Mirror, your plan and your account — one file"
          onPress={exporting ? undefined : runExport}
        />
      </SettingGroup>

      <Band />

      <SettingGroup title="Erase">
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
      </SettingGroup>

      <View style={styles.about}>
        <Art name="cat" size={72} />
        <Text variant="caption" tone="soft" style={styles.aboutText}>
          The Mirror is software, not a person, and not a therapist. MirrorSpace can’t call anyone for you — crisis lines
          are under calm, then help.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  about: { alignItems: 'center', gap: space.md, paddingTop: space.lg },
  aboutText: { textAlign: 'center', maxWidth: 300 }
});
