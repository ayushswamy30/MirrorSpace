import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import * as sleep from '@/lib/sleep';
import { ThemeProvider } from '@/theme/ThemeProvider';

import Sleep from '@/app/sleep';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ router: { back: () => mockBack() } }));
jest.mock('@/lib/sleep', () => ({ ...jest.requireActual('@/lib/sleep'), allSleep: jest.fn(), saveSleep: jest.fn() }));

const mocked = jest.mocked(sleep);

async function renderSleep() {
  render(
    <ThemeProvider>
      <Sleep />
    </ThemeProvider>
  );
  await act(async () => {});
}

beforeEach(() => {
  jest.clearAllMocks();
  mocked.allSleep.mockResolvedValue([]);
  mocked.saveSleep.mockResolvedValue();
});

test('opens on 23:00 to 07:00, and steps in fifteen minutes', async () => {
  await renderSleep();
  expect(screen.getByLabelText('went to bed 23:00')).toBeTruthy();
  expect(screen.getByText('8h')).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'went to bed, 15 minutes later' }));
  expect(screen.getByLabelText('went to bed 23:15')).toBeTruthy();
  expect(screen.getByText('7h 45m')).toBeTruthy();
});

test('saving stores the night and closes the sheet', async () => {
  await renderSleep();
  fireEvent.press(screen.getByRole('button', { name: 'woke up, 15 minutes earlier' }));
  fireEvent.press(screen.getByRole('button', { name: 'save' }));

  await waitFor(() => expect(mocked.saveSleep).toHaveBeenCalled());
  expect(mocked.saveSleep.mock.calls[0][0].minutes).toBe(7 * 60 + 45);
  expect(mockBack).toHaveBeenCalled();
});

test('opens on the last logged times', async () => {
  mocked.allSleep.mockResolvedValue([sleep.night(0, 6 * 60 + 30, new Date(2026, 8, 20))]);
  await renderSleep();
  expect(screen.getByLabelText('went to bed 00:00')).toBeTruthy();
  expect(screen.getByLabelText('woke up 06:30')).toBeTruthy();
});
