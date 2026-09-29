import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import * as checkIns from '@/lib/checkIns';
import { recordSafetyEvent } from '@/lib/safety/log';
import { ThemeProvider } from '@/theme/ThemeProvider';

import CheckIn from '@/app/(tabs)/check-in';

jest.mock('@/lib/checkIns', () => {
  const actual = jest.requireActual('@/lib/checkIns');
  return {
    ...actual,
    recordCheckIn: jest.fn(),
    changeEmotion: jest.fn(),
    setTags: jest.fn(),
    setNote: jest.fn(),
    latestCheckIn: jest.fn(),
    recentTags: jest.fn()
  };
});

const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useLocalSearchParams: () => mockParams
}));
jest.mock('@/lib/safety/log', () => ({ recordSafetyEvent: jest.fn() }));
jest.mock('@/lib/vents', () => ({
  ...jest.requireActual('@/lib/vents'),
  listVents: jest.fn(() => Promise.resolve([])),
  draft: { get: jest.fn(() => Promise.resolve(null)), set: jest.fn(() => Promise.resolve()), clear: jest.fn() }
}));

const mocked = jest.mocked(checkIns);
const logged = jest.mocked(recordSafetyEvent);

function saved(word: string): checkIns.CheckIn {
  return {
    id: 'c1',
    createdAt: '2026-09-29T10:00:00.000Z',
    localDate: '2026-09-29',
    emotion: word,
    energy: -2,
    pleasantness: 3,
    tags: [],
    note: null
  };
}

async function renderCheckIn() {
  render(
    <ThemeProvider>
      <CheckIn />
    </ThemeProvider>
  );
  // Let the history load settle.
  await act(async () => {});
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mocked.latestCheckIn.mockResolvedValue(null);
  mocked.recentTags.mockResolvedValue([]);
  mocked.recordCheckIn.mockImplementation(async emotion => saved(emotion.word));
  mocked.changeEmotion.mockResolvedValue();
  mocked.setTags.mockResolvedValue();
  mocked.setNote.mockResolvedValue();
  logged.mockResolvedValue();
});

test('one tap on a word is a whole check-in', async () => {
  await renderCheckIn();

  fireEvent.press(screen.getByRole('button', { name: 'peaceful' }));

  await screen.findByText('peaceful.');
  expect(mocked.recordCheckIn).toHaveBeenCalledTimes(1);
  expect(mocked.recordCheckIn.mock.calls[0][0]).toMatchObject({ word: 'peaceful', energy: -5, pleasantness: 2 });
  // Nothing else was needed to save it.
  expect(mocked.setTags).not.toHaveBeenCalled();
  expect(mocked.setNote).not.toHaveBeenCalled();
});

test('a double tap still makes one check-in', async () => {
  await renderCheckIn();

  const calm = screen.getByRole('button', { name: 'peaceful' });
  fireEvent.press(calm);
  fireEvent.press(calm);

  await screen.findByText('peaceful.');
  expect(mocked.recordCheckIn).toHaveBeenCalledTimes(1);
});

test('tags and a note are added to the same check-in', async () => {
  await renderCheckIn();
  fireEvent.press(screen.getByRole('button', { name: 'tired' }));
  await screen.findByText('tired.');

  fireEvent.press(screen.getByRole('checkbox', { name: 'sleep' }));
  fireEvent.press(screen.getByRole('checkbox', { name: 'work' }));
  await waitFor(() => expect(mocked.setTags).toHaveBeenLastCalledWith('c1', ['sleep', 'work']));

  fireEvent.changeText(screen.getByLabelText('note'), 'late night again');
  fireEvent.press(screen.getByRole('button', { name: 'done' }));

  await screen.findByText('Where are you, right now?');
  expect(mocked.setNote).toHaveBeenCalledWith('c1', 'late night again');
  expect(mocked.recordCheckIn).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/last: tired/)).toBeTruthy();
});

