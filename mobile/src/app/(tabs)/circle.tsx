import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Art, type ArtName } from '@/components/Art';
import { Avatar, IconPicker } from '@/components/Avatar';
import { Orbit } from '@/components/Orbit';
import { Box, Lede, Section, SettingRow } from '@/components/Blocks';
import { Button } from '@/components/Button';
import { AppHeader } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { setConsent } from '@/lib/account';
import { ApiError } from '@/lib/api';
import { WEATHER_INK } from '@/lib/chart';
import {
  acceptFriend,
  loadCircle,
  markNudgesSeen,
  removeFriend,
  requestFriend,
  setCircleName,
  setRunningLow,
  shareStatus,
  thinkingOfYou,
  type CircleFriend,
  type CircleState
} from '@/lib/circle';
import { consentCopy } from '@/lib/consent';
import { useMotion } from '@/lib/preferences';
import { askForAlerts } from '@/lib/push';
import { useSession } from '@/lib/session';
import { gutter, hitTarget, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/typography';

/**
 * Circle (report §4–5), after the reference's Friends tab: a few people who
 * see each other's Inner Weather and a "running low" signal — nothing else.
 * Added by a six-letter code, never by contacts. Sharing is its own consent,
 * asked here before anything leaves the phone, and withdrawn just as easily.
 */

type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; circle: CircleState };

function message(err: unknown, fallback: string): string {
  return err instanceof ApiError && typeof (err.body as { message?: unknown } | null)?.message === 'string'
    ? (err.body as { message: string }).message
    : fallback;
}

export default function Circle() {
  const session = useSession();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [note, setNote] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    loadCircle()
      .then(circle => setLoad({ kind: 'ready', circle }))
      .catch(() => setLoad(current => (current.kind === 'ready' ? current : { kind: 'error' })));
  }, []);

  useFocusEffect(refresh);

  if (session.status !== 'ready') return <Screen header={<AppHeader />}>{null}</Screen>;

  if (load.kind === 'loading') return <Screen header={<AppHeader />}>{null}</Screen>;

  if (load.kind === 'error') {
    return (
      <Screen header={<AppHeader />}>
        <Lede label="your circle" title="Your circle needs a connection." size="title">
          <Text tone="soft">Nothing else in Lowkei does — check-ins, vent and calm all work offline.</Text>
        </Lede>
        <Button kind="link" label="try again" onPress={refresh} />
      </Screen>
    );
  }

  const { circle } = load;
  const act = async (fn: () => Promise<unknown>, failed: string) => {
    setNote(null);
    try {
      await fn();
      refresh();
    } catch (err) {
      setNote(message(err, failed));
    }
  };

  if (!circle.me.name) {
    return (
      <StartCircle
        onStart={async (name, share, icon) => {
          await setCircleName(name, icon);
          if (share) {
            await setConsent('circle', true);
            await session.refreshProfile();
            await shareStatus().catch(() => undefined);
          }
          // So a friend's "running low" can reach this phone. Asked here, where
          // the reason is plain; declining changes nothing else.
          await askForAlerts().catch(() => false);
          refresh();
        }}
      />
    );
  }

  return (
    <Screen header={<AppHeader />}>
      <View style={styles.top}>
        <Lede label="your circle" title={circle.friends.length ? peopleLine(circle.friends) : 'Just you, so far.'}>
          <Text tone="soft">They see your weather, and nothing else.</Text>
        </Lede>
        <Orbit
          me={{ name: circle.me.name, icon: circle.me.icon }}
          friends={circle.friends}
          onSelect={id => setOpenId(current => (current === id ? null : id))}
        />
        <Button kind="link" label="change your name or picture" onPress={() => router.navigate('/you')} style={styles.centred} />
      </View>

      {note && (
        <Text variant="bodyItalic" accessibilityRole="alert">
          {note}
        </Text>
      )}

      {circle.nudges.length > 0 && (
        <Nudges nudges={circle.nudges} onSeen={() => markNudgesSeen().then(refresh).catch(() => undefined)} />
      )}

      <Section title="running low">
        <SettingRow
          title="Running low"
          subtitle={
            circle.me.sharing
              ? 'Your circle sees it for a day. No explanation needed.'
              : 'Turn on sharing below to send this.'
          }
          value={circle.me.low}
          disabled={!circle.me.sharing}
          onValueChange={on => act(() => setRunningLow(on), 'That didn’t send. Try once more.')}
        />
      </Section>

      {circle.incoming.length > 0 && (
        <Section title="asking to join">
          {circle.incoming.map(r => (
            <View key={r.id} style={styles.request}>
              <Text variant="heading" style={styles.flex}>
                {r.name}
              </Text>
              <Button kind="outline" label="accept" onPress={() => act(() => acceptFriend(r.id), 'That didn’t go through.')} />
              <Button kind="link" label="decline" onPress={() => act(() => removeFriend(r.id), 'That didn’t go through.')} />
            </View>
          ))}
        </Section>
      )}

      <Section title="your friends">
        {circle.friends.length === 0 ? (
          <Text tone="soft">No one yet. Give someone your code, or add theirs below.</Text>
        ) : (
          circle.friends.map(f => (
            <FriendRow
              key={f.id}
              friend={f}
              open={openId === f.id}
              onToggle={() => setOpenId(current => (current === f.id ? null : f.id))}
              onNudge={() => act(() => thinkingOfYou(f.id), 'That didn’t send.').then(() => setNote(`${f.name} will see you’re thinking of them.`))}
              onRemove={() => act(() => removeFriend(f.id), 'That didn’t go through.')}
            />
          ))
        )}
        {circle.outgoing.map(r => (
          <Text key={r.id} variant="mono" tone="soft" style={styles.waiting}>
            {`waiting on ${r.name}`}
          </Text>
        ))}
      </Section>

      <AddFriend
        code={circle.me.code}
        onAdd={async code => {
          setNote(null);
          try {
            const name = await requestFriend(code);
            setNote(`Asked ${name}. They’ll see it next time they open their circle.`);
            refresh();
            return true;
          } catch (err) {
            setNote(message(err, 'That didn’t go through.'));
            return false;
          }
        }}
      />

      <Section title="sharing">
        <SettingRow
          title="Share with my circle"
          subtitle="Today’s weather, running low, and which weekdays run heavy. Never your words."
          value={circle.me.sharing}
          onValueChange={on =>
            act(async () => {
              await setConsent('circle', on);
              await session.refreshProfile();
              if (on) await shareStatus();
            }, 'That needs a connection. Nothing changed.')
          }
        />
      </Section>
    </Screen>
  );
}

