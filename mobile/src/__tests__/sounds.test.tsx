import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { Sounds } from '@/components/calm/Sounds';
import { ThemeProvider } from '@/theme/ThemeProvider';

const mockPlayer = {
  replace: jest.fn(),
  play: jest.fn(),
  pause: jest.fn(),
  loop: false,
  volume: 1
};

jest.mock('expo-audio', () => ({
  useAudioPlayer: () => mockPlayer,
  setAudioModeAsync: jest.fn(() => Promise.resolve())
}));

function renderSounds() {
  return render(
    <ThemeProvider>
      <Sounds />
    </ThemeProvider>
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockPlayer.loop = false;
  mockPlayer.volume = 1;
});

afterEach(() => jest.useRealTimers());

test('a tap plays the sound on a loop; a second tap pauses it', () => {
  renderSounds();

  fireEvent.press(screen.getByRole('button', { name: /^Gentle Rain/ }));
  expect(mockPlayer.replace).toHaveBeenCalledTimes(1);
  expect(mockPlayer.loop).toBe(true);
  expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Gentle Rain. playing' })).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: /^Gentle Rain/ }));
  expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Gentle Rain. paused' })).toBeTruthy();
});

test('categories switch the list', () => {
  renderSounds();
  fireEvent.press(screen.getByRole('tab', { name: 'cozy' }));
  expect(screen.getByRole('button', { name: /^Fireplace/ })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Gentle Rain/ })).toBeNull();
});

test('the sleep timer fades out and stops', () => {
  renderSounds();
  fireEvent.press(screen.getByRole('button', { name: /^Gentle Rain/ }));
  fireEvent.press(screen.getByRole('button', { name: 'Sleep timer off' }));
  expect(screen.getByRole('button', { name: 'Sleep timer, 15 minutes left' })).toBeTruthy();

  // Five seconds before the end: part-way through the fade.
  act(() => jest.advanceTimersByTime(15 * 60_000 - 5_000));
  expect(mockPlayer.volume).toBeGreaterThan(0);
  expect(mockPlayer.volume).toBeLessThan(1);
  expect(mockPlayer.pause).not.toHaveBeenCalled();

  act(() => jest.advanceTimersByTime(6_000));
  expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
  expect(mockPlayer.volume).toBe(1);
  expect(screen.getByRole('button', { name: 'Sleep timer off' })).toBeTruthy();
});

test('the player line pauses and resumes, and the timer cycles back to off', () => {
  renderSounds();
  expect(screen.queryByRole('button', { name: 'pause' })).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: /^Gentle Rain/ }));
  fireEvent.press(screen.getByRole('button', { name: 'pause' }));
  expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button', { name: 'play' }));
  expect(mockPlayer.play).toHaveBeenCalledTimes(2);

  for (const next of ['15', '30', '60']) {
    fireEvent.press(screen.getByRole('button', { name: /^Sleep timer/ }));
    expect(screen.getByRole('button', { name: `Sleep timer, ${next} minutes left` })).toBeTruthy();
  }
  fireEvent.press(screen.getByRole('button', { name: /^Sleep timer/ }));
  expect(screen.getByRole('button', { name: 'Sleep timer off' })).toBeTruthy();
});