test('choosing a different word edits the check-in instead of adding one', async () => {
  await renderCheckIn();
  fireEvent.press(screen.getByRole('button', { name: 'peaceful' }));
  await screen.findByText('peaceful.');

  fireEvent.press(screen.getByRole('button', { name: 'a different word' }));
  await screen.findByText('Which word fits better?');
  fireEvent.press(screen.getByRole('button', { name: 'settled' }));

  await screen.findByText('settled.');
  expect(mocked.recordCheckIn).toHaveBeenCalledTimes(1);
  expect(mocked.changeEmotion).toHaveBeenCalledWith('c1', expect.objectContaining({ word: 'settled' }));
});

test('a failed save says so and records nothing', async () => {
  mocked.recordCheckIn.mockRejectedValueOnce(new Error('disk'));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  await renderCheckIn();

  fireEvent.press(screen.getByRole('button', { name: 'peaceful' }));

  expect(await screen.findByText('That didn’t save. Try the word once more.')).toBeTruthy();
  expect(screen.queryByText('peaceful.')).toBeNull();
});

test('an ordinary check-in logs nothing and interrupts nothing', async () => {
  await renderCheckIn();
  fireEvent.press(screen.getByRole('button', { name: 'peaceful' }));
  await screen.findByText('peaceful.');

  expect(logged).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
  expect(screen.queryByText(/help is one tap away/)).toBeNull();
});

test('a low word leaves the care line, logs once, and does not interrupt', async () => {
  await renderCheckIn();
  fireEvent.press(screen.getByRole('button', { name: 'hopeless' }));
  await screen.findByText('hopeless.');

  expect(screen.getByText(/help is one tap away/)).toBeTruthy();
  expect(logged).toHaveBeenCalledTimes(1);
  expect(logged).toHaveBeenCalledWith('low', 'check_in');
  expect(mockPush).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole('button', { name: 'done' }));
  await screen.findByText('Where are you, right now?');
  // Still there after leaving, in place of the "last" line.
  expect(screen.getByText(/help is one tap away/)).toBeTruthy();
});

test('an acute note opens the crisis card once, however the check-in is edited after', async () => {
  await renderCheckIn();
  fireEvent.press(screen.getByRole('button', { name: 'numb' }));
  await screen.findByText('numb.');

  fireEvent.changeText(screen.getByLabelText('note'), 'I have a plan to end it all');
  fireEvent(screen.getByLabelText('note'), 'blur');

  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/crisis?tier=acute'));
  expect(logged).toHaveBeenCalledWith('acute', 'check_in');
  // The note was saved before anything else happened.
  expect(mocked.setNote).toHaveBeenCalledWith('c1', 'I have a plan to end it all');

  fireEvent.press(screen.getByRole('checkbox', { name: 'alone' }));
  await waitFor(() => expect(mocked.setTags).toHaveBeenCalled());
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(logged).toHaveBeenCalledTimes(1);
});

test('a note that goes from low to elevated is answered at the higher tier', async () => {
  await renderCheckIn();
  fireEvent.press(screen.getByRole('button', { name: 'hopeless' }));
  await screen.findByText('hopeless.');

  fireEvent.changeText(screen.getByLabelText('note'), 'honestly I want to die');
  fireEvent.press(screen.getByRole('button', { name: 'done' }));

  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/crisis?tier=elevated'));
  expect(logged.mock.calls).toEqual([
    ['low', 'check_in'],
    ['elevated', 'check_in']
  ]);
});

test('vent is one tap beside naming a feeling, and Today can open it directly', async () => {
  await renderCheckIn();
  fireEvent.press(screen.getByRole('tab', { name: 'vent' }));
  expect(await screen.findByText('Put it down here.')).toBeTruthy();

  fireEvent.press(screen.getByRole('tab', { name: 'check in' }));
  expect(screen.getByText('Where are you, right now?')).toBeTruthy();
});

test('?mode=vent opens straight onto the page', async () => {
  mockParams = { mode: 'vent' };
  await renderCheckIn();
  expect(screen.getByText('Put it down here.')).toBeTruthy();
});
