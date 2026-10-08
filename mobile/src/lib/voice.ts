import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type * as SpeechModule from 'expo-speech';
import type * as RecognitionModule from 'expo-speech-recognition';

import { kv } from './db/kv';
import { inExpoGo } from './runtime';

/**
 * Voice in the Mirror (report: "voice mode on Mirror chat"; "on-device
 * transcription; audio discarded by default"). Speaking fills the ask box
 * with words, recognised on the phone itself — the recogniser is told never
 * to send audio anywhere, and nothing is recorded or kept. The words are
 * then sent like typed ones, after the same safety screening. Answers can
 * be read aloud by the phone's own voice.
 *
 * Needs Lowkei's own build: neither module is in Expo Go.
 */

export const LANG = 'en-US';
const READ_ALOUD = 'mirror.voice.read';

export type VoiceReadiness = 'ready' | 'needs-model' | 'no-permission' | 'unavailable' | 'needs-app-build';

export function voicePlatform(): 'needs-app-build' | null {
  return Platform.OS === 'web' || inExpoGo ? 'needs-app-build' : null;
}

function recognition(): typeof RecognitionModule | null {
  if (voicePlatform()) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-speech-recognition') as typeof RecognitionModule;
}

function speech(): typeof SpeechModule | null {
  if (voicePlatform()) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-speech') as typeof SpeechModule;
}

/** Whether speaking can start now — on the phone only, with permission. */
export async function voiceReadiness(): Promise<VoiceReadiness> {
  const R = recognition();
  if (!R) return 'needs-app-build';
  const M = R.ExpoSpeechRecognitionModule;
  if (!M.isRecognitionAvailable() || !M.supportsOnDeviceRecognition()) return 'unavailable';
  if (Platform.OS === 'android') {
    const { installedLocales } = await M.getSupportedLocales({}).catch(() => ({ installedLocales: [] as string[] }));
    if (!installedLocales.some(l => l.toLowerCase().startsWith('en'))) return 'needs-model';
  }
  const permission = await M.requestPermissionsAsync();
  return permission.granted ? 'ready' : 'no-permission';
}

/** Asks Android to download its on-device English model. */
export async function downloadVoiceModel(): Promise<boolean> {
  const R = recognition();
  if (!R) return false;
  const result = await R.ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ locale: LANG }).catch(() => null);
  return result !== null;
}

/**
 * Listening, as a hook: start, stop, and the words so far. The final words
 * are handed to `onWords`; nothing else is kept.
 */
export function useListening(onWords: (words: string) => void): {
  listening: boolean;
  partial: string;
  start: () => void;
  stop: () => void;
  error: string | null;
} {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const handler = useRef(onWords);
  useEffect(() => {
    handler.current = onWords;
  }, [onWords]);

  useEffect(() => {
    const R = recognition();
    if (!R) return;
    const M = R.ExpoSpeechRecognitionModule;
    const subs = [
      M.addListener('start', () => {
        setListening(true);
        setError(null);
      }),
      M.addListener('end', () => {
        setListening(false);
        setPartial('');
      }),
      M.addListener('result', event => {
        const words = event.results[0]?.transcript ?? '';
        if (event.isFinal) {
          setPartial('');
          if (words.trim()) handler.current(words.trim());
        } else setPartial(words);
      }),
      M.addListener('error', event => {
        setListening(false);
        setError(event.error === 'no-speech' ? 'Didn’t catch anything. Try again when you’re ready.' : 'Voice stopped. You can type instead.');
      })
    ];
    return () => {
      for (const s of subs) s.remove();
      M.abort();
    };
  }, []);

  const start = useCallback(() => {
    const R = recognition();
    if (!R) return;
    R.ExpoSpeechRecognitionModule.start({
      lang: LANG,
      interimResults: true,
      maxAlternatives: 1,
      continuous: false,
      // Never send audio off the phone; never keep it.
      requiresOnDeviceRecognition: true,
      addsPunctuation: true,
      recordingOptions: { persist: false }
    });
  }, []);

  const stop = useCallback(() => {
    recognition()?.ExpoSpeechRecognitionModule.stop();
  }, []);

  return { listening, partial, start, stop, error };
}

// ---------------------------------------------------------------------------
// Reading answers aloud

export async function readAloudOn(): Promise<boolean> {
  return (await kv.get(READ_ALOUD)) === '1';
}

export async function setReadAloud(on: boolean): Promise<void> {
  await kv.set(READ_ALOUD, on ? '1' : '0');
  if (!on) speech()?.stop();
}

/** In the phone's own voice, a little slower than default — the room is quiet. */
export function speak(text: string): void {
  const S = speech();
  if (!S) return;
  S.stop();
  S.speak(text, { language: LANG, rate: 0.92 });
}

export function stopSpeaking(): void {
  speech()?.stop();
}
