import { Platform } from 'react-native';

import { voiceReadiness } from '../voice';

const mockModule = {
  isRecognitionAvailable: jest.fn(() => true),
  supportsOnDeviceRecognition: jest.fn(() => true),
  getSupportedLocales: jest.fn(async () => ({ locales: ['en-US'], installedLocales: ['en-US'] })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true }))
};
jest.mock('expo-speech-recognition', () => ({ ExpoSpeechRecognitionModule: mockModule }), { virtual: true });
jest.mock('../runtime', () => ({ inExpoGo: false }));
jest.mock('../db/kv', () => ({ kv: { get: jest.fn(), set: jest.fn() } }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'android');
});

test('ready only with on-device recognition, an installed model and the microphone', async () => {
  expect(await voiceReadiness()).toBe('ready');

  mockModule.getSupportedLocales.mockResolvedValueOnce({ locales: ['en-US'], installedLocales: [] });
  expect(await voiceReadiness()).toBe('needs-model');

  mockModule.supportsOnDeviceRecognition.mockReturnValueOnce(false);
  expect(await voiceReadiness()).toBe('unavailable');

  mockModule.requestPermissionsAsync.mockResolvedValueOnce({ granted: false });
  expect(await voiceReadiness()).toBe('no-permission');
});

test('in a browser it uses the browser’s own speech, never the native module', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const w = window as unknown as { webkitSpeechRecognition?: unknown };
  expect(await voiceReadiness()).toBe('unavailable');

  w.webkitSpeechRecognition = function Recognizer() {};
  expect(await voiceReadiness()).toBe('ready');
  delete w.webkitSpeechRecognition;
  expect(mockModule.isRecognitionAvailable).not.toHaveBeenCalled();
});
