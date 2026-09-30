import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import * as account from '@/lib/account';
import * as circle from '@/lib/circle';
import type { CircleState } from '@/lib/circle';
import { ThemeProvider } from '@/theme/ThemeProvider';

import Circle from '@/app/(tabs)/circle';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return { useFocusEffect: (fn: () => void) => useEffect(fn, [fn]) };
});
jest.mock('@/lib/account', () => ({ setConsent: jest.fn() }));
jest.mock('@/lib/api', () => ({
  api: {},
  ApiError: class ApiError extends Error {
    body: unknown;
    constructor(_code: number, text: string, payload: unknown) {
      super(text);
      this.body = payload;
    }
  },
  NetworkError: class extends Error {}
}));
jest.mock('@/lib/circle', () => ({
  loadCircle: jest.fn(),
  setCircleName: jest.fn(),
  requestFriend: jest.fn(),
  acceptFriend: jest.fn(),
  removeFriend: jest.fn(),
  setRunningLow: jest.fn(),
  thinkingOfYou: jest.fn(),
  markNudgesSeen: jest.fn(),
  shareStatus: jest.fn()
}));

const mockRefresh = jest.fn();
jest.mock('@/lib/session', () => ({
  useSession: () => ({ status: 'ready', refreshProfile: mockRefresh, profile: { consents: {} } })
}));

const mocked = jest.mocked(circle);

function state(overrides: Partial<CircleState> = {}): CircleState {
  return {
    me: { name: 'Asha', code: 'K7M2QX', sharing: true, low: false },
    friends: [
      { id: 'f1', name: 'Ben', weather: 'fog', low: true, rhythm: 'You both run heavy on Thursdays.', since: null }
    ],
    incoming: [],
    outgoing: [],
    nudges: [],
    ...overrides
  };
}

async function renderCircle() {
  render(
    <ThemeProvider>
      <Circle />
    </ThemeProvider>
  );
  await act(async () => {});
}

beforeEach(() => {
  jest.clearAllMocks();
  mocked.loadCircle.mockResolvedValue(state());
  for (const fn of [mocked.setCircleName, mocked.acceptFriend, mocked.removeFriend, mocked.setRunningLow, mocked.thinkingOfYou, mocked.shareStatus]) {
    (fn as jest.Mock).mockResolvedValue(undefined);
  }
});

test('before a name, it asks — and says what would be shared and what never is', async () => {
  mocked.loadCircle.mockResolvedValue(state({ me: { name: null, code: null, sharing: false, low: false }, friends: [] }));
  mocked.setCircleName.mockResolvedValue({ name: 'Asha', code: 'K7M2QX' });
  await renderCircle();

  expect(screen.getByText('they would see')).toBeTruthy();
  expect(screen.getByText(/Your words, notes, pages or Mirror/)).toBeTruthy();

  fireEvent.changeText(screen.getByLabelText('The name your circle sees'), 'Asha');
  fireEvent.press(screen.getByRole('button', { name: 'start my circle' }));
  await waitFor(() => expect(account.setConsent).toHaveBeenCalledWith('circle', true));
  expect(mocked.setCircleName).toHaveBeenCalledWith('Asha');
  expect(mocked.shareStatus).toHaveBeenCalled();
});

test('a friend shows their weather, that they are running low, and the rhythm you share', async () => {
  await renderCircle();
  expect(screen.getByText('Ben is running low.')).toBeTruthy();
  expect(screen.getByText('fog today · running low')).toBeTruthy();
  expect(screen.getByText('You both run heavy on Thursdays.')).toBeTruthy();
  expect(screen.getByText('K7M2QX')).toBeTruthy();
});

test('thinking of you is two taps', async () => {
  await renderCircle();
  fireEvent.press(screen.getByRole('button', { name: /^Ben\./ }));
  fireEvent.press(screen.getByRole('button', { name: 'thinking of you' }));
  await waitFor(() => expect(mocked.thinkingOfYou).toHaveBeenCalledWith('f1'));
});

test('a request can be accepted', async () => {
  mocked.loadCircle.mockResolvedValue(state({ incoming: [{ id: 'r1', name: 'Kabir' }] }));
  await renderCircle();
  fireEvent.press(screen.getByRole('button', { name: 'accept' }));
  await waitFor(() => expect(mocked.acceptFriend).toHaveBeenCalledWith('r1'));
});

test('a wrong code says so, in the server’s words', async () => {
  const { ApiError } = jest.requireMock('@/lib/api');
  mocked.requestFriend.mockRejectedValue(new ApiError(404, 'x', { message: 'No one has that code.' }));
  await renderCircle();
  fireEvent.changeText(screen.getByLabelText('Their code'), 'zzzzzz');
  fireEvent.press(screen.getByRole('button', { name: 'add' }));
  expect(await screen.findByText('No one has that code.')).toBeTruthy();
  expect(mocked.requestFriend).toHaveBeenCalledWith('ZZZZZZ');
});

test('stopping sharing is one switch', async () => {
  await renderCircle();
  fireEvent(screen.getByLabelText('Share with my circle'), 'valueChange', false);
  await waitFor(() => expect(account.setConsent).toHaveBeenCalledWith('circle', false));
  expect(mockRefresh).toHaveBeenCalled();
});
