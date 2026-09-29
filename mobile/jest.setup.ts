// Values the config module requires at import time. Tests never reach a real
// Supabase project or API.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
process.env.EXPO_PUBLIC_API_URL = 'https://api.test/api';

// expo-audio is a native module; tests that care about playback mock it
// themselves, everything else just needs it to load.
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({ replace: jest.fn(), play: jest.fn(), pause: jest.fn(), loop: false, volume: 1 }),
  setAudioModeAsync: jest.fn(() => Promise.resolve())
}));

// Reanimated 4 runs animations on a worklets runtime that doesn't exist in
// Jest; both libraries ship mocks for exactly this.
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  // Not in the shipped mock; the app's motion helpers depend on it.
  useReducedMotion: () => false
}));
