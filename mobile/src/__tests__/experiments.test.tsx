import { act, fireEvent, render, screen } from '@testing-library/react-native';

import * as experiments from '@/lib/experiments';
import { localDate } from '@/lib/checkIns';
import { ThemeProvider } from '@/theme/ThemeProvider';

import Experiments from '@/app/experiments';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock('@/lib/checkIns', () => ({ ...jest.requireActual('@/lib/checkIns'), allCheckIns: () => Promise.resolve([]) }));
jest.mock('@/lib/sleep', () => ({ ...jest.requireActual('@/lib/sleep'), allSleep: () => Promise.resolve([]) }));
jest.mock('@/lib/experiments', () => ({
  ...jest.requireActual('@/lib/experiments'),
  listExperiments: jest.fn(),
  startExperiment: jest.fn(() => Promise.resolve()),
  setKept: jest.fn(() => Promise.resolve())
}));

const mocked = jest.mocked(experiments);

async function renderPage() {
  render(
    <ThemeProvider>
      <Experiments />
    </ThemeProvider>
  );
  await act(async () => {});
}

test('with nothing running, a preset starts a week of it', async () => {
  mocked.listExperiments.mockResolvedValue([]);
  await renderPage();
  expect(screen.getByText('Try one small change for a week.')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByRole('button', { name: /^No phone after 22:00/ })));
  expect(mocked.startExperiment).toHaveBeenCalledWith('No phone after 22:00');
});

test('a running experiment shows its day and can be marked kept', async () => {
  const today = localDate(new Date());
  const end = new Date();
  end.setDate(end.getDate() + 6);
  const running = { id: 'e', title: 'A walk after lunch', startsOn: today, endsOn: localDate(end), kept: [], stoppedOn: null };
  mocked.listExperiments.mockResolvedValue([running]);
  await renderPage();
  expect(screen.getByText('A walk after lunch')).toBeTruthy();
  expect(screen.getByText('experiment · day 1 of 7')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'I kept it today' })));
  expect(mocked.setKept).toHaveBeenCalledWith(running, today, true);
});
