import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Box, Row, Segmented } from '@/components/Blocks';
import { Button } from '@/components/Button';
import { Icon } from '@/components/icons';
import { Text } from '@/components/Text';
import { configure, FADE_MS, fadeVolume, SOUND_CATEGORIES, timerEndsAt, TIMER_CHOICES, type Sound, type TimerChoice } from '@/lib/calm/sounds';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

const TICK_MS = 500;

const timerOptions = TIMER_CHOICES.map(m => ({ key: m === null ? 'off' : String(m), label: m === null ? 'off' : `${m} min` }));

function toChoice(key: string): TimerChoice {
  return key === 'off' ? null : (Number(key) as TimerChoice);
}

/**
 * Looping sounds with a sleep timer. Plays with the ringer off and keeps
 * playing with the screen locked, so it can last the night; the timer fades
 * out over ten seconds rather than cutting off.
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

  const stop = () => {
    player.pause();
    configure(player, { volume: 1 });
    setEndsAt(null);
    setPlaying(false);
    setCurrent(null);
  };

  const minutesLeft = endsAt === null ? null : Math.max(1, Math.ceil((endsAt - now) / 60_000));
  const sounds = SOUND_CATEGORIES.find(c => c.key === category)?.sounds ?? [];

  return (
    <View style={styles.wrap}>
      {current ? (
        <Box title={playing ? 'now playing' : 'paused'}>
          <Text variant="title">{current.name}</Text>
          <Text variant="mono" tone="soft">
            {minutesLeft === null ? current.note : `stops in ${minutesLeft} min`}
          </Text>
          <View style={styles.controls}>
            <Button kind="outline" label={playing ? 'pause' : 'play'} onPress={toggle} />
            <Button kind="link" label="stop" onPress={stop} />
          </View>
          <Text variant="label" tone="soft" style={styles.timerLabel}>
            sleep timer
          </Text>
          <Segmented
            bleed={false}
            options={timerOptions}
            value={timer === null ? 'off' : String(timer)}
            onChange={k => startTimer(toChoice(k))}
          />
        </Box>
      ) : (
        <Text variant="title">Something to listen to while you settle.</Text>
      )}

      <Segmented options={SOUND_CATEGORIES} value={category} onChange={setCategory} />

      <View>
        {sounds.map(sound => {
          const active = current?.key === sound.key;
          return (
            <Row
              key={sound.key}
              title={sound.name}
              subtitle={active ? (playing ? 'playing — tap to pause' : 'paused — tap to play') : sound.note}
              leading={
                active ? (
                  <Icon name="calm" color={colors.ink} size={22} />
                ) : (
                  <View style={[styles.bullet, { borderColor: colors.inkSoft }]} />
                )
              }
              onPress={() => choose(sound)}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  controls: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.sm },
  timerLabel: { marginTop: space.md },
  bullet: { width: 8, height: 8, borderRadius: radius.dot, borderWidth: 1 }
});
