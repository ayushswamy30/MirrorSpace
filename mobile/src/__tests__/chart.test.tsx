import { act, render, screen } from '@testing-library/react-native';

import * as checkIns from '@/lib/checkIns';
import * as sleep from '@/lib/sleep';
import { ThemeProvider } from '@/theme/ThemeProvider';

import Chart from '@/app/(tabs)/chart';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
let mockCreated = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
jest.mock('@/lib/session', () => ({
  useProfile: () => ({ createdAt: mockCreated }),
  useSession: () => ({ status: 'ready', profile: { createdAt: mockCreated } })
}));
jest.mock('@/lib/checkIns', () => ({
  ...jest.requireActual('@/lib/checkIns'),
  allCheckIns: jest.fn(),
  onCheckInsChanged: () => () => undefined
}));
jest.mock('@/lib/sleep', () => ({
  ...jest.requireActual('@/lib/sleep'),
  allSleep: jest.fn(),
  onSleepChanged: () => () => undefined
}));

function today(pleasantness: number, emotion: string, tags: string[] = []): checkIns.CheckIn {
  const at = new Date();
  return { id: emotion + pleasantness, createdAt: at.toISOString(), localDate: checkIns.localDate(at), emotion, energy: 1, pleasantness, tags, note: null };
}

async function renderChart() {
  render(
    <ThemeProvider>
      <Chart />
    </ThemeProvider>
  );
  await act(async () => {});
}

beforeEach(() => {
  mockCreated = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  jest.mocked(checkIns.allCheckIns).mockResolvedValue([today(3, 'glad', ['friends']), today(4, 'glad')]);
  jest.mocked(sleep.allSleep).mockResolvedValue([]);
});

test('lays out the month, the words and what surrounds the days', async () => {
  await renderChart();

  expect(screen.getByText('The last thirty days.')).toBeTruthy();
  expect(screen.getByLabelText(/^Last 30 days: 1 clear, 0 mild, 0 overcast, 0 fog, 0 storm; 29 without a check-in\./)).toBeTruthy();
  expect(screen.getByText('words you reach for')).toBeTruthy();
  expect(screen.getByText('glad')).toBeTruthy();
  expect(screen.getByText('2×')).toBeTruthy();
  expect(screen.getByText('friends')).toBeTruthy();
  expect(screen.getByText(/No nights logged yet/)).toBeTruthy();
  expect(screen.getByRole('button', { name: /mind chart/i })).toBeTruthy();
});

test('is open on the first day', async () => {
  mockCreated = new Date().toISOString();
  await renderChart();
  expect(screen.getByText('The last thirty days.')).toBeTruthy();
});
