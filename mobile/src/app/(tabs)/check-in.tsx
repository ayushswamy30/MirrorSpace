import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
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
  // A fast double tap must not become two check-ins.
  const saving = useRef(false);

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

    try {
      const { replacing } = stage;
      const checkIn = replacing
        ? { ...replacing, emotion: emotion.word, energy: emotion.energy, pleasantness: emotion.pleasantness }
        : await recordCheckIn(emotion);
      if (replacing) await changeEmotion(replacing.id, emotion);

      setLatest(checkIn);
      setStage({ kind: 'after', checkIn });
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
        tagOrder={tagOrder}
        onChange={checkIn => {
          setLatest(checkIn);
          setStage({ kind: 'after', checkIn });
        }}
        onDone={() => setStage({ kind: 'choose', replacing: null })}
        onDifferentWord={checkIn => setStage({ kind: 'choose', replacing: checkIn })}
      />
    );
  }

  const replacing = stage.replacing;

  return (
    <Screen>
      <Text variant="label" tone="soft">
        check-in
      </Text>
      <Text variant="title">
        {replacing ? 'Which word fits better?' : 'Where are you, right now?'}
      </Text>
      {error ? (
        <Text tone="signal" accessibilityRole="alert">
          {error}
        </Text>
      ) : replacing ? (
        <Button kind="quiet" label={`keep “${replacing.emotion}”`} onPress={() => setStage({ kind: 'after', checkIn: replacing })} />
      ) : latest ? (
        <Text variant="receipt" tone="soft">
          {lastLine(latest, new Date())}
        </Text>
      ) : null}

      {QUADRANTS.map(quadrant => (
        <View key={quadrant} style={styles.section}>
          <Text variant="label" tone="soft" accessibilityRole="header">
            {quadrantLabel[quadrant]}
          </Text>
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
  tagOrder: readonly ContextTag[];
  onChange: (checkIn: CheckInRecord) => void;
  onDone: () => void;
  onDifferentWord: (checkIn: CheckInRecord) => void;
};

/** Everything after the tap is optional; the check-in already exists. */
function After({ checkIn, tagOrder, onChange, onDone, onDifferentWord }: AfterProps) {
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
    <Screen>
      <Animated.View entering={first} style={styles.block}>
        <Text variant="label" tone="soft">
          checked in
        </Text>
        <Text variant="title">{checkIn.emotion}.</Text>
        <Text tone="soft">That’s the check-in. Anything around it?</Text>
      </Animated.View>

      <Animated.View entering={second} style={styles.block}>
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

        <TextInput
          value={note}
          onChangeText={setNoteText}
          onBlur={saveNote}
          placeholder="a line, if you want"
          placeholderTextColor={colors.inkSoft}
          accessibilityLabel="note"
          multiline
          maxLength={500}
          maxFontSizeMultiplier={2}
          style={[
            styles.note,
            { color: colors.ink, borderColor: colors.hairline, backgroundColor: colors.paperRaised }
          ]}
        />

        {error && (
          <Text tone="signal" accessibilityRole="alert">
            {error}
          </Text>
        )}

        <Button
          label="done"
          onPress={async () => {
            if (await saveNote()) onDone();
          }}
        />
        <Button
          kind="quiet"
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
  section: { gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  note: {
    fontFamily: fonts.serif,
    fontSize: 18,
    lineHeight: 27,
    minHeight: 88,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    textAlignVertical: 'top'
  }
});
