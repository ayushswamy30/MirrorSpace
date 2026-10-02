import { act, render, screen } from '@testing-library/react-native';

import * as checkIns from '@/lib/checkIns';
import { ThemeProvider } from '@/theme/ThemeProvider';

import Week from '@/app/week';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock('@/lib/checkIns', () => ({ ...jest.requireActual('@/lib/checkIns'), allCheckIns: jest.fn() }));
jest.mock('@/lib/sleep', () => ({ ...jest.requireActual('@/lib/sleep'), allSleep: () => Promise.resolve([]) }));

function today(pleasantness: number, emotion: string): checkIns.CheckIn {
  const at = new Date();
  return { id: emotion, createdAt: at.toISOString(), localDate: checkIns.localDate(at), emotion, energy: 1, pleasantness, tags: [], note: null };
}

test('the week is laid out, with quiet days counted kindly', async () => {
  jest.mocked(checkIns.allCheckIns).mockResolvedValue([today(4, 'glad')]);
  render(
    <ThemeProvider>
      <Week />
    </ThemeProvider>
  );
  await act(async () => {});

  expect(screen.getByText('The week, laid out.')).toBeTruthy();
  expect(screen.getByText('1 day with a word · 6 quiet days')).toBeTruthy();
  expect(screen.getByText('glad')).toBeTruthy();
  expect(screen.getByText('No nights logged this week.')).toBeTruthy();
});
