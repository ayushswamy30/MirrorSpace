import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { Letters } from '@/components/Letters';
import * as letters from '@/lib/letters';
import { ThemeProvider } from '@/theme/ThemeProvider';

jest.mock('@/lib/letters', () => ({
  ...jest.requireActual('@/lib/letters'),
  listLetters: jest.fn(),
  writeLetter: jest.fn(),
  markOpened: jest.fn(() => Promise.resolve())
}));

const mocked = jest.mocked(letters);
const sealed = { id: 's1', createdAt: '2026-10-02T10:00:00Z', body: 'secret words', deliverAt: '2027-04-02T03:30:00Z', deliveredAt: null, openedAt: null };
const arrived = { id: 'a1', createdAt: '2026-04-02T10:00:00Z', body: 'You made it through spring.', deliverAt: '2026-10-02T03:30:00Z', deliveredAt: '2026-10-02T04:00:00Z', openedAt: null };

async function renderLetters(open?: string) {
  render(
    <ThemeProvider>
      <Letters open={open} />
    </ThemeProvider>
  );
  await act(async () => {});
}

beforeEach(() => {
  jest.clearAllMocks();
  mocked.listLetters.mockResolvedValue([sealed]);
  mocked.writeLetter.mockResolvedValue(sealed);
});

test('a letter is sealed for the chosen wait, and a sealed letter shows only its dates', async () => {
  await renderLetters();
  expect(screen.queryByText('secret words')).toBeNull();
  expect(screen.getByText(/^Opens /)).toBeTruthy();

  fireEvent.changeText(screen.getByLabelText('Your letter'), 'Dear me');
  fireEvent.press(screen.getByRole('tab', { name: 'a year' }));
  fireEvent.press(screen.getByRole('button', { name: 'seal it' }));
  await waitFor(() => expect(mocked.writeLetter).toHaveBeenCalledWith('Dear me', 12));
  expect(screen.getByText('It’s on its way to you.')).toBeTruthy();
});

test('a letter whose day has come opens, and is marked read', async () => {
  mocked.listLetters.mockResolvedValue([arrived]);
  await renderLetters('a1');
  expect(screen.getByText('You made it through spring.')).toBeTruthy();
  expect(mocked.markOpened).toHaveBeenCalledWith('a1');
});
