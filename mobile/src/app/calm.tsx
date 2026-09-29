import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Segmented, Row } from '@/components/Blocks';
import { Button } from '@/components/Button';
import { Breather } from '@/components/calm/Breather';
import { Grounding } from '@/components/calm/Grounding';
import { SubHeader } from '@/components/Header';
import { Icon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { PATTERNS, totalSeconds, type Pattern } from '@/lib/calm/breathing';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Calm tools — breathing and 5-4-3-2-1 grounding. Like help, this must never
 * depend on the session, the network or the database: it opens in every
 * state the app can be in, and it records nothing.
 */

type Tool = 'breathe' | 'ground';

const TOOLS = [
  { key: 'breathe', label: 'breathe' },
  { key: 'ground', label: 'ground' }
] as const;

function minutes(pattern: Pattern): string {
  const m = Math.round(totalSeconds(pattern) / 60);
  return m <= 1 ? 'about a minute' : `about ${m} minutes`;
}

export default function Calm() {
  const { colors } = useTheme();
  const [tool, setTool] = useState<Tool>('breathe');
  const [pattern, setPattern] = useState<Pattern | null>(null);

  return (
    <Screen edges={['top', 'bottom']} header={<SubHeader title="calm" leading="close" />}>
      <Segmented
        options={TOOLS}
        value={tool}
        onChange={key => {
          setTool(key);
          setPattern(null);
        }}
      />

      {tool === 'breathe' &&
        (pattern ? (
          <Breather pattern={pattern} onClose={() => setPattern(null)} />
        ) : (
          <View>
            <Text variant="title">Breathe out for longer than you breathe in.</Text>
            <View style={{ marginTop: space.md }}>
              {PATTERNS.map(p => (
                <Row
                  key={p.key}
                  title={p.name}
                  subtitle={`${p.summary} — ${minutes(p)}`}
                  leading={<Icon name="calm" color={colors.ink} size={22} />}
                  onPress={() => setPattern(p)}
                  accessibilityHint="Starts a guided breathing exercise"
                />
              ))}
            </View>
          </View>
        ))}

      {tool === 'ground' && <Grounding />}

      <Button kind="link" label="need help now" onPress={() => router.replace('/help')} />
    </Screen>
  );
}
