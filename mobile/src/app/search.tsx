import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Row } from '@/components/Blocks';
import { SubHeader } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { search, type Hit } from '@/lib/search';
import { hitTarget, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/typography';

/**
 * Search everything written — pages, notes, the words chosen — on the phone.
 * A result opens Today on its day, where it sits among everything else from
 * then.
 */

const KIND: Record<Hit['kind'], string> = { page: 'a page', note: 'a note', word: 'a check-in' };

export default function Search() {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);

  const searching = query.trim().length >= 2;
  // Too short to search shows nothing — derived, not stored.
  const shown = searching ? hits : null;

  // Searches a moment after typing stops.
  useEffect(() => {
    if (!searching) return;
    let cancelled = false;
    const id = setTimeout(() => {
      search(query)
        .then(found => {
          if (!cancelled) setHits(found);
        })
        .catch(err => console.warn('Search failed:', err));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query, searching]);

  return (
    <Screen edges={['top', 'bottom']} header={<SubHeader title="search" leading="close" />}>
      <View style={styles.block}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="a word, a name, a place…"
          placeholderTextColor={colors.inkSoft}
          accessibilityLabel="Search what you’ve written"
          autoFocus
          autoCorrect={false}
          maxFontSizeMultiplier={2}
          style={[styles.field, { color: colors.ink, borderColor: colors.hairline }]}
        />
        <Text variant="mono" tone="soft">
          Pages, notes and words — searched on this phone, never sent anywhere.
        </Text>
      </View>

      {shown && shown.length === 0 && <Text tone="soft">{`Nothing written with “${query.trim()}” yet.`}</Text>}

      {shown && shown.length > 0 && (
        <View>
          {shown.map(hit => (
            <Row
              key={hit.id}
              title={hit.snippet}
              subtitle={`${KIND[hit.kind]} · ${new Date(hit.createdAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`}
              onPress={() => router.navigate(`/?day=${hit.localDate}`)}
              accessibilityHint="Opens that day"
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  field: { borderWidth: 1, minHeight: hitTarget + 4, paddingHorizontal: space.md, fontFamily: fonts.sans, fontSize: 16 }
});
