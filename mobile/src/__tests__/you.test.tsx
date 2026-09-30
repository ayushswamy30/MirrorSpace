import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import * as account from '@/lib/account';
import { ThemeProvider } from '@/theme/ThemeProvider';

import You from '@/app/(tabs)/you';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: (...a: unknown[]) => mockReplace(...a), back: jest.fn() } }));
jest.mock('@/lib/account', () => ({ eraseEverything: jest.fn(), setConsent: jest.fn(), shareExport: jest.fn() }));

const mockSetEnabled = jest.fn();
const mockAuthenticate = jest.fn();
jest.mock('@/lib/appLock', () => ({
  useAppLock: () => ({ enabled: false, setEnabled: mockSetEnabled }),
  authenticate: () => mockAuthenticate(),
  lockAvailability: () => Promise.resolve('available')
}));

const mockRetry = jest.fn();
const mockRefresh = jest.fn();
let mockOffline = false;
jest.mock('@/lib/session', () => ({
  useSession: () => ({
    status: 'ready',
    offline: mockOffline,
    retry: mockRetry,
    refreshProfile: mockRefresh,
    profile: {
      id: 'u1',
      email: null,
      isAnonymous: true,
      createdAt: new Date().toISOString(),
      consents: {
        readings: { granted: true, at: null, policyVersion: null },
        ai_reflections: { granted: false, at: null, policyVersion: null },
        health: { granted: false, at: null, policyVersion: null }
      }
    }
  })
}));

const mockSetCircleName = jest.fn(() => Promise.resolve({ name: 'Sam', code: 'K7M2QX' }));
jest.mock('@/lib/api', () => ({ api: {}, ApiError: class extends Error {}, NetworkError: class extends Error {} }));
jest.mock('@/lib/circle', () => ({
  loadCircle: () =>
    Promise.resolve({ me: { name: 'Asha', code: 'K7M2QX', icon: 'cat', sharing: false, low: false }, friends: [], incoming: [], outgoing: [], nudges: [] }),
  setCircleName: (...a: unknown[]) => (mockSetCircleName as (...args: unknown[]) => unknown)(...a)
}));

const mockSaveAppearance = jest.fn();
jest.mock('@/lib/appearance', () => ({
  loadAppearance: () => Promise.resolve('system'),
  saveAppearance: (a: string) => mockSaveAppearance(a)
}));

const mocked = jest.mocked(account);

function renderYou() {
  return render(
    <ThemeProvider>
      <You />
    </ThemeProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOffline = false;
  mockRefresh.mockResolvedValue(undefined);
  mocked.setConsent.mockResolvedValue();
  mocked.eraseEverything.mockResolvedValue();
});

test('shows the day and that there is no account', () => {
  renderYou();
  expect(screen.getByText('day 1')).toBeTruthy();
  expect(screen.getByText('no account — this phone only')).toBeTruthy();
});

test('appearance can be set to light, dark, or follow the phone', () => {
  renderYou();
  expect(screen.getByRole('tab', { name: 'system' }).props.accessibilityState).toMatchObject({ selected: true });

  fireEvent.press(screen.getByRole('tab', { name: 'dark' }));
  expect(screen.getByRole('tab', { name: 'dark' }).props.accessibilityState).toMatchObject({ selected: true });
  expect(mockSaveAppearance).toHaveBeenCalledWith('dark');
});

test('withdrawing a consent is one switch, sent and re-read', async () => {
  renderYou();
  fireEvent(screen.getByLabelText('Readings from your numbers'), 'valueChange', false);
  await waitFor(() => expect(mocked.setConsent).toHaveBeenCalledWith('readings', false));
  expect(mockRefresh).toHaveBeenCalled();
});

test('offline, consents cannot change and say nothing changed if tried', async () => {
  mocked.setConsent.mockRejectedValue(new Error('offline'));
  renderYou();
  fireEvent(screen.getByLabelText('AI reflections'), 'valueChange', true);
  expect(await screen.findByText('That needs a connection. Nothing changed.')).toBeTruthy();
});

test('the app lock only changes after the owner confirms', async () => {
  mockAuthenticate.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  renderYou();

  fireEvent(screen.getByLabelText('App lock'), 'valueChange', true);
  await act(async () => {});
  expect(mockSetEnabled).not.toHaveBeenCalled();

  fireEvent(screen.getByLabelText('App lock'), 'valueChange', true);
  await waitFor(() => expect(mockSetEnabled).toHaveBeenCalledWith(true));
});

test('erasing asks once, then erases and starts a fresh space', async () => {
  renderYou();
  fireEvent.press(screen.getByRole('button', { name: 'erase everything' }));
  expect(screen.getByText(/It can’t be undone/)).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'erase' }));
  await waitFor(() => expect(mocked.eraseEverything).toHaveBeenCalled());
  expect(mockRetry).toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith('/');
});

test('an erase that cannot reach the server says nothing was deleted', async () => {
  mocked.eraseEverything.mockRejectedValue(new Error('offline'));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  renderYou();
  fireEvent.press(screen.getByRole('button', { name: 'erase everything' }));
  fireEvent.press(screen.getByRole('button', { name: 'erase' }));

  expect(await screen.findByText(/nothing was deleted/)).toBeTruthy();
  expect(mockRetry).not.toHaveBeenCalled();
});

test('export reports when only the phone part could be gathered', async () => {
  mocked.shareExport.mockResolvedValue({
    exportedAt: 'x',
    onThisPhone: { checkIns: [], ventPages: [], sleep: [], mirrorConversation: [], safetyPlan: null, safetyEvents: [] },
    server: null,
    serverError: 'offline'
  });
  renderYou();
  fireEvent.press(screen.getByRole('button', { name: /^Download everything/ }));
  expect(await screen.findByText(/its part is missing/)).toBeTruthy();
});

test('your name and picture can be changed here', async () => {
  renderYou();
  fireEvent.press(await screen.findByRole('button', { name: /^Asha\. Change your name or picture/ }));
  fireEvent.changeText(screen.getByLabelText('Your name'), 'Sam');
  fireEvent.press(screen.getByRole('radio', { name: 'swan' }));
  fireEvent.press(screen.getByRole('button', { name: 'save' }));
  await waitFor(() => expect(mockSetCircleName).toHaveBeenCalledWith('Sam', 'swan'));
  expect(await screen.findByText('Sam')).toBeTruthy();
});
