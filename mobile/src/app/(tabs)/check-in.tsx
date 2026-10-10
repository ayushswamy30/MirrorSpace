import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Button } from '@/components/Button';
import { CareLine } from '@/components/CareLine';
import { Chip } from '@/components/Chip';
import { Letters } from '@/components/Letters';
import { Vent } from '@/components/Vent';
import { Art, type ArtName } from '@/components/Art';
import { Lede, Section, Segmented } from '@/components/Blocks';
import { AppHeader } from '@/components/Header';
import { WeatherMark } from '@/components/TodayParts';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import {
  changeEmotion,
  CONTEXT_TAGS,
  latestCheckIn,
  localDate,
  recentTags,
  recordCheckIn,
  setNote,
  setTags,
  suggestTags,
  type CheckIn as CheckInRecord,
  type ContextTag
} from '@/lib/checkIns';
import { QUADRANTS, findEmotion, wordsNearestFirst, type Emotion, type Quadrant } from '@/lib/emotions';
import { answerConcern } from '@/lib/safety/respond';
import { higher, screenCheckIn, type Tier } from '@/lib/safety/screen';
import { useProfile } from '@/lib/session';
import { useEntering } from '@/theme/motion';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/typography';

/**
 * Check-in (report §5, §7): one tap minimum, three typical.
 *
 * Tapping a word *is* the check-in — it is saved on that tap, before anything
 * else appears. What follows (context tags, a line of note) is optional and
 * edits the same row, so walking away at any point loses nothing.
 *
 * Every version of a check-in is screened (report §8): a low result leaves a
 * quiet care line, elevated or acute opens the crisis screen over this one.
 */

type Stage =
  | { kind: 'choose'; replacing: CheckInRecord | null }
  | { kind: 'after'; checkIn: CheckInRecord };

const defaultTagOrder = CONTEXT_TAGS.map(t => t.key);

/** Naming a feeling is the default; vent is the page beside it. */
type Mode = 'name' | 'vent' | 'letter';
const MODES = [
  { key: 'name', label: 'check in' },
  { key: 'vent', label: 'vent' },
  { key: 'letter', label: 'letters' }
] as const;

function asMode(value: string | undefined): Mode | null {
  return value === 'vent' || value === 'name' || value === 'letter' ? value : null;
}

function lastLine(checkIn: CheckInRecord, now: Date): string {
  const at = new Date(checkIn.createdAt);
  const daysAgo = (now.getTime() - at.getTime()) / (24 * 60 * 60 * 1000);
  const when =
    checkIn.localDate === localDate(now)
      ? at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : at.toLocaleDateString([], daysAgo < 6 ? { weekday: 'long' } : { day: 'numeric', month: 'short' });
  return `last: ${checkIn.emotion} · ${when}`;
}

