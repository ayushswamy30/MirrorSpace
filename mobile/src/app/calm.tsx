import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Art } from '@/components/Art';
import { Segmented, Row } from '@/components/Blocks';
import { Button } from '@/components/Button';
import { Breather } from '@/components/calm/Breather';
import { Grounding } from '@/components/calm/Grounding';
import { Sounds } from '@/components/calm/Sounds';
import { SafetyPlan } from '@/components/SafetyPlan';
import { SubHeader } from '@/components/Header';
import { Icon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { PATTERNS, totalSeconds, type Pattern } from '@/lib/calm/breathing';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Calm tools — breathing, 5-4-3-2-1 grounding, sounds and the safety plan.
 * Like help, this must never depend on the session or the network: it opens
 * in every state the app can be in. Only the plan touches the device's own
 * database; nothing else records anything. The sounds are bundled, so they
 * play offline too.
 */

type Tool = 'breathe' | 'ground' | 'sounds' | 'plan';

const TOOLS = [
  { key: 'breathe', label: 'breathe' },
  { key: 'ground', label: 'ground' },
  { key: 'sounds', label: 'sounds' },
  { key: 'plan', label: 'plan' }
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
    <Screen
      edges={['top', 'bottom']}
      scene="koi"
      header={
        <SubHeader
          title="calm"
          leading="close"
          trailing={
            // Crisis lines: one tap from calm, which is one tap from anywhere.
            <Button
              kind="link"
              label="help"
              accessibilityLabel="Need help now"
              accessibilityHint="Crisis lines you can call or text"
              onPress={() => router.replace('/help')}
            />
          }
        />
      }
    >
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
            <Art name="swan" size={140} style={{ alignSelf: 'flex-end', marginBottom: space.lg }} />
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

      {tool === 'sounds' && <Sounds />}

      {tool === 'plan' && <SafetyPlan />}

    </Screen>
  );
}
