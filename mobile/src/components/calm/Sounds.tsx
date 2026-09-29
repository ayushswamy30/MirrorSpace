import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Row, Segmented } from '@/components/Blocks';
import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { configure, FADE_MS, fadeVolume, SOUND_CATEGORIES, timerEndsAt, TIMER_CHOICES, type Sound, type TimerChoice } from '@/lib/calm/sounds';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

const TICK_MS = 500;

/**
 * Looping sounds with a sleep timer, kept as spare as the reference: a list
 * of rows, the playing one marked ●, and a single line of text controls under
 * it. Plays with the ringer off and with the screen locked, so it can last
 * the night; the timer fades out over ten seconds rather than cutting off.
 */
export function Sounds() {
  const { colors } = useTheme();
  const player = useAudioPlayer();
  const [category, setCategory] = useState(SOUND_CATEGORIES[0].key);
  const [current, setCurrent] = useState<Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [timer, setTimer] = useState<TimerChoice>(null);
  // When the sleep timer ends, or null for no timer.
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'mixWithOthers'
    }).catch(err => console.warn('Audio mode not set:', err));
  }, []);

  // The sleep timer: fade over the last ten seconds, then stop.
  useEffect(() => {
    if (!playing || endsAt === null) return;
    // Ticks already queued can land after the timer has ended.
    let ended = false;
    const id = setInterval(() => {
      if (ended) return;
      const t = Date.now();
      setNow(t);
      const left = endsAt - t;
      if (left <= 0) {
        ended = true;
        player.pause();
        configure(player, { volume: 1 });
        setEndsAt(null);
        setPlaying(false);
        setTimer(null);
      } else if (left <= FADE_MS) {
        configure(player, { volume: fadeVolume(FADE_MS - left) });
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, endsAt, player]);

  const startTimer = (choice: TimerChoice) => {
    setTimer(choice);
    configure(player, { volume: 1 });
    const ends = timerEndsAt(choice);
    setEndsAt(ends);
    if (ends !== null) setNow(ends - (choice ?? 0) * 60_000);
  };

  const choose = (sound: Sound) => {
    if (current?.key === sound.key) {
      toggle();
      return;
    }
    player.replace(sound.asset);
    configure(player, { loop: true, volume: 1 });
    player.play();
    setCurrent(sound);
    setPlaying(true);
    startTimer(timer);
  };

  const toggle = () => {
    if (playing) {
      player.pause();
      setPlaying(false);
    } else {
      player.play();
      setPlaying(true);
    }
  };

  const cycleTimer = () => {
    const next = TIMER_CHOICES[(TIMER_CHOICES.indexOf(timer) + 1) % TIMER_CHOICES.length];
    startTimer(next);
  };

  const minutesLeft = endsAt === null ? null : Math.max(1, Math.ceil((endsAt - now) / 60_000));
  const sounds = SOUND_CATEGORIES.find(c => c.key === category)?.sounds ?? [];

  return (
    <View style={styles.wrap}>
      <Segmented options={SOUND_CATEGORIES} value={category} onChange={setCategory} />

      <View>
        {sounds.map(sound => {
          const active = current?.key === sound.key;
          return (
            <Row
              key={sound.key}
              title={sound.name}
              subtitle={active ? (playing ? 'playing' : 'paused') : sound.note}
              leading={
                <View
                  style={[
                    styles.bullet,
                    { borderColor: active ? colors.ink : colors.inkSoft },
                    active && playing && { backgroundColor: colors.ink }
                  ]}
                />
              }
              arrow={false}
              selected={active}
              onPress={() => choose(sound)}
              accessibilityHint={active ? (playing ? 'Pauses it' : 'Plays it') : 'Plays it on a loop'}
            />
          );
        })}
      </View>

      {/* The whole player: one line under the list, text only. */}
      {current && (
        <View style={styles.player}>
          <Text variant="label" numberOfLines={1} style={styles.name}>
            {current.name}
          </Text>
          <Button
            kind="link"
            label={minutesLeft === null ? 'timer off' : `${minutesLeft} min`}
            accessibilityLabel={minutesLeft === null ? 'Sleep timer off' : `Sleep timer, ${minutesLeft} minutes left`}
            accessibilityHint="Cycles off, 15, 30 and 60 minutes"
            onPress={cycleTimer}
          />
          <Button kind="link" label={playing ? 'pause' : 'play'} onPress={toggle} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  player: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  name: { flex: 1 },
  bullet: { width: 8, height: 8, borderRadius: radius.dot, borderWidth: 1 }
});
