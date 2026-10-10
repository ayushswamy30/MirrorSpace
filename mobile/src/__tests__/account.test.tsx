import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import * as auth from '@/lib/auth';
import { ThemeProvider } from '@/theme/ThemeProvider';

import Account from '@/app/account';

const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a), back: () => mockBack(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams
}));
jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  sendLinkCode: jest.fn(),
  confirmLinkCode: jest.fn(),
  sendSignInCode: jest.fn(),
  sendSignUpCode: jest.fn(),
  confirmSignInCode: jest.fn()
}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const mockRetry = jest.fn();
const mockRefresh = jest.fn(() => Promise.resolve());
jest.mock('@/lib/session', () => ({ useSession: () => ({ retry: mockRetry, refreshProfile: mockRefresh }) }));

const mocked = jest.mocked(auth);

async function renderAccount() {
  render(
    <ThemeProvider>
      <Account />
    </ThemeProvider>
  );
  await act(async () => {});
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  for (const fn of [mocked.sendLinkCode, mocked.confirmLinkCode, mocked.sendSignInCode, mocked.sendSignUpCode, mocked.confirmSignInCode]) {
    fn.mockResolvedValue();
  }
});

test('keeping a space: an email, then the six digits, and the same account stays', async () => {
  mockParams = { next: 'welcome' };
  await renderAccount();

  fireEvent.changeText(screen.getByLabelText('Email address'), ' Asha@Example.com ');
  fireEvent.press(screen.getByRole('button', { name: 'send me a code' }));
  await waitFor(() => expect(mocked.sendLinkCode).toHaveBeenCalledWith('asha@example.com'));

  fireEvent.changeText(screen.getByLabelText('Six-digit code'), '12 34-56');
  fireEvent.press(screen.getByRole('button', { name: 'keep my space' }));
  await waitFor(() => expect(mocked.confirmLinkCode).toHaveBeenCalledWith('asha@example.com', '123456'));
  expect(mockRefresh).toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith('/');
});

test('signing in on another phone starts a fresh session', async () => {
  mockParams = { mode: 'signin' };
  await renderAccount();
  fireEvent.changeText(screen.getByLabelText('Email address'), 'asha@example.com');
  fireEvent.press(screen.getByRole('button', { name: 'send me a code' }));
  await waitFor(() => expect(mocked.sendSignInCode).toHaveBeenCalled());
  fireEvent.changeText(screen.getByLabelText('Six-digit code'), '654321');
  fireEvent.press(screen.getByRole('button', { name: 'sign in' }));
  await waitFor(() => expect(mockRetry).toHaveBeenCalled());
});

test('a wrong code says so plainly, and nothing moves on', async () => {
  mocked.confirmLinkCode.mockRejectedValue(new auth.AuthProblem('That code didn’t match, or it has expired. Ask for a new one.'));
  await renderAccount();
  fireEvent.changeText(screen.getByLabelText('Email address'), 'asha@example.com');
  fireEvent.press(screen.getByRole('button', { name: 'send me a code' }));
  await waitFor(() => screen.getByLabelText('Six-digit code'));
  fireEvent.changeText(screen.getByLabelText('Six-digit code'), '000000');
  fireEvent.press(screen.getByRole('button', { name: 'keep my space' }));
  expect(await screen.findByText(/didn’t match/)).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();
});

test('a space made without an email has to be kept with one: there is no way past it', async () => {
  mockParams = { mode: 'keep' };
  await renderAccount();
  expect(screen.queryByRole('button', { name: /not now/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /close/i })).toBeNull();
});

test('a new account: a code that creates it, then a fresh session', async () => {
  mockParams = { mode: 'signup' };
  await renderAccount();
  fireEvent.changeText(screen.getByLabelText('Email address'), 'New@Example.com ');
  fireEvent.press(screen.getByRole('button', { name: 'send me a code' }));
  await waitFor(() => expect(mocked.sendSignUpCode).toHaveBeenCalledWith('new@example.com'));
  fireEvent.changeText(screen.getByLabelText('Six-digit code'), '123456');
  fireEvent.press(screen.getByRole('button', { name: 'create my account' }));
  await waitFor(() => expect(mocked.confirmSignInCode).toHaveBeenCalledWith('new@example.com', '123456'));
  expect(mockRetry).toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith('/');
});

test('an address that isn’t one is caught before anything is sent', async () => {
  await renderAccount();
  fireEvent.changeText(screen.getByLabelText('Email address'), 'asha at home');
  fireEvent.press(screen.getByRole('button', { name: 'send me a code' }));
  expect(await screen.findByText('That doesn’t look like an email address.')).toBeTruthy();
  expect(mocked.sendLinkCode).not.toHaveBeenCalled();
});
