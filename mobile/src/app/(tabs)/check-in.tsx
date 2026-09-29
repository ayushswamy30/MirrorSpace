import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { CareLine } from '@/components/CareLine';
import { Chip } from '@/components/Chip';
import { SectionLabel } from '@/components/Blocks';
import { AppHeader } from '@/components/Header';
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
import { QUADRANTS, quadrantLabel, wordsNearestFirst, type Emotion } from '@/lib/emotions';
import { recordSafetyEvent } from '@/lib/safety/log';
import { atLeast, higher, screenCheckIn, type Tier } from '@/lib/safety/screen';
import { useEntering } from '@/theme/motion';
import { space } from '@/theme/tokens';
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
  const [stage, setStage] = useState<Stage>({ kind: 'choose', replacing: null });
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
    if (tier === 'none') return;
    recordSafetyEvent(tier, 'check_in').catch(err => console.warn('Safety event not logged:', err));
    if (atLeast(tier, 'elevated')) router.push(`/crisis?tier=${tier}`);
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

  return (
    <Screen header={<AppHeader context="check-in" />}>
      <View style={styles.block}>
        <SectionLabel title={replacing ? 'change the word' : 'name it'} rule={false} />
        <Text variant="reading">{replacing ? 'Which word fits better?' : 'Where are you, right now?'}</Text>
      </View>
      {error ? (
        <Text variant="bodyItalic" accessibilityRole="alert">
          {error}
        </Text>
      ) : care ? (
        <CareLine />
      ) : replacing ? (
        <Button kind="link" label={`keep “${replacing.emotion}”`} onPress={() => setStage({ kind: 'after', checkIn: replacing })} />
      ) : latest ? (
        <Text variant="mono" tone="soft">
          {lastLine(latest, new Date())}
        </Text>
      ) : (
        <Text tone="soft">One word is enough.</Text>
      )}

      {QUADRANTS.map(quadrant => (
        <View key={quadrant} style={styles.section}>
          <SectionLabel title={quadrantLabel[quadrant]} />
          <View style={styles.wrap}>
            {wordsNearestFirst(quadrant).map(emotion => (
              <Chip
                key={emotion.word}
                label={emotion.word}
                selected={replacing?.emotion === emotion.word}
                onPress={() => choose(emotion)}
              />
            ))}
          </View>
        </View>
      ))}
    </Screen>
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
    <Screen header={<AppHeader context="check-in" />}>
      <Animated.View entering={first} style={styles.block}>
        <SectionLabel title="checked in" rule={false} />
        <Text variant="reading">{checkIn.emotion}.</Text>
        <Text tone="soft">That’s the check-in. Anything around it?</Text>
        {care && <CareLine />}
      </Animated.View>

      <Animated.View entering={second} style={styles.block}>
        <SectionLabel title="around it" />
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
  block: { gap: space.md },
  section: { gap: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  sheet: { padding: space.md, gap: space.sm },
  note: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 23,
    minHeight: 72,
    padding: 0,
    textAlignVertical: 'top'
  }
});
