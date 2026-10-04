import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { deliveryDate, listLetters, markOpened, writeLetter, type Letter, type Wait } from '@/lib/letters';
import { useEntering } from '@/theme/motion';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/typography';

import { Art } from './Art';
import { Lede, Row, Section, Segmented } from './Blocks';
import { Button } from './Button';
import { Text } from './Text';

/**
 * Letters to future self: write now, sealed for three months, six, or a
 * year. Sealed letters show only their dates. An opened letter reads like a
 * page from someone you used to be.
 */

const WAITS = [
  { key: '3', label: '3 months' },
  { key: '6', label: '6 months' },
  { key: '12', label: 'a year' }
] as const;

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
}

export function Letters({ open }: { /** Opens this letter straight away (from Today). */ open?: string }) {
  const { colors } = useTheme();
  const enter = useEntering();
  const [letters, setLetters] = useState<Letter[]>([]);
  const [body, setBody] = useState('');
  const [wait, setWait] = useState<'3' | '6' | '12'>('6');
  const [sealed, setSealed] = useState<Letter | null>(null);
  const [reading, setReading] = useState<Letter | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listLetters()
      .then(all => {
        setLetters(all);
        const asked = open ? all.find(l => l.id === open && l.deliveredAt) : null;
        if (asked) {
          setReading(asked);
          markOpened(asked.id).catch(() => undefined);
        }
      })
      .catch(err => console.warn('Letters unavailable:', err));
  }, [open]);

  useEffect(refresh, [refresh]);

  const seal = async () => {
    setError(null);
    try {
      const letter = await writeLetter(body, Number(wait) as Wait);
      setBody('');
      setSealed(letter);
      refresh();
    } catch (err) {
      console.error('Letter not sealed:', err);
      setError('That didn’t seal. Your words are still here.');
    }
  };

  if (reading) {
    return (
      <Animated.View entering={enter} style={styles.block}>
        <Art name="stamp" size={84} style={styles.art} />
        <Lede label={`written ${longDate(reading.createdAt)}`} title="A letter from you." size="title" />
        <View style={[styles.sheet, { backgroundColor: colors.tint }]}>
          <Text variant="bodyItalic">{reading.body}</Text>
        </View>
        <Button kind="link" label="back to letters" onPress={() => setReading(null)} />
      </Animated.View>
    );
  }

  if (sealed) {
    return (
      <Animated.View entering={enter} style={styles.block}>
        <Art name="stamp" size={84} style={styles.art} />
        <Lede label="sealed" title="It’s on its way to you." size="title">
          <Text tone="soft">
            {`It opens on ${longDate(sealed.deliverAt)}. If that day is a heavy one, it waits a little longer — it should arrive on a day you can read it.`}
          </Text>
        </Lede>
        <Button kind="link" label="write another" onPress={() => setSealed(null)} />
      </Animated.View>
    );
  }

  const waiting = letters.filter(l => !l.deliveredAt);
  const arrived = letters.filter(l => l.deliveredAt).reverse();

  return (
    <View style={styles.block}>
      <Art name="stamp" size={84} style={styles.art} />
      <Lede label="letters" title="A letter to future you.">
        <Text tone="soft">Sealed on this phone until its day. No one else reads it — including you, until then.</Text>
      </Lede>

      <View style={[styles.sheet, { backgroundColor: colors.tint }]}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Dear me, by the time you read this…"
          placeholderTextColor={colors.inkSoft}
          accessibilityLabel="Your letter"
          multiline
          maxFontSizeMultiplier={2}
          style={[styles.input, { color: colors.ink }]}
        />
      </View>

      <Text variant="mono" tone="soft">
        open it in
      </Text>
      <Segmented options={WAITS} value={wait} onChange={setWait} bleed={false} />
      <Text variant="caption" tone="soft">{`on ${longDate(deliveryDate(Number(wait) as Wait).toISOString())}`}</Text>

      {error && (
        <Text variant="bodyItalic" accessibilityRole="alert">
          {error}
        </Text>
      )}
      <Button label="seal it" arrow disabled={!body.trim()} onPress={seal} />

      {arrived.length > 0 && (
        <Section title="opened">
          {arrived.map(l => (
            <Row
              key={l.id}
              title={`Written ${longDate(l.createdAt)}`}
              subtitle={l.openedAt ? 'read' : 'not read yet'}
              onPress={() => {
                setReading(l);
                markOpened(l.id).catch(() => undefined);
              }}
            />
          ))}
        </Section>
      )}

      {waiting.length > 0 && (
        <Section title="sealed">
          {waiting.map(l => (
            <Row key={l.id} title={`Opens ${longDate(l.deliverAt)}`} subtitle={`written ${longDate(l.createdAt)}`} arrow={false} />
          ))}
        </Section>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  art: { alignSelf: 'flex-end' },
  block: { gap: space.md },
  sheet: { padding: space.md },
  input: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, minHeight: 200, padding: 0, textAlignVertical: 'top' }
});
