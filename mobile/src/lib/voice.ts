import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type * as SpeechModule from 'expo-speech';
import type * as RecognitionModule from 'expo-speech-recognition';

import { kv } from './db/kv';
import { inExpoGo } from './runtime';

/**
 * Voice in the Mirror (report: "voice mode on Mirror chat"; "on-device
 * transcription; audio discarded by default"). Speaking fills the ask box
 * with words; nothing is recorded or kept, and the words are then sent like
 * typed ones, after the same safety screening. Answers can be read aloud.
 *
 * - In Lowkei's own phone build, the recogniser is told never to send audio
 *   anywhere: it works on the phone itself or not at all.
 * - In the web app, the browser does the listening (the Web Speech API). On
 *   iPhone that is Apple's own dictation — the same as the keyboard's mic —
 *   which may use Apple's servers; Lowkei never receives the audio. The Mirror
 *   says so the first time. Answers are read with the browser's voice.
 * - Expo Go has neither module.
 */

export const LANG = 'en-US';
const READ_ALOUD = 'mirror.voice.read';

export type VoiceReadiness = 'ready' | 'needs-model' | 'no-permission' | 'unavailable' | 'needs-app-build';

const onWeb = (): boolean => Platform.OS === 'web';

export function voicePlatform(): 'needs-app-build' | null {
  return !onWeb() && inExpoGo ? 'needs-app-build' : null;
}

function recognition(): typeof RecognitionModule | null {
  if (onWeb() || voicePlatform()) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-speech-recognition') as typeof RecognitionModule;
}

function speech(): typeof SpeechModule | null {
  if (onWeb() || voicePlatform()) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-speech') as typeof SpeechModule;
}

// ---------------------------------------------------------------------------
// The browser's own speech

type WebResult = { isFinal: boolean; 0: { transcript: string } };
type WebRecognizer = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: { resultIndex: number; results: ArrayLike<WebResult> }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function webRecognizer(): (new () => WebRecognizer) | null {
  if (!onWeb() || typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => WebRecognizer; webkitSpeechRecognition?: new () => WebRecognizer };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function webSpeech(): SpeechSynthesis | null {
  return onWeb() && typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}

/** On the web, who turns speech into words — said once, the first time. */
export const WEB_VOICE_NOTE =
  'Your browser turns your voice into words — on iPhone, Apple’s dictation, the same as the keyboard mic. Lowkei never gets the audio.';

/** Whether speaking can start now. */
export async function voiceReadiness(): Promise<VoiceReadiness> {
  if (onWeb()) return webRecognizer() ? 'ready' : 'unavailable';
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

function webError(code: string): string {
  if (code === 'no-speech') return 'Didn’t catch anything. Try again when you’re ready.';
  if (code === 'not-allowed' || code === 'service-not-allowed') {
    return 'Voice needs the microphone. Allow it when your phone asks — or use the keyboard’s mic instead.';
  }
  if (code === 'network') return 'Voice needs a connection here. You can type instead.';
  if (code === 'aborted') return '';
  return 'Voice stopped. You can type instead.';
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
  const web = useRef<WebRecognizer | null>(null);
  useEffect(() => {
    handler.current = onWords;
  }, [onWords]);

  useEffect(() => {
    if (onWeb()) return () => web.current?.abort();
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

  const startWeb = useCallback(() => {
    const Recognizer = webRecognizer();
    if (!Recognizer) return;
    web.current?.abort();
    const r = new Recognizer();
    r.lang = LANG;
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    r.onstart = () => {
      setListening(true);
      setError(null);
    };
    r.onend = () => {
      setListening(false);
      setPartial('');
      if (web.current === r) web.current = null;
    };
    r.onerror = event => {
      setListening(false);
      setError(webError(event.error) || null);
    };
    r.onresult = event => {
      let final = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }
      setPartial(interim);
      if (final.trim()) handler.current(final.trim());
    };
    web.current = r;
    try {
      r.start();
    } catch {
      setError('Voice couldn’t start. You can type instead — or use the keyboard’s mic.');
    }
  }, []);

  const start = useCallback(() => {
    if (onWeb()) return startWeb();
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
  }, [startWeb]);

  const stop = useCallback(() => {
    if (onWeb()) return web.current?.stop();
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
  if (!on) stopSpeaking();
}

/**
 * iPhone's browser only lets a page speak once it has spoken in answer to a
 * tap. Called from a tap (switching reading aloud on, sending), it says
 * nothing — and the answer that comes later may then be read.
 */
export function primeSpeech(): void {
  const S = webSpeech();
  if (!S) return;
  const silence = new SpeechSynthesisUtterance('');
  silence.volume = 0;
  S.speak(silence);
}

/** In the phone's own voice, a little slower than default — the room is quiet. */
export function speak(text: string): void {
  const W = webSpeech();
  if (W) {
    W.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANG;
    utterance.rate = 0.92;
    W.speak(utterance);
    return;
  }
  const S = speech();
  if (!S) return;
  S.stop();
  S.speak(text, { language: LANG, rate: 0.92 });
}

export function stopSpeaking(): void {
  const W = webSpeech();
  if (W) {
    W.cancel();
    return;
  }
  speech()?.stop();
}
