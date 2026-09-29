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
  expect(screen.getByText('now playing')).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: /^Gentle Rain/ }));
  expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
  expect(screen.getByText('paused')).toBeTruthy();
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
  fireEvent.press(screen.getByRole('tab', { name: '15 min' }));
  expect(screen.getByText('stops in 15 min')).toBeTruthy();

  // Five seconds before the end: part-way through the fade.
  act(() => jest.advanceTimersByTime(15 * 60_000 - 5_000));
  expect(mockPlayer.volume).toBeGreaterThan(0);
  expect(mockPlayer.volume).toBeLessThan(1);
  expect(mockPlayer.pause).not.toHaveBeenCalled();

  act(() => jest.advanceTimersByTime(6_000));
  expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
  expect(mockPlayer.volume).toBe(1);
  expect(screen.getByText('paused')).toBeTruthy();
});

test('stop clears the player', () => {
  renderSounds();
  fireEvent.press(screen.getByRole('button', { name: /^Gentle Rain/ }));
  fireEvent.press(screen.getByRole('button', { name: 'stop' }));
  expect(mockPlayer.pause).toHaveBeenCalled();
  expect(screen.getByText('Something to listen to while you settle.')).toBeTruthy();
});