export default function CheckIn() {
  const profile = useProfile();
  const { colors } = useTheme();
  // Today's "write something down" arrives with ?mode=vent.
  const params = useLocalSearchParams<{ mode?: string; open?: string }>();
  const [stage, setStage] = useState<Stage>({ kind: 'choose', replacing: null });
  const [mode, setMode] = useState<Mode>(asMode(params.mode) ?? 'name');
  // A new ?mode= (the tab is already mounted) switches to it once.
  const [seenMode, setSeenMode] = useState(params.mode);
  if (params.mode !== seenMode) {
    setSeenMode(params.mode);
    const next = asMode(params.mode);
    if (next) setMode(next);
  }
  const [latest, setLatest] = useState<CheckInRecord | null>(null);
  const [tagOrder, setTagOrder] = useState<ContextTag[]>(defaultTagOrder);
  const [error, setError] = useState<string | null>(null);
  // Shown on the choose screen after a check-in that screened above none.
  const [care, setCare] = useState(false);
  // A fast double tap must not become two check-ins.
  const saving = useRef(false);
  // The highest tier each check-in has been answered at, so editing tags does
  // not re-open the crisis screen or log the same concern twice.
  const answered = useRef(new Map<string, Tier>());

  const respond = (checkIn: CheckInRecord) => {
    const tier = screenCheckIn(checkIn);
    const before = answered.current.get(checkIn.id) ?? 'none';
    if (tier === before || higher(tier, before) !== tier) return;

    answered.current.set(checkIn.id, tier);
    answerConcern(tier, 'check_in');
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([latestCheckIn(), recentTags()])
      .then(([last, recent]) => {
        if (cancelled) return;
        setLatest(last);
        setTagOrder(suggestTags(recent));
      })
      .catch(err => console.warn('Check-in history unavailable:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  const choose = async (emotion: Emotion) => {
    if (saving.current || stage.kind !== 'choose') return;
    saving.current = true;
    setError(null);
    setCare(false);

    try {
      const { replacing } = stage;
      const checkIn = replacing
        ? { ...replacing, emotion: emotion.word, energy: emotion.energy, pleasantness: emotion.pleasantness }
        : await recordCheckIn(emotion);
      if (replacing) await changeEmotion(replacing.id, emotion);

      setLatest(checkIn);
      setStage({ kind: 'after', checkIn });
      respond(checkIn);
    } catch (err) {
      console.error('Check-in save failed:', err);
      setError('That didn’t save. Try the word once more.');
    } finally {
      saving.current = false;
    }
  };

  if (stage.kind === 'after') {
    return (
      <After
        checkIn={stage.checkIn}
        care={screenCheckIn(stage.checkIn) !== 'none'}
        tagOrder={tagOrder}
        onChange={checkIn => {
          setLatest(checkIn);
          setStage({ kind: 'after', checkIn });
          respond(checkIn);
        }}
        onDone={checkIn => {
          setCare(screenCheckIn(checkIn) !== 'none');
          setStage({ kind: 'choose', replacing: null });
        }}
        onDifferentWord={checkIn => setStage({ kind: 'choose', replacing: checkIn })}
      />
    );
  }

  const replacing = stage.replacing;

  if (mode === 'letter' && !replacing) {
    return (
      <Screen scene="weather" header={<AppHeader />}>
        <Segmented options={MODES} value={mode} onChange={setMode} />
        <Letters open={params.open} />
      </Screen>
    );
  }

  if (mode === 'vent' && !replacing) {
    return (
      <Screen scene="weather" header={<AppHeader />}>
        <Segmented options={MODES} value={mode} onChange={setMode} />
        <Vent reflections={profile.consents.ai_reflections?.granted === true} />
      </Screen>
    );
  }

  return (
    <Screen scene="weather" header={<AppHeader />}>
      {!replacing && <Segmented options={MODES} value={mode} onChange={setMode} />}
      <View style={styles.block}>
        {/* A dot breathing slowly: the only thing asked before choosing. */}
        <View style={styles.art}>
          <WeatherMark color={colors.inkSoft} size={10} />
        </View>
        <Lede
          label={replacing ? 'change the word' : 'name it'}
          title={replacing ? 'Which word fits better?' : 'Where are you, right now?'}
        >
          {error ? (
            <Text variant="bodyItalic" accessibilityRole="alert">
              {error}
            </Text>
          ) : care ? (
            <CareLine />
          ) : replacing ? (
            <Button
              kind="link"
              label={`keep “${replacing.emotion}”`}
              onPress={() => setStage({ kind: 'after', checkIn: replacing })}
            />
          ) : latest ? (
            <Text variant="mono" tone="soft">
              {lastLine(latest, new Date())}
            </Text>
          ) : (
            <Text tone="soft">One word is enough.</Text>
          )}
        </Lede>
      </View>

      <Choose
        // A new "different word" opens on the mood of the word being replaced.
        key={replacing?.id ?? 'new'}
        start={replacing ? (findEmotion(replacing.emotion)?.quadrant ?? null) : null}
        selectedWord={replacing?.emotion}
        onChoose={choose}
      />
    </Screen>
  );
}

/**
 * The words, gently: first four moods, each a card with a picture; then only
 * that mood's closest words, and the rest one tap further. A hundred words at
 * once asks for a decision; four asks for a feeling.
 */
const MOODS: Record<Quadrant, { title: string; hint: string; art: ArtName }> = {
  'charged-unpleasant': { title: 'Wound up', hint: 'tense · uneasy · on edge', art: 'urchin' },
  'charged-pleasant': { title: 'Bright', hint: 'lively · glad · focused', art: 'butterfly' },
  'low-unpleasant': { title: 'Heavy', hint: 'tired · low · drained', art: 'can' },
  'low-pleasant': { title: 'Easy', hint: 'calm · content · settled', art: 'lily' }
};

const FIRST_WORDS = 10;

/** Each feeling's own light: coral for wound up, sun for bright, dusk for heavy, mint for easy. */
const MOOD_GLOW: Record<Quadrant, readonly [string, string]> = {
  'charged-unpleasant': ['#FF8A7A', '#FF9EC8'],
  'charged-pleasant': ['#FFD873', '#FFB778'],
  'low-unpleasant': ['#8FA2FF', '#B9A2FF'],
  'low-pleasant': ['#86E3BC', '#93CBFF']
};

function MoodGlow({ quadrant }: { quadrant: Quadrant }) {
  const { scheme } = useTheme();
  const id = `mood-${quadrant}`;
  const [a, b] = MOOD_GLOW[quadrant];
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="38%" r="70%">
          <Stop offset="0" stopColor={a} stopOpacity={scheme === 'dark' ? 0.32 : 0.5} />
          <Stop offset="0.55" stopColor={b} stopOpacity={scheme === 'dark' ? 0.12 : 0.22} />
          <Stop offset="1" stopColor={b} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

function Choose({
  start,
  selectedWord,
  onChoose
}: {
  start: Quadrant | null;
  selectedWord?: string;
  onChoose: (emotion: Emotion) => void;
}) {
  const { colors } = useTheme();
  const [quadrant, setQuadrant] = useState<Quadrant | null>(start);
  const [more, setMore] = useState(false);
  const enter = useEntering();

  if (!quadrant) {
    return (
      <Animated.View entering={enter} style={styles.moods}>
        {QUADRANTS.map(q => (
          <Pressable
            key={q}
            accessibilityRole="button"
            accessibilityLabel={`${MOODS[q].title}: ${MOODS[q].hint}`}
            onPress={() => {
              setQuadrant(q);
              setMore(false);
            }}
            style={({ pressed }) => [
              styles.mood,
              { borderColor: colors.glassEdge, backgroundColor: colors.glass, transform: [{ scale: pressed ? 0.97 : 1 }] }
            ]}
          >
            <MoodGlow quadrant={q} />
            <Art name={MOODS[q].art} size={56} />
            <Text variant="heading">{MOODS[q].title}</Text>
            <Text variant="mono" tone="soft" style={styles.centre}>
              {MOODS[q].hint}
            </Text>
          </Pressable>
        ))}
      </Animated.View>
    );
  }

  const words = wordsNearestFirst(quadrant);
  const shown = more ? words : words.slice(0, FIRST_WORDS);

  return (
    <Animated.View key={quadrant} entering={enter} style={styles.block}>
      <View style={styles.moodHead}>
        <Art name={MOODS[quadrant].art} size={40} />
        <View style={styles.flex}>
          <Text variant="label" tone="soft">
            {MOODS[quadrant].title}
          </Text>
          <Text variant="bodyItalic">Which word is closest?</Text>
        </View>
      </View>
      <View style={styles.wrap}>
        {shown.map(emotion => (
          <Chip key={emotion.word} label={emotion.word} selected={selectedWord === emotion.word} onPress={() => onChoose(emotion)} />
        ))}
      </View>
      <View style={styles.links}>
        {!more && words.length > FIRST_WORDS && <Button kind="link" label="more words" onPress={() => setMore(true)} />}
        <Button kind="link" label="another mood" onPress={() => setQuadrant(null)} />
      </View>
    </Animated.View>
  );
}

type AfterProps = {
  checkIn: CheckInRecord;
  /** The check-in screened above none: leave the care line under it. */
  care: boolean;
  tagOrder: readonly ContextTag[];
  onChange: (checkIn: CheckInRecord) => void;
  onDone: (checkIn: CheckInRecord) => void;
  onDifferentWord: (checkIn: CheckInRecord) => void;
};

/** Everything after the tap is optional; the check-in already exists. */
function After({ checkIn, care, tagOrder, onChange, onDone, onDifferentWord }: AfterProps) {
  const { colors } = useTheme();
  const [note, setNoteText] = useState(checkIn.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const first = useEntering();
  const second = useEntering(150);
  // Two taps can land before the parent re-renders; each builds on the last
  // change rather than on a stale prop.
  const current = useRef(checkIn);
  const update = (next: CheckInRecord) => {
    current.current = next;
    onChange(next);
  };

  const toggle = async (tag: ContextTag) => {
    const before = current.current.tags;
    const tags = before.includes(tag) ? before.filter(t => t !== tag) : [...before, tag];
    update({ ...current.current, tags });
    try {
      await setTags(checkIn.id, tags);
      setError(null);
    } catch (err) {
      console.error('Tag save failed:', err);
      update({ ...current.current, tags: before });
      setError('That tag didn’t save. The check-in itself is kept.');
    }
  };

  const saveNote = async () => {
    if (note.trim() === (current.current.note ?? '')) return true;
    try {
      await setNote(checkIn.id, note);
      update({ ...current.current, note: note.trim() || null });
      return true;
    } catch (err) {
      console.error('Note save failed:', err);
      setError('The note didn’t save. The check-in itself is kept.');
      return false;
    }
  };

  return (
    <Screen scene="weather" header={<AppHeader />}>
      <Animated.View entering={first} style={styles.block}>
        <Art name="lily" size={112} style={styles.art} />
        <Lede label="checked in" title={`${checkIn.emotion}.`}>
          <Text tone="soft">That’s the check-in. Anything around it?</Text>
          {care && <CareLine />}
        </Lede>
      </Animated.View>

      <Animated.View entering={second} style={styles.block}>
        <Section title="around it">
          <View style={styles.wrap}>
            {tagOrder.map(tag => (
              <Chip
                key={tag}
                role="checkbox"
                label={tag}
                selected={checkIn.tags.includes(tag)}
                onPress={() => toggle(tag)}
              />
            ))}
          </View>
        </Section>

        {/* A writing sheet: a soft tinted block with its prompt in italic serif. */}
        <View style={[styles.sheet, { backgroundColor: colors.tint }]}>
          <Text variant="bodyItalic">A line about it, if you want.</Text>
          <TextInput
            value={note}
            onChangeText={setNoteText}
            onBlur={saveNote}
            placeholder="write here"
            placeholderTextColor={colors.inkSoft}
            accessibilityLabel="note"
            multiline
            maxLength={500}
            maxFontSizeMultiplier={2}
            style={[styles.note, { color: colors.ink }]}
          />
        </View>

        {error && (
          <Text variant="bodyItalic" accessibilityRole="alert">
            {error}
          </Text>
        )}

        <Button
          label="done"
          arrow
          onPress={async () => {
            if (await saveNote()) onDone(current.current);
          }}
        />
        <Button
          kind="link"
          label="a different word"
          onPress={async () => {
            if (await saveNote()) onDifferentWord(current.current);
          }}
        />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.lg },
  art: { alignSelf: 'flex-end' },
  moods: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  mood: {
    width: '48.5%',
    borderWidth: 1,
    borderRadius: radius.card,
    overflow: 'hidden',
    paddingVertical: space.lg,
    paddingHorizontal: space.sm,
    alignItems: 'center',
    gap: space.sm
  },
  centre: { textAlign: 'center' },
  moodHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  links: { flexDirection: 'row', gap: space.lg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  sheet: { padding: space.md, gap: space.sm, borderRadius: radius.card },
  note: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 23,
    minHeight: 72,
    padding: 0,
    textAlignVertical: 'top'
  }
});
