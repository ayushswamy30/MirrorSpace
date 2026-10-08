import { act, render, screen } from '@testing-library/react-native';

import * as checkIns from '@/lib/checkIns';
import { night } from '@/lib/sleep';
import { ThemeProvider } from '@/theme/ThemeProvider';

import Mind from '@/app/mind';

const DAY = 24 * 60 * 60 * 1000;
let mockCreated = new Date(Date.now() - 20 * DAY).toISOString();

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock('@/lib/session', () => ({ useProfile: () => ({ createdAt: mockCreated }) }));
jest.mock('@/lib/db/kv', () => ({ kv: { get: () => Promise.resolve(null), set: () => Promise.resolve() } }));
jest.mock('@/lib/checkIns', () => ({ ...jest.requireActual('@/lib/checkIns'), allCheckIns: jest.fn() }));
jest.mock('@/lib/sleep', () => ({ ...jest.requireActual('@/lib/sleep'), allSleep: jest.fn() }));

const sleep = jest.requireMock('@/lib/sleep') as { allSleep: jest.Mock };

function daysAgo(n: number, pleasantness: number, tags: string[] = []): checkIns.CheckIn {
  const now = new Date();
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() - n, 10, 0);
  return { id: `${n}`, createdAt: at.toISOString(), localDate: checkIns.localDate(at), emotion: 'calm', energy: -1, pleasantness, tags, note: null };
}

async function renderMind() {
  render(
    <ThemeProvider>
      <Mind />
    </ThemeProvider>
  );
  await act(async () => {});
}

beforeEach(() => {
  mockCreated = new Date(Date.now() - 20 * DAY).toISOString();
  jest.mocked(checkIns.allCheckIns).mockResolvedValue([
    ...[1, 2, 3].map(n => daysAgo(n, 4, ['outside'])),
    ...[4, 5, 6].map(n => daysAgo(n, -4, ['work']))
  ]);
  const now = new Date();
  sleep.allSleep.mockResolvedValue(
    [1, 2, 3, 4, 5].map(n => night(23 * 60 + 30, 7 * 60 + 30, new Date(now.getFullYear(), now.getMonth(), now.getDate() - n)))
  );
});

test('draws the placements it has evidence for, and says what the rest still need', async () => {
  await renderMind();

  expect(screen.getByText('Your placements.')).toBeTruthy();
  expect(screen.getByText('In between')).toBeTruthy();
  expect(screen.getByText('outside')).toBeTruthy();
  expect(screen.getByText('work')).toBeTruthy();
  expect(screen.getByText(/Needs .* tagged with people, or “alone”\./)).toBeTruthy();
  expect(screen.getAllByText('not yet').length).toBeGreaterThan(0);
});

test('stays closed before day 14', async () => {
  mockCreated = new Date(Date.now() - 5 * DAY).toISOString();
  await renderMind();
  expect(screen.getByText('Your mind chart, drawn from your own rhythm.')).toBeTruthy();
  expect(screen.queryByText('Your placements.')).toBeNull();
});