function peopleLine(friends: CircleFriend[]): string {
  const low = friends.filter(f => f.low).length;
  if (low === 1) return `${friends.find(f => f.low)!.name} is running low.`;
  if (low > 1) return `${low} of your circle are running low.`;
  return friends.length === 1 ? 'You and one other.' : `You and ${friends.length} others.`;
}

/** The consent screen for Circle: what they'd see, what they never will. */
function StartCircle({ onStart }: { onStart: (name: string, share: boolean, icon: ArtName | null) => Promise<void> }) {
  const { colors } = useTheme();
  const copy = consentCopy.circle;
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<ArtName | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async (share: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await onStart(name, share, icon);
    } catch (err) {
      setError(message(err, 'That needs a connection. Nothing was shared.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={<AppHeader />}>
      <View style={styles.top}>
        <Art name="kittens" size={120} style={styles.art} />
        <Lede label="your circle" title="A few people who can see your weather, and nothing else.">
          <Text tone="soft">{copy.title}</Text>
        </Lede>
      </View>

      <Box title="they would see">
        {copy.sends.map(line => (
          <Text key={line}>{`· ${line}`}</Text>
        ))}
      </Box>

      <Box title="never">
        {copy.neverSends.map(line => (
          <Text key={line}>{line}</Text>
        ))}
      </Box>

      <Section title="the name they see">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="a first name is plenty"
          placeholderTextColor={colors.inkSoft}
          accessibilityLabel="The name your circle sees"
          maxLength={24}
          autoCapitalize="words"
          maxFontSizeMultiplier={2}
          style={[styles.field, { color: colors.ink, borderColor: colors.hairline }]}
        />
      </Section>

      <Section title="the picture they see">
        <View style={styles.preview}>
          <Avatar icon={icon} name={name || '·'} size={56} />
          <Text variant="caption" tone="soft" style={styles.flex}>
            One of the app’s own pictures, beside your name. You can change it any time under You.
          </Text>
        </View>
        <IconPicker value={icon} onChange={setIcon} />
      </Section>

      <View style={styles.block}>
        {error && (
          <Text variant="bodyItalic" accessibilityRole="alert">
            {error}
          </Text>
        )}
        <Button label="start my circle" arrow disabled={!name.trim() || busy} onPress={() => start(true)} />
        <Button
          kind="link"
          label="add friends, but share nothing yet"
          disabled={!name.trim() || busy}
          onPress={() => start(false)}
        />
        <Text variant="caption" tone="soft">
          {copy.declined} You can stop sharing at any time, here.
        </Text>
      </View>
    </Screen>
  );
}

function Nudges({ nudges, onSeen }: { nudges: CircleState['nudges']; onSeen: () => void }) {
  const { colors } = useTheme();
  const names = [...new Set(nudges.map(n => n.name))];
  const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

  return (
    <View style={[styles.sheet, { backgroundColor: colors.tint }]} accessibilityLiveRegion="polite">
      <Text variant="bodyItalic">{`${who} ${names.length === 1 ? 'is' : 'are'} thinking of you.`}</Text>
      <Button kind="link" label="thank you" onPress={onSeen} />
    </View>
  );
}

/** A heart that rises from the row and fades: "thinking of you" was sent. */
function SentHeart() {
  const motion = useMotion();
  const rise = useSharedValue(0);

  useEffect(() => {
    rise.value = withTiming(1, { duration: motion === 'still' ? 0 : 1600, easing: Easing.out(Easing.cubic) });
  }, [motion, rise]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - rise.value,
    transform: [{ translateY: -46 * rise.value }, { scale: 0.8 + rise.value * 0.4 }]
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.heart, style]}>
      <Art name="heart" size={26} />
    </Animated.View>
  );
}

