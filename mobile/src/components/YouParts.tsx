import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ApiError } from '@/lib/api';
import { loadCircle, setCircleName } from '@/lib/circle';
import { pickPhoto, removePhoto, usePhoto } from '@/lib/photo';
import { usePreferences, type Motion, type WeekStart } from '@/lib/preferences';
import { hitTarget, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/typography';

import { ArtDisc, isArtName, type ArtName } from './Art';
import { Avatar, IconPicker } from './Avatar';
import { Segmented, SettingGroup, SettingLink, SettingRow } from './Blocks';
import { Button } from './Button';
import { Text } from './Text';

/**
 * You's own pieces: the person at the top — their picture and name, the ones
 * their circle sees — and how they like the app to feel.
 */

type Profile = { name: string | null; icon: ArtName | null };

export function ProfileCard() {
  const { colors } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [offline, setOffline] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<ArtName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const photo = usePhoto();
  const [photoNote, setPhotoNote] = useState<string | null>(null);

  const choosePhoto = () => {
    setPhotoNote(null);
    pickPhoto().catch(() => setPhotoNote('That photo couldn’t be opened. Try another.'));
  };

  const load = useCallback(() => {
    loadCircle()
      .then(c => {
        setProfile({ name: c.me.name, icon: isArtName(c.me.icon) ? c.me.icon : null });
        setOffline(false);
      })
      .catch(() => setOffline(true));
  }, []);

  useEffect(load, [load]);

  const begin = () => {
    setName(profile?.name ?? '');
    setIcon(profile?.icon ?? null);
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await setCircleName(name, icon);
      setProfile({ name: name.trim(), icon });
      setEditing(false);
    } catch (err) {
      setError(
        err instanceof ApiError && typeof (err.body as { message?: unknown } | null)?.message === 'string'
          ? (err.body as { message: string }).message
          : 'That needs a connection. Nothing changed.'
      );
    } finally {
      setBusy(false);
    }
  };

  const shownName = profile?.name ?? 'No name yet';

  if (!editing) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${shownName}. Change your name or picture`}
        onPress={begin}
        disabled={offline && !profile}
        style={({ pressed }) => [styles.card, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Avatar icon={profile?.icon} name={profile?.name ?? '·'} size={64} photo={photo} />
        <View style={styles.flex}>
          <Text variant="title">{shownName}</Text>
          <Text variant="action" style={styles.underline}>
            {offline && !profile ? 'needs a connection' : 'change name or picture'}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.editor}>
      <View style={styles.card}>
        <Avatar icon={icon} name={name || '·'} size={64} photo={photo} />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="a first name is plenty"
          placeholderTextColor={colors.inkSoft}
          accessibilityLabel="Your name"
          maxLength={24}
          autoCapitalize="words"
          maxFontSizeMultiplier={2}
          style={[styles.field, { color: colors.ink, borderColor: colors.hairline }]}
        />
      </View>
      <View style={styles.photoRow}>
        <Button kind="outline" label={photo ? 'choose another photo' : 'choose a photo'} onPress={choosePhoto} />
        {photo && <Button kind="link" label="remove photo" onPress={() => removePhoto()} />}
      </View>
      <Text variant="caption" tone="soft">
        {photoNote ?? 'Your photo stays on this phone — it’s never uploaded. Your circle sees the drawing below.'}
      </Text>
      <Text variant="mono" tone="soft">
        Your drawing — the one your circle sees beside your name.
      </Text>
      <IconPicker value={icon} onChange={setIcon} />
      {error && (
        <Text variant="bodyItalic" accessibilityRole="alert">
          {error}
        </Text>
      )}
      <View style={styles.actions}>
        <Button label={busy ? 'saving…' : 'save'} disabled={!name.trim() || busy} onPress={save} />
        <Button kind="link" label="cancel" onPress={() => setEditing(false)} />
      </View>
    </View>
  );
}

const MOTIONS = [
  { key: 'full', label: 'full' },
  { key: 'gentle', label: 'gentle' },
  { key: 'still', label: 'still' }
] as const satisfies readonly { key: Motion; label: string }[];

const WEEKS = [
  { key: 'monday', label: 'monday' },
  { key: 'sunday', label: 'sunday' }
] as const satisfies readonly { key: WeekStart; label: string }[];

/** Motion, the week, and Today's picture. */
export function Personalisation() {
  const prefs = usePreferences();
  const [choosing, setChoosing] = useState(false);
  const fixed = prefs.picture !== 'daily' && isArtName(prefs.picture) ? prefs.picture : null;

  return (
    <>
      <SettingGroup title="Motion">
        <Segmented options={MOTIONS} value={prefs.motion} onChange={motion => prefs.set({ motion })} bleed={false} />
        <Text variant="caption" tone="soft" style={styles.hint}>
          {prefs.motion === 'full'
            ? 'Pictures float, ink drifts, the night sky twinkles.'
            : prefs.motion === 'gentle'
              ? 'The same, at half the pace.'
              : 'Nothing moves. Pages simply appear.'}
        </Text>
      </SettingGroup>

      <SettingGroup title="Heavy days">
        <SettingRow
          title="Low-day mode"
          subtitle="After a few heavy days, Today asks for nothing: breathe, check in, or just be here"
          value={prefs.lowDay}
          onValueChange={lowDay => prefs.set({ lowDay })}
        />
      </SettingGroup>

      <SettingGroup title="Week starts on">
        <Segmented options={WEEKS} value={prefs.weekStart} onChange={weekStart => prefs.set({ weekStart })} bleed={false} />
      </SettingGroup>

      <SettingGroup title="Today’s picture">
        <SettingLink
          title={fixed ? `Always the ${fixed}` : 'A new one each day'}
          subtitle="The plate at the top of Today"
          onPress={() => setChoosing(c => !c)}
        />
        {choosing && (
          <View style={styles.editor}>
            <View style={styles.pictureRow}>
              {fixed && <ArtDisc name={fixed} size={56} />}
              <Button
                kind={fixed ? 'link' : 'outline'}
                label="a new one each day"
                onPress={() => {
                  prefs.set({ picture: 'daily' });
                  setChoosing(false);
                }}
              />
            </View>
            <IconPicker
              value={fixed}
              onChange={picture => {
                prefs.set({ picture });
                setChoosing(false);
              }}
            />
          </View>
        )}
      </SettingGroup>
    </>
  );
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, flexWrap: 'wrap' },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, gap: space.xs },
  underline: { textDecorationLine: 'underline' },
  editor: { gap: space.md },
  field: {
    flex: 1,
    borderWidth: 1,
    minHeight: hitTarget,
    paddingHorizontal: space.md,
    fontFamily: fonts.sans,
    fontSize: 15
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  hint: { paddingTop: space.xs },
  pictureRow: { flexDirection: 'row', alignItems: 'center', gap: space.md }
});
