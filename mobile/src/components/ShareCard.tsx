import * as Sharing from 'expo-sharing';
import { useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import Svg, { Circle } from 'react-native-svg';

import { WEATHER_INK, type ChartDay } from '@/lib/chart';
import type { Reading } from '@/lib/patterns';
import { light, radius, space } from '@/theme/tokens';
import type { Weather } from '@/theme/tokens';

import { Art, type ArtName } from './Art';
import { Button } from './Button';
import { Text } from './Text';

/**
 * Shareable cards (report: "story-sized reading and chart cards"): a 9:16
 * page in the app's print style, rendered off screen at 1080×1920 and handed
 * to the phone's share sheet. Always light paper, whatever the theme — it's
 * a printed thing. Only what the person chooses to share: the reading, or
 * the month's weather; never their words.
 */

const W = 360;
const H = 640;
const ink = light.ink;
const soft = light.inkSoft;

function Card({ children }: { children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text variant="label" style={{ color: ink }}>
        lowkei
      </Text>
      {children}
      <Text variant="mono" style={[styles.foot, { color: soft }]}>
        a quiet room, not a clinic
      </Text>
    </View>
  );
}

export function ReadingCard({ reading, art, date }: { reading: Reading; art: ArtName; date: string }) {
  return (
    <Card>
      <View style={styles.disc}>
        <Art name={art} size={74} scheme="light" />
      </View>
      <View style={styles.body}>
        <Text variant="label" style={{ color: soft }}>{`my day at a glance · ${date}`}</Text>
        <Text variant="reading" style={{ color: ink }}>
          {reading.headline}
        </Text>
        <View style={styles.cols}>
          {[
            { title: 'Do', items: reading.dos },
            { title: 'Don’t', items: reading.donts }
          ].map(col => (
            <View key={col.title} style={styles.col}>
              <Text variant="mono" style={{ color: soft }}>
                {col.title}
              </Text>
              {col.items.map(item => (
                <Text key={item} variant="heading" style={{ color: ink }}>
                  {item}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}

export function MonthCard({ days, mostly }: { days: ChartDay[]; mostly: Weather | null }) {
  const size = 260;
  const mid = size / 2;
  const ring = mid - 18;
  return (
    <Card>
      <View style={styles.body}>
        <Text variant="label" style={{ color: soft }}>
          my last thirty days
        </Text>
        <Text variant="reading" style={{ color: ink }}>
          {mostly ? `Mostly ${mostly}.` : 'A quiet month.'}
        </Text>
        <View style={styles.wheel}>
          <Svg width={size} height={size}>
            <Circle cx={mid} cy={mid} r={ring + 12} stroke={ink} strokeWidth={0.5} fill="none" />
            {days.map((d, i) => {
              const a = ((i + 0.5) / days.length) * Math.PI * 2 - Math.PI / 2;
              const x = mid + ring * Math.cos(a);
              const y = mid + ring * Math.sin(a);
              return d.weather ? (
                <Circle key={d.date} cx={x} cy={y} r={7} stroke={ink} strokeWidth={1} fill={ink} fillOpacity={WEATHER_INK[d.weather]} />
              ) : (
                <Circle key={d.date} cx={x} cy={y} r={1.5} fill={soft} />
              );
            })}
          </Svg>
        </View>
      </View>
    </Card>
  );
}

/**
 * A "share" link that renders its card off screen, captures it and opens
 * the share sheet. In the browser preview it explains instead.
 */
export function ShareButton({ label, card }: { label: string; card: ReactNode }) {
  const ref = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const share = async () => {
    setNote(null);
    if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) {
      setNote('Sharing works from the phone app.');
      return;
    }
    setBusy(true);
    try {
      const uri = await captureRef(ref, { format: 'png', quality: 1, width: W * 3, height: H * 3 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share' });
    } catch (err) {
      console.warn('Card not shared:', err);
      setNote('That card didn’t come out. Try once more.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Button kind="link" label={busy ? 'making the card…' : label} disabled={busy} onPress={share} />
      {note && (
        <Text variant="mono" tone="soft">
          {note}
        </Text>
      )}
      {/* Off screen, but laid out, so it can be captured. */}
      <View style={styles.offscreen} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View ref={ref} collapsable={false}>
          {card}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: W,
    height: H,
    backgroundColor: light.paper,
    padding: space.lg,
    justifyContent: 'space-between'
  },
  disc: {
    alignSelf: 'flex-end',
    width: 104,
    height: 104,
    borderRadius: radius.dot,
    backgroundColor: light.disc,
    alignItems: 'center',
    justifyContent: 'center'
  },
  body: { gap: space.md },
  cols: { flexDirection: 'row', gap: space.lg, marginTop: space.sm },
  col: { flex: 1, gap: 2 },
  wheel: { alignItems: 'center', marginTop: space.md },
  foot: { textAlign: 'center' },
  offscreen: { position: 'absolute', left: -10000, top: 0 }
});
