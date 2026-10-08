import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { EndMark, Lede, Section, SettingRow } from '@/components/Blocks';
import { Button } from '@/components/Button';
import { SubHeader } from '@/components/Header';
import { Loader } from '@/components/Loader';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import {
  addNote,
  currentPatterns,
  forgetNote,
  hiddenPatterns,
  listNotes,
  MAX_NOTE_CHARS,
  MAX_NOTES,
  memoryEnabled,
  setMemoryEnabled,
  setPatternHidden,
  updateNote,
  type Note,
  type Pattern
} from '@/lib/memory';
import { useProfile } from '@/lib/session';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/typography';

/**
 * What the Mirror knows: everything it may draw on, on one page. Patterns the
 * phone found — each can be hidden — and notes written for it — each can be
 * corrected or forgotten. Off until switched on; nothing here is kept by the
 * server, it goes with each message and is forgotten after.
 */

type Data = { on: boolean; patterns: Pattern[]; hidden: string[]; notes: Note[] };

export default function Memory() {
  const personal = useProfile().consents.readings?.granted === true;
  const [data, setData] = useState<Data | null>(null);

  const load = useCallback(() => {
    Promise.all([memoryEnabled(), personal ? currentPatterns() : Promise.resolve([]), hiddenPatterns(), listNotes()])
      .then(([on, patterns, hidden, notes]) => setData({ on, patterns, hidden, notes }))
      .catch(err => console.warn('Memory unavailable:', err));
  }, [personal]);
  useEffect(load, [load]);

  const header = <SubHeader title="what the mirror knows" leading="close" />;
  if (!data) {
    return (
      <Screen edges={['top', 'bottom']} header={header} scroll={false}>
        <Loader fill />
      </Screen>
    );
  }

  const act = (work: Promise<unknown>) => work.then(load).catch(err => console.warn('Memory not saved:', err));

  return (
    <Screen edges={['top', 'bottom']} header={header}>
      <Lede label="the mirror’s memory" title="What the Mirror knows.">
        <Text tone="soft">
          Only what’s on this page, and only while this is on. It goes with each message you send in Mirror — through
          our server to Groq, the AI that answers — and neither keeps it. When an answer draws on something here, it
          says so underneath.
        </Text>
      </Lede>

      <SettingRow
        title="Let the Mirror use this page"
        subtitle={data.on ? 'On — sent with each message' : 'Off — Mirror sees only the conversation'}
        value={data.on}
        onValueChange={on => act(setMemoryEnabled(on))}
      />

      <Section title="patterns it can see">
        {!personal ? (
          <>
            <Text tone="soft">Your readings are general, so there are no patterns to share. Personal readings are under You.</Text>
            <Button kind="link" label="open you" onPress={() => router.navigate('/you')} />
          </>
        ) : data.patterns.length === 0 ? (
          <Text tone="soft">No patterns yet — they come with a few days of check-ins.</Text>
        ) : (
          data.patterns.map(p => {
            const hidden = data.hidden.includes(p.key);
            return (
              <View key={p.key} style={styles.item}>
                <Text variant="heading" tone={hidden ? 'soft' : 'ink'}>
                  {p.text}
                </Text>
                <Text variant="mono" tone="soft">
                  {hidden ? 'hidden from the Mirror' : p.receipt}
                </Text>
                <Button kind="link" label={hidden ? 'show it again' : 'hide this'} onPress={() => act(setPatternHidden(p.key, !hidden))} />
              </View>
            );
          })
        )}
      </Section>

      <Section title="things you’ve told it">
        {data.notes.length === 0 && (
          <Text tone="soft">Nothing yet. A line like “I work night shifts” helps it understand your days.</Text>
        )}
        {data.notes.map(n => (
          <NoteLine key={n.id} note={n} onSave={body => act(updateNote(n.id, body))} onForget={() => act(forgetNote(n.id))} />
        ))}
        {data.notes.length < MAX_NOTES && <NewNote onAdd={body => act(addNote(body))} />}
      </Section>

      <EndMark />
    </Screen>
  );
}

function NoteInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const { colors } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="Something the Mirror should know"
      placeholderTextColor={colors.inkSoft}
      accessibilityLabel={label}
      maxLength={MAX_NOTE_CHARS}
      multiline
      maxFontSizeMultiplier={2}
      style={[styles.input, { color: colors.ink, borderBottomColor: colors.ink }]}
    />
  );
}

function NoteLine({ note, onSave, onForget }: { note: Note; onSave: (body: string) => void; onForget: () => void }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(note.body);

  if (editing) {
    return (
      <View style={styles.item}>
        <NoteInput value={body} onChange={setBody} label="Correct this note" />
        <View style={styles.actions}>
          <Button
            kind="link"
            label="save"
            disabled={!body.trim()}
            onPress={() => {
              onSave(body);
              setEditing(false);
            }}
          />
          <Button
            kind="link"
            label="cancel"
            onPress={() => {
              setBody(note.body);
              setEditing(false);
            }}
          />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.item}>
      <Text variant="heading">{note.body}</Text>
      <View style={styles.actions}>
        <Button kind="link" label="correct it" onPress={() => setEditing(true)} />
        <Button kind="link" label="forget it" onPress={onForget} />
      </View>
    </View>
  );
}

function NewNote({ onAdd }: { onAdd: (body: string) => void }) {
  const [body, setBody] = useState('');
  return (
    <View style={styles.item}>
      <NoteInput value={body} onChange={setBody} label="A new note for the Mirror" />
      <Button
        label="remember this"
        disabled={!body.trim()}
        onPress={() => {
          onAdd(body);
          setBody('');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  item: { gap: space.xs, paddingVertical: space.sm },
  actions: { flexDirection: 'row', gap: space.lg },
  input: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, paddingVertical: space.sm, borderBottomWidth: 1 }
});
