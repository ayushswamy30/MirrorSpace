import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { Vent } from '@/components/Vent';
import { recordSafetyEvent } from '@/lib/safety/log';
import * as vents from '@/lib/vents';
import { ThemeProvider } from '@/theme/ThemeProvider';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('@/lib/safety/log', () => ({ recordSafetyEvent: jest.fn(() => Promise.resolve()) }));
jest.mock('@/lib/reflections', () => ({ ...jest.requireActual('@/lib/reflections'), requestReflection: jest.fn(() => Promise.resolve()) }));
jest.mock('@/lib/api', () => ({ api: {}, ApiError: class extends Error {}, NetworkError: class extends Error {} }));
jest.mock('@/lib/vents', () => {
  const actual = jest.requireActual('@/lib/vents');
  return {
    ...actual,
    keepVent: jest.fn(),
    listVents: jest.fn(),
    deleteVent: jest.fn(),
    draft: { get: jest.fn(), set: jest.fn(), clear: jest.fn() }
  };
});

const mocked = jest.mocked(vents);
const logged = jest.mocked(recordSafetyEvent);

const page = (body: string): vents.Vent => ({
  id: 'v1',
  createdAt: '2026-09-29T21:00:00.000Z',
  localDate: '2026-09-29',
  body
});

async function renderVent() {
  render(
    <ThemeProvider>
      <Vent />
    </ThemeProvider>
  );
  await act(async () => {});
}

beforeEach(() => {
  jest.clearAllMocks();
  mocked.listVents.mockResolvedValue([]);
  mocked.keepVent.mockImplementation(async body => page(body));
  mocked.deleteVent.mockResolvedValue();
  jest.mocked(mocked.draft.get).mockResolvedValue(null);
  jest.mocked(mocked.draft.set).mockResolvedValue();
  jest.mocked(mocked.draft.clear).mockResolvedValue();
});

test('nothing to keep or let go until something is written', async () => {
  await renderVent();
  expect(screen.getByRole('button', { name: 'keep' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'let go' })).toBeDisabled();
});

test('a kept page is saved on the phone and the page clears', async () => {
  await renderVent();
  fireEvent.changeText(screen.getByLabelText('vent page'), 'work was a lot today');
  fireEvent.press(screen.getByRole('button', { name: 'keep' }));

  await screen.findByText('It’s kept.');
  expect(mocked.keepVent).toHaveBeenCalledWith('work was a lot today');
  expect(logged).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
});

test('letting go asks once, then saves nothing', async () => {
  await renderVent();
  fireEvent.changeText(screen.getByLabelText('vent page'), 'the thing with my sister');
  fireEvent.press(screen.getByRole('button', { name: 'let go' }));
  expect(screen.getByText('Let it go? It won’t be saved anywhere.')).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'let go' }));
  expect(screen.getByText('Let go.')).toBeTruthy();
  expect(mocked.keepVent).not.toHaveBeenCalled();
  expect(mocked.draft.clear).toHaveBeenCalled();
});

test('a page that is let go is still screened, and acute opens the crisis card', async () => {
  await renderVent();
  fireEvent.changeText(screen.getByLabelText('vent page'), 'I wrote my goodbye letter');
  fireEvent.press(screen.getByRole('button', { name: 'let go' }));
  fireEvent.press(screen.getByRole('button', { name: 'let go' }));

  expect(logged).toHaveBeenCalledWith('acute', 'vent');
  expect(mockPush).toHaveBeenCalledWith('/crisis?tier=acute');
});

test('a low page leaves the care line after keeping', async () => {
  await renderVent();
  fireEvent.changeText(screen.getByLabelText('vent page'), 'honestly everything feels hopeless');
  fireEvent.press(screen.getByRole('button', { name: 'keep' }));

  await screen.findByText('It’s kept.');
  expect(screen.getByText(/help is one tap away/)).toBeTruthy();
  expect(logged).toHaveBeenCalledWith('low', 'vent');
  expect(mockPush).not.toHaveBeenCalled();
});

test('a saved draft comes back', async () => {
  jest.mocked(mocked.draft.get).mockResolvedValue('half a thought');
  await renderVent();
  expect(screen.getByLabelText('vent page').props.value).toBe('half a thought');
});

test('kept pages can be read back and deleted after a second tap', async () => {
  mocked.listVents.mockResolvedValue([page('first line\nsecond line')]);
  await renderVent();

  fireEvent.press(screen.getByRole('button', { name: /^first line/ }));
  expect(screen.getByText('first line\nsecond line')).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'delete this page' }));
  fireEvent.press(screen.getByRole('button', { name: 'delete' }));
  await waitFor(() => expect(mocked.deleteVent).toHaveBeenCalledWith('v1'));
});

test('first line trims long pages for the list', () => {
  expect(vents.firstLine('a short one')).toBe('a short one');
  expect(vents.firstLine('x'.repeat(80), 20)).toHaveLength(20);
  expect(vents.firstLine('top\nrest')).toBe('top');
});

test('with reflections on, a kept page is sent once for a reflection', async () => {
  const { requestReflection } = jest.requireMock('@/lib/reflections');
  mocked.keepVent.mockResolvedValue({ id: 'v9', createdAt: new Date().toISOString(), localDate: '2026-10-02', body: 'a long day' });
  render(
    <ThemeProvider>
      <Vent reflections />
    </ThemeProvider>
  );
  await act(async () => {});
  fireEvent.changeText(screen.getByLabelText('vent page'), 'a long day');
  fireEvent.press(screen.getByRole('button', { name: 'keep' }));
  await waitFor(() => expect(requestReflection).toHaveBeenCalledWith('v9', 'a long day'));
  expect(await screen.findByText(/reflection on it will be here in a few hours/)).toBeTruthy();
});
