import { act, fireEvent, render, screen } from '@testing-library/react-native';

import * as checkIns from '@/lib/checkIns';
import { ThemeProvider } from '@/theme/ThemeProvider';

import Wrapped from '@/app/wrapped';

const DAY = 24 * 60 * 60 * 1000;
let mockCreated = new Date(Date.now() - 40 * DAY).toISOString();

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock('@/lib/session', () => ({ useSession: () => ({ status: 'ready', profile: { createdAt: mockCreated } }) }));
jest.mock('@/lib/checkIns', () => ({ ...jest.requireActual('@/lib/checkIns'), allCheckIns: jest.fn() }));
jest.mock('@/lib/sleep', () => ({ ...jest.requireActual('@/lib/sleep'), allSleep: () => Promise.resolve([]) }));
jest.mock('@/lib/vents', () => ({ pageDates: () => Promise.resolve([]) }));

function todayAt(pleasantness: number, emotion: string): checkIns.CheckIn {
  const at = new Date();
  return { id: emotion, createdAt: at.toISOString(), localDate: checkIns.localDate(at), emotion, energy: 1, pleasantness, tags: [], note: null };
}

async function renderWrapped() {
  render(
    <ThemeProvider>
      <Wrapped />
    </ThemeProvider>
  );
  await act(async () => {});
}

beforeEach(() => {
  mockCreated = new Date(Date.now() - 40 * DAY).toISOString();
  jest.mocked(checkIns.allCheckIns).mockResolvedValue([todayAt(4, 'glad'), { ...todayAt(3, 'glad'), id: 'glad-2' }]);
});

test('tells this month back, and moves between periods', async () => {
  await renderWrapped();
  const month = new Date().toLocaleDateString([], { month: 'long' });
  expect(screen.getByText(`${month}, wrapped.`)).toBeTruthy();
  expect(screen.getByText('1 day with a word in it.')).toBeTruthy();
  expect(screen.getByText('“glad”')).toBeTruthy();

  fireEvent.press(screen.getByRole('tab', { name: 'this year' }));
  expect(screen.getByText(`${new Date().getFullYear()}, wrapped.`)).toBeTruthy();
});

test('stays closed before day 30', async () => {
  mockCreated = new Date(Date.now() - 10 * DAY).toISOString();
  await renderWrapped();
  expect(screen.getByText('Your month, wrapped — once there’s a month of you.')).toBeTruthy();
});
