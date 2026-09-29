import { act, fireEvent, render, screen } from '@testing-library/react-native';

import * as checkIns from '@/lib/checkIns';
import { ThemeProvider } from '@/theme/ThemeProvider';

import Today from '@/app/(tabs)/index';

const mockNavigate = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { navigate: (...a: unknown[]) => mockNavigate(...a), push: (...a: unknown[]) => mockPush(...a) }
}));
const mockAllSleep = jest.fn();
jest.mock('@/lib/sleep', () => ({
  ...jest.requireActual('@/lib/sleep'),
  allSleep: () => mockAllSleep(),
  onSleepChanged: () => () => undefined
}));
jest.mock('@/lib/checkIns', () => ({
  ...jest.requireActual('@/lib/checkIns'),
  allCheckIns: jest.fn(),
  onCheckInsChanged: jest.fn(() => () => undefined)
}));

let mockReadings = true;
jest.mock('@/lib/session', () => ({
  useProfile: () => ({ consents: { readings: { granted: mockReadings } } })
}));

const mocked = jest.mocked(checkIns);

function checkIn(hoursAgo: number, energy: number, pleasantness: number): checkIns.CheckIn {
  const at = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  return {
    id: `c${hoursAgo}`,
    createdAt: at.toISOString(),
    localDate: checkIns.localDate(at),
    emotion: 'drained',
    energy,
    pleasantness,
    tags: [],
    note: null
  };
}

async function renderToday() {
  render(
    <ThemeProvider>
      <Today />
    </ThemeProvider>
  );
  await act(async () => {});
}

beforeEach(() => {
  jest.clearAllMocks();
  mockReadings = true;
  mockAllSleep.mockResolvedValue([]);
});

test('last night can be logged from Today, and shows once it is', async () => {
  mocked.allCheckIns.mockResolvedValue([]);
  await renderToday();
  fireEvent.press(screen.getByRole('button', { name: /^How did you sleep\?/ }));
  expect(mockPush).toHaveBeenCalledWith('/sleep');

  const { night } = jest.requireActual('@/lib/sleep');
  mockAllSleep.mockResolvedValue([night(23 * 60 + 30, 7 * 60, new Date())]);
  await renderToday();
  expect(screen.getByText('7h 30m')).toBeTruthy();
  expect(screen.getByText('23:30 – 07:00')).toBeTruthy();
});

test('with no check-ins: a general reading and a way to start', async () => {
  mocked.allCheckIns.mockResolvedValue([]);
  await renderToday();

  expect(screen.getByText('Notice one thing today.')).toBeTruthy();
  expect(screen.queryByText('inner weather')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'check in' }));
  expect(mockNavigate).toHaveBeenCalledWith('/check-in');
});

test('a low, heavy few days read as fog, with the facts behind it', async () => {
  // The newest is "now", so it's today whatever time the suite runs.
  mocked.allCheckIns.mockResolvedValue([checkIn(30, -4, -4), checkIn(20, -3, -3), checkIn(0, -4, -3)]);
  await renderToday();

  expect(screen.getByText('Small steps count.')).toBeTruthy();
  expect(screen.getByText('fog')).toBeTruthy();
  expect(screen.getByText('behind this reading')).toBeTruthy();
  expect(screen.getByText(/low on energy/)).toBeTruthy();
  expect(screen.getByLabelText(/^Do: /)).toBeTruthy();
  // Checked in today already: no nudge.
  expect(screen.queryByRole('button', { name: 'check in' })).toBeNull();
});

test('readings consent off: the same check-ins give the general reading', async () => {
  mockReadings = false;
  mocked.allCheckIns.mockResolvedValue([checkIn(30, -4, -4), checkIn(20, -3, -3), checkIn(0, -4, -3)]);
  await renderToday();

  expect(screen.getByText('Notice one thing today.')).toBeTruthy();
  expect(screen.queryByText('fog')).toBeNull();
});

test('the page ends, with a way to write something down', async () => {
  mocked.allCheckIns.mockResolvedValue([]);
  await renderToday();

  expect(screen.getByText('The end')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'write something down' }));
  expect(mockNavigate).toHaveBeenCalledWith('/check-in?mode=vent');
});
