import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import * as mirror from '@/lib/mirror';
import { recordSafetyEvent, reflectionsPaused } from '@/lib/safety/log';
import { ThemeProvider } from '@/theme/ThemeProvider';

import Mirror from '@/app/(tabs)/mirror';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/lib/session', () => ({
  useProfile: () => ({ createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() })
}));
jest.mock('@/lib/safety/log', () => ({
  recordSafetyEvent: jest.fn(() => Promise.resolve()),
  reflectionsPaused: jest.fn(() => Promise.resolve(false))
}));
jest.mock('@/lib/api', () => ({ api: {}, ApiError: class extends Error {}, NetworkError: class extends Error {} }));
jest.mock('@/lib/mirror', () => ({
  ...jest.requireActual('@/lib/mirror'),
  mirrorStatus: jest.fn(),
  askMirror: jest.fn(),
  listMessages: jest.fn(),
  addMessage: jest.fn(),
  clearConversation: jest.fn()
}));

const mocked = jest.mocked(mirror);
let nextId = 1;

async function renderMirror() {
  render(
    <ThemeProvider>
      <Mirror />
    </ThemeProvider>
  );
  await act(async () => {});
}

beforeEach(() => {
  jest.clearAllMocks();
  nextId = 1;
  mocked.mirrorStatus.mockResolvedValue({ kind: 'open' });
  mocked.listMessages.mockResolvedValue([]);
  mocked.addMessage.mockImplementation(async (role, content) => ({ id: nextId++, role, content, createdAt: 'now' }));
  mocked.askMirror.mockResolvedValue('It sounds like the week has been long.');
  jest.mocked(reflectionsPaused).mockResolvedValue(false);
});

test('says what it is, and offers questions to start with', async () => {
  await renderMirror();
  expect(screen.getByText('software, not a person · not a therapist')).toBeTruthy();
  // Questions come by theme, as in the reference's Void.
  expect(screen.getByRole('button', { name: 'Why do I feel like this?' })).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', { name: 'rest' }));
  fireEvent.press(screen.getByRole('button', { name: 'What would help tonight?' }));
  expect(screen.getByLabelText('Ask Mirror').props.value).toBe('What would help tonight?');
});

test('a question is kept on the phone and answered', async () => {
  await renderMirror();
  fireEvent.changeText(screen.getByLabelText('Ask Mirror'), 'why am I so tired');
  fireEvent.press(screen.getByRole('button', { name: 'send' }));

  expect(await screen.findByText('It sounds like the week has been long.')).toBeTruthy();
  expect(mocked.addMessage).toHaveBeenCalledWith('user', 'why am I so tired');
  expect(mocked.addMessage).toHaveBeenCalledWith('mirror', 'It sounds like the week has been long.');
  expect(recordSafetyEvent).not.toHaveBeenCalled();
});

test('anything acute is never sent: the crisis screen answers instead', async () => {
  await renderMirror();
  fireEvent.changeText(screen.getByLabelText('Ask Mirror'), 'I have a plan to end it all');
  fireEvent.press(screen.getByRole('button', { name: 'send' }));

  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/crisis?tier=acute'));
  expect(mocked.askMirror).not.toHaveBeenCalled();
  expect(mocked.addMessage).not.toHaveBeenCalled();
  expect(recordSafetyEvent).toHaveBeenCalledWith('acute', 'chat');
  expect(screen.getByText(/You deserve a person right now/)).toBeTruthy();
});

test('after an acute moment, Mirror stays quiet for the day', async () => {
  jest.mocked(reflectionsPaused).mockResolvedValue(true);
  await renderMirror();
  fireEvent.changeText(screen.getByLabelText('Ask Mirror'), 'what now');
  fireEvent.press(screen.getByRole('button', { name: 'send' }));

  expect(await screen.findByText(/Mirror is quiet for today/)).toBeTruthy();
  expect(mocked.askMirror).not.toHaveBeenCalled();
});

test('closed rooms say why, and nothing can be typed', async () => {
  mocked.mirrorStatus.mockResolvedValue({ kind: 'unavailable' });
  await renderMirror();
  expect(screen.getByText(/nothing you type here is sent until then/)).toBeTruthy();
  expect(screen.queryByLabelText('Ask Mirror')).toBeNull();
});

test('without consent, it points to where it can be turned on', async () => {
  mocked.mirrorStatus.mockResolvedValue({ kind: 'no-consent' });
  await renderMirror();
  fireEvent.press(screen.getByRole('button', { name: 'turn it on in you' }));
  expect(mockPush).toHaveBeenCalledWith('/you');
});
