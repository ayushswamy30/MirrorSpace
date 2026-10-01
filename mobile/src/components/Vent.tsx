import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { allCheckIns } from '@/lib/checkIns';
import { composePage, dailyPrompt, TEMPLATES, type PageKind, type Prompt } from '@/lib/prompts';
import { mayReflect, requestReflection, visibleReflection } from '@/lib/reflections';
import { answerConcern } from '@/lib/safety/respond';
import { screenText } from '@/lib/safety/screen';
import { deleteVent, draft, firstLine, keepVent, listVents, type Vent as VentPage } from '@/lib/vents';
import { useEntering } from '@/theme/motion';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/typography';

import { Art } from './Art';
import { Row, SectionLabel, Segmented } from './Blocks';
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
  | { kind: 'done'; kept: boolean; care: boolean; reflecting?: boolean }
  | { kind: 'read'; page: VentPage; confirmDelete: boolean };

const DRAFT_DELAY_MS = 700;

const KINDS = TEMPLATES.map(t => ({ key: t.kind, label: t.label }));
const KIND_LABEL = Object.fromEntries(TEMPLATES.map(t => [t.kind, t.label])) as Record<PageKind, string>;

function pageDate(page: VentPage): string {
  return new Date(page.createdAt).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/** `reflections`: the AI-reflections consent is on; a kept page is sent once for one. */
export function Vent({ reflections = false }: { reflections?: boolean }) {
  const { colors } = useTheme();
  const entering = useEntering();
  const [view, setView] = useState<Stage>({ kind: 'write' });
  const [text, setText] = useState('');
  const [kind, setKind] = useState<PageKind>('page');
  const [lines, setLines] = useState(['', '', '']);
  const [to, setTo] = useState('');
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [pages, setPages] = useState<VentPage[]>([]);
  const template = TEMPLATES.find(t => t.kind === kind)!;
  const composed = composePage(template, { text, lines, to });
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
    allCheckIns()
      .then(checkIns => setPrompt(dailyPrompt(checkIns)))
      .catch(() => setPrompt(dailyPrompt([])));
    refresh();
  }, [refresh]);

  // The draft follows the page, a moment after typing stops.
  useEffect(() => {
    const id = setTimeout(() => {
      draft.set(text).catch(() => undefined);
    }, DRAFT_DELAY_MS);
    return () => clearTimeout(id);
  }, [text]);

  const clear = () => {
    setText('');
    setLines(['', '', '']);
    setTo('');
  };

  const keep = async () => {
    const tier = screenText(composed);
    try {
      const kept = await keepVent(composed, new Date(), kind);
      if (reflections) requestReflection(kept.id, kept.body).then(refresh).catch(() => undefined);
    } catch (err) {
      console.error('Vent save failed:', err);
      setError('That didn’t save. Your words are still here — try again.');
      return;
    }
    clear();
    draft.clear().catch(() => undefined);
    setError(null);
    setView({ kind: 'done', kept: true, care: tier !== 'none', reflecting: reflections && mayReflect(composed) });
    answerConcern(tier, 'vent');
    refresh();
  };

  const letGo = () => {
    const tier = screenText(composed);
    draft.clear().catch(() => undefined);
    clear();
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
        {view.reflecting && (
          <Text variant="bodyItalic">A quiet reflection on it will be here in a few hours.</Text>
        )}
        {view.care && <CareLine />}
        <Button kind="link" label="write another" onPress={() => setView({ kind: 'write' })} />
      </Animated.View>
    );
  }

  if (view.kind === 'read') {
    const { page, confirmDelete } = view;
    const later = visibleReflection({ reflection: page.reflection ?? null, reflectionAt: page.reflectionAt ?? null });
    return (
      <View style={styles.block}>
        <SectionLabel title={pageDate(page)} />
        <Text>{page.body}</Text>
        {later.text && (
          <View style={[styles.sheet, { backgroundColor: colors.tint }]}>
            <Text variant="label" tone="soft">
              hours later
            </Text>
            <Text variant="bodyItalic">{later.text}</Text>
          </View>
        )}
        {later.waitingUntil && (
          <Text variant="mono" tone="soft">
            {`a reflection arrives around ${later.waitingUntil.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
          </Text>
        )}
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

  const empty = composed.length === 0;
  const sheetInput = [styles.input, { color: colors.ink }];

  return (
    <View style={styles.block}>
      <Art name="heart" size={96} style={styles.art} />
      <SectionLabel title="vent" rule={false} />
      <Text variant="reading">Put it down here.</Text>
      <Text tone="soft">No one reads this. Keep it, or let it go when you’re done.</Text>

      <Segmented options={KINDS} value={kind} onChange={setKind} bleed={false} />

      {/* The question the sheet asks: today's prompt, or the template's own. */}
      {kind === 'page' ? (
        prompt && (
          <View style={styles.prompt}>
            <Text variant="bodyItalic">{prompt.text}</Text>
            <Text variant="mono" tone="soft">
              {prompt.because}
            </Text>
          </View>
        )
      ) : (
        <Text variant="bodyItalic">{template.prompt}</Text>
      )}

      <View style={[styles.sheet, { backgroundColor: colors.tint }]}>
        {template.lines ? (
          lines.map((line, i) => (
            <View key={i} style={styles.line}>
              <Text variant="heading">{`${i + 1}.`}</Text>
              <TextInput
                value={line}
                onChangeText={t => setLines(ls => ls.map((l, j) => (j === i ? t : l)))}
                accessibilityLabel={`good thing ${i + 1}`}
                placeholderTextColor={colors.inkSoft}
                maxFontSizeMultiplier={2}
                style={[sheetInput, styles.lineInput]}
              />
            </View>
          ))
        ) : (
          <>
            {template.salutation && (
              <View style={styles.line}>
                <Text variant="heading">Dear</Text>
                <TextInput
                  value={to}
                  onChangeText={setTo}
                  placeholder="whoever it is"
                  placeholderTextColor={colors.inkSoft}
                  accessibilityLabel="who the letter is to"
                  maxFontSizeMultiplier={2}
                  style={[sheetInput, styles.lineInput]}
                />
              </View>
            )}
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={template.placeholder}
              placeholderTextColor={colors.inkSoft}
              accessibilityLabel="vent page"
              multiline
              maxFontSizeMultiplier={2}
              style={sheetInput}
            />
          </>
        )}
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
              subtitle={[
                page.kind && page.kind !== 'page' ? KIND_LABEL[page.kind] : null,
                pageDate(page),
                visibleReflection({ reflection: page.reflection ?? null, reflectionAt: page.reflectionAt ?? null }).text
                  ? 'a reflection is waiting'
                  : null
              ]
                .filter(Boolean)
                .join(' · ')}
              onPress={() => setView({ kind: 'read', page, confirmDelete: false })}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  art: { alignSelf: 'flex-end' },
  block: { gap: space.md },
  sheet: { padding: space.md, gap: space.sm },
  prompt: { gap: space.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  lineInput: { flex: 1, minHeight: 0 },
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
