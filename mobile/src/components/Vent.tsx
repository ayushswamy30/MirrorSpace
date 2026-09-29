import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { answerConcern } from '@/lib/safety/respond';
import { screenText } from '@/lib/safety/screen';
import { deleteVent, draft, firstLine, keepVent, listVents, type Vent as VentPage } from '@/lib/vents';
import { useEntering } from '@/theme/motion';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/typography';

import { Row, SectionLabel } from './Blocks';
import { Button } from './Button';
import { CareLine } from './CareLine';
import { Text } from './Text';

/**
 * Vent (report §5, §7): a blank page, then keep it or let it go.
 *
 * Kept pages stay on this phone. Every page is screened like a check-in when
 * it is kept *or* let go — letting something go is not a reason to miss it.
 * Reflections on a page arrive with the AI step, and only with consent.
 */

type Stage =
  | { kind: 'write' }
  | { kind: 'confirm-let-go' }
  | { kind: 'done'; kept: boolean; care: boolean }
  | { kind: 'read'; page: VentPage; confirmDelete: boolean };

const DRAFT_DELAY_MS = 700;

function pageDate(page: VentPage): string {
  return new Date(page.createdAt).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function Vent() {
  const { colors } = useTheme();
  const entering = useEntering();
  const [view, setView] = useState<Stage>({ kind: 'write' });
  const [text, setText] = useState('');
  const [pages, setPages] = useState<VentPage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listVents()
      .then(setPages)
      .catch(err => console.warn('Vent pages unavailable:', err));
  }, []);

  useEffect(() => {
    draft
      .get()
      .then(saved => {
        if (saved) setText(t => t || saved);
      })
      .catch(() => undefined);
    refresh();
  }, [refresh]);

  // The draft follows the page, a moment after typing stops.
  useEffect(() => {
    const id = setTimeout(() => {
      draft.set(text).catch(() => undefined);
    }, DRAFT_DELAY_MS);
    return () => clearTimeout(id);
  }, [text]);

  const keep = async () => {
    const tier = screenText(text);
    try {
      await keepVent(text);
    } catch (err) {
      console.error('Vent save failed:', err);
      setError('That didn’t save. Your words are still here — try again.');
      return;
    }
    setText('');
    setError(null);
    setView({ kind: 'done', kept: true, care: tier !== 'none' });
    answerConcern(tier, 'vent');
    refresh();
  };

  const letGo = () => {
    const tier = screenText(text);
    draft.clear().catch(() => undefined);
    setText('');
    setView({ kind: 'done', kept: false, care: tier !== 'none' });
    answerConcern(tier, 'vent');
  };

  if (view.kind === 'done') {
    return (
      <Animated.View entering={entering} style={styles.block}>
        <SectionLabel title={view.kept ? 'kept' : 'let go'} rule={false} />
        <Text variant="reading">{view.kept ? 'It’s kept.' : 'Let go.'}</Text>
        <Text tone="soft">
          {view.kept ? 'On this phone, and nowhere else.' : 'Nothing was saved, anywhere.'}
        </Text>
        {view.care && <CareLine />}
        <Button kind="link" label="write another" onPress={() => setView({ kind: 'write' })} />
      </Animated.View>
    );
  }

  if (view.kind === 'read') {
    const { page, confirmDelete } = view;
    return (
      <View style={styles.block}>
        <SectionLabel title={pageDate(page)} />
        <Text>{page.body}</Text>
        {confirmDelete ? (
          <View style={styles.block}>
            <Text tone="soft">Delete this page? It can’t be brought back.</Text>
            <View style={styles.actions}>
              <Button
                kind="outline"
                label="delete"
                onPress={async () => {
                  await deleteVent(page.id).catch(err => console.error('Delete failed:', err));
                  refresh();
                  setView({ kind: 'write' });
                }}
              />
              <Button kind="link" label="keep it" onPress={() => setView({ ...view, confirmDelete: false })} />
            </View>
          </View>
        ) : (
          <View style={styles.actions}>
            <Button kind="link" label="back" onPress={() => setView({ kind: 'write' })} />
            <Button kind="link" label="delete this page" onPress={() => setView({ ...view, confirmDelete: true })} />
          </View>
        )}
      </View>
    );
  }

  const empty = text.trim().length === 0;

  return (
    <View style={styles.block}>
      <SectionLabel title="vent" rule={false} />
      <Text variant="reading">Put it down here.</Text>
      <Text tone="soft">No one reads this. Keep it, or let it go when you’re done.</Text>

      <View style={[styles.sheet, { backgroundColor: colors.tint }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="start anywhere"
          placeholderTextColor={colors.inkSoft}
          accessibilityLabel="vent page"
          multiline
          maxFontSizeMultiplier={2}
          style={[styles.input, { color: colors.ink }]}
        />
      </View>

      {error && (
        <Text variant="bodyItalic" accessibilityRole="alert">
          {error}
        </Text>
      )}

      {view.kind === 'confirm-let-go' ? (
        <View style={styles.block}>
          <Text tone="soft">Let it go? It won’t be saved anywhere.</Text>
          <View style={styles.actions}>
            <Button kind="outline" label="let go" onPress={letGo} />
            <Button kind="link" label="keep writing" onPress={() => setView({ kind: 'write' })} />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <Button label="keep" arrow disabled={empty} onPress={keep} />
          <Button kind="link" label="let go" disabled={empty} onPress={() => setView({ kind: 'confirm-let-go' })} />
        </View>
      )}

      {pages.length > 0 && (
        <View style={styles.pages}>
          <SectionLabel title="kept pages" />
          {pages.map(page => (
            <Row
              key={page.id}
              title={firstLine(page.body)}
              subtitle={pageDate(page)}
              onPress={() => setView({ kind: 'read', page, confirmDelete: false })}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md },
  sheet: { padding: space.md },
  input: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 23,
    minHeight: 220,
    padding: 0,
    textAlignVertical: 'top'
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  pages: { marginTop: space.lg }
});