function FriendRow({
  friend,
  open,
  onToggle,
  onNudge,
  onRemove
}: {
  friend: CircleFriend;
  open: boolean;
  onToggle: () => void;
  onNudge: () => Promise<void>;
  onRemove: () => void;
}) {
  const { colors, signal } = useTheme();
  const [confirm, setConfirm] = useState(false);
  const [sent, setSent] = useState(0);
  const today = friend.weather ? `${friend.weather} today` : 'no weather today';
  const status = friend.low ? `${today} · running low` : today;

  return (
    <View style={[styles.friend, { borderBottomColor: colors.hairline }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${friend.name}. ${status}${friend.rhythm ? `. ${friend.rhythm}` : ''}`}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          onToggle();
          setConfirm(false);
        }}
        style={({ pressed }) => [styles.friendRow, { opacity: pressed ? 0.6 : 1 }]}
      >
        <View>
          <Avatar icon={friend.icon} name={friend.name} size={40} />
          {friend.weather && (
            <View style={[styles.badge, { borderColor: colors.ink, backgroundColor: colors.paper }]}>
              <View style={[styles.fill, { backgroundColor: colors.ink, opacity: WEATHER_INK[friend.weather] }]} />
            </View>
          )}
        </View>
        <View style={styles.flex}>
          <Text variant="heading">{friend.name}</Text>
          <Text variant="caption" tone="soft">
            {status}
          </Text>
          {friend.rhythm && (
            <Text variant="mono" tone="soft">
              {friend.rhythm}
            </Text>
          )}
        </View>
        {/* The one colour on the page goes to whoever is struggling. */}
        {friend.low && <View style={[styles.low, { backgroundColor: signal }]} />}
      </Pressable>
      {open && (
        <View style={styles.actions}>
          <View>
            <Button
              kind="outline"
              label="thinking of you"
              onPress={async () => {
                await onNudge();
                setSent(n => n + 1);
              }}
            />
            {sent > 0 && <SentHeart key={sent} />}
          </View>
          {confirm ? (
            <Button kind="link" label={`remove ${friend.name}`} onPress={onRemove} />
          ) : (
            <Button kind="link" label="remove" onPress={() => setConfirm(true)} />
          )}
        </View>
      )}
    </View>
  );
}

function AddFriend({ code, onAdd }: { code: string | null; onAdd: (code: string) => Promise<boolean> }) {
  const { colors } = useTheme();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <View style={styles.block}>
      {code && (
        <Box title="your code" centred>
          <Text style={styles.code} accessibilityLabel={`Your code: ${code.split('').join(' ')}`}>
            {code}
          </Text>
          <Button
            kind="link"
            label="share it"
            style={styles.centred}
            onPress={() =>
              Share.share({ message: `Join my circle on Lowkei — my code is ${code}. You’d see my weather, nothing else.` })
            }
          />
        </Box>
      )}
      <Section title="add someone">
        <View style={styles.addRow}>
          <TextInput
            value={value}
            onChangeText={t => setValue(t.toUpperCase())}
            placeholder="THEIR CODE"
            placeholderTextColor={colors.inkSoft}
            accessibilityLabel="Their code"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            maxFontSizeMultiplier={2}
            style={[styles.field, styles.flex, styles.codeField, { color: colors.ink, borderColor: colors.hairline }]}
          />
          <Button
            label="add"
            disabled={value.replace(/[\s-]/g, '').length !== 6 || busy}
            onPress={async () => {
              setBusy(true);
              if (await onAdd(value)) setValue('');
              setBusy(false);
            }}
          />
        </View>
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { gap: space.lg },
  art: { alignSelf: 'flex-end' },
  block: { gap: space.md },
  flex: { flex: 1 },
  sheet: { padding: space.md, gap: space.sm },
  request: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  friend: { borderBottomWidth: StyleSheet.hairlineWidth },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: hitTarget + 16 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingBottom: space.md, paddingLeft: 18 + space.md },
  mark: { width: 18, height: 18, borderRadius: radius.dot, borderWidth: 1, overflow: 'hidden' },
  fill: { flex: 1 },
  speck: { width: 4, height: 4, borderRadius: radius.dot, marginHorizontal: 7 },
  low: { width: 8, height: 8, borderRadius: radius.dot },
  waiting: { paddingTop: space.sm },
  centred: { alignSelf: 'center' },
  badge: { position: 'absolute', right: -2, bottom: -2, width: 13, height: 13, borderRadius: radius.dot, borderWidth: 1, overflow: 'hidden' },
  heart: { position: 'absolute', alignSelf: 'center', top: -8 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingBottom: space.sm },
  code: { fontFamily: fonts.mono, fontSize: 30, lineHeight: 38, letterSpacing: 6 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  field: {
    borderWidth: 1,
    minHeight: hitTarget,
    paddingHorizontal: space.md,
    fontFamily: fonts.sans,
    fontSize: 15
  },
  codeField: { fontFamily: fonts.mono, letterSpacing: 3, marginHorizontal: 0, paddingHorizontal: gutter - space.xs }
});
