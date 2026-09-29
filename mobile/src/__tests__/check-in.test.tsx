import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import * as checkIns from '@/lib/checkIns';
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

const mocked = jest.mocked(checkIns);

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
  mocked.latestCheckIn.mockResolvedValue(null);
  mocked.recentTags.mockResolvedValue([]);
  mocked.recordCheckIn.mockImplementation(async emotion => saved(emotion.word));
  mocked.changeEmotion.mockResolvedValue();
  mocked.setTags.mockResolvedValue();
  mocked.setNote.mockResolvedValue();
});

test('one tap on a word is a whole check-in', async () => {
  await renderCheckIn();

  fireEvent.press(screen.getByRole('button', { name: 'calm' }));

  await screen.findByText('calm.');
  expect(mocked.recordCheckIn).toHaveBeenCalledTimes(1);
  expect(mocked.recordCheckIn.mock.calls[0][0]).toMatchObject({ word: 'calm', energy: -3, pleasantness: 3 });
  // Nothing else was needed to save it.
  expect(mocked.setTags).not.toHaveBeenCalled();
  expect(mocked.setNote).not.toHaveBeenCalled();
});

test('a double tap still makes one check-in', async () => {
  await renderCheckIn();

  const calm = screen.getByRole('button', { name: 'calm' });
  fireEvent.press(calm);
  fireEvent.press(calm);

  await screen.findByText('calm.');
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
  fireEvent.press(screen.getByRole('button', { name: 'calm' }));
  await screen.findByText('calm.');

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

  fireEvent.press(screen.getByRole('button', { name: 'calm' }));

  expect(await screen.findByText('That didn’t save. Try the word once more.')).toBeTruthy();
  expect(screen.queryByText('calm.')).toBeNull();
});
