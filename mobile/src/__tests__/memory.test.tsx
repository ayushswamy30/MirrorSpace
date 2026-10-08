import { act, fireEvent, render, screen } from '@testing-library/react-native';

import * as memory from '@/lib/memory';
import { ThemeProvider } from '@/theme/ThemeProvider';

import Memory from '@/app/memory';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), navigate: jest.fn() } }));
jest.mock('@/lib/session', () => ({ useSession: () => ({ status: 'ready', profile: { consents: { readings: { granted: true } } } }) }));
jest.mock('@/lib/memory', () => ({
  ...jest.requireActual('@/lib/memory'),
  memoryEnabled: jest.fn(async () => false),
  setMemoryEnabled: jest.fn(async () => undefined),
  currentPatterns: jest.fn(async () => [{ key: 'days', text: 'You checked in on 5 of the last 7 days.', receipt: '5 check-ins · 7 days' }]),
  hiddenPatterns: jest.fn(async () => []),
  setPatternHidden: jest.fn(async () => ['days']),
  listNotes: jest.fn(async () => [{ id: 'n', body: 'I work nights', createdAt: 'a', updatedAt: 'a' }]),
  addNote: jest.fn(async () => undefined),
  updateNote: jest.fn(async () => undefined),
  forgetNote: jest.fn(async () => undefined)
}));

const mocked = jest.mocked(memory);

async function renderPage() {
  render(
    <ThemeProvider>
      <Memory />
    </ThemeProvider>
  );
  await act(async () => {});
}

test('lists every pattern and note, each of which can be hidden, corrected or forgotten', async () => {
  await renderPage();
  expect(screen.getByText('What the Mirror knows.')).toBeTruthy();
  expect(screen.getByText('Off — Mirror sees only the conversation')).toBeTruthy();
  expect(screen.getByText('You checked in on 5 of the last 7 days.')).toBeTruthy();

  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'hide this' })));
  expect(mocked.setPatternHidden).toHaveBeenCalledWith('days', true);

  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'correct it' })));
  fireEvent.changeText(screen.getByLabelText('Correct this note'), 'I work night shifts, Mon to Thu');
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'save' })));
  expect(mocked.updateNote).toHaveBeenCalledWith('n', 'I work night shifts, Mon to Thu');

  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'forget it' })));
  expect(mocked.forgetNote).toHaveBeenCalledWith('n');

  fireEvent.changeText(screen.getByLabelText('A new note for the Mirror'), 'My sister is Asha');
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'remember this' })));
  expect(mocked.addNote).toHaveBeenCalledWith('My sister is Asha');
});
