import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { SafetyPlan } from '@/components/SafetyPlan';
import * as safetyPlan from '@/lib/safetyPlan';
import { ThemeProvider } from '@/theme/ThemeProvider';

jest.mock('@/lib/safetyPlan', () => {
  const actual = jest.requireActual('@/lib/safetyPlan');
  return { ...actual, loadPlan: jest.fn(), savePlan: jest.fn() };
});

const mocked = jest.mocked(safetyPlan);

async function renderPlan() {
  render(
    <ThemeProvider>
      <SafetyPlan />
    </ThemeProvider>
  );
  await act(async () => {});
}

beforeEach(() => {
  jest.clearAllMocks();
  mocked.savePlan.mockImplementation(async plan => ({ ...plan, updatedAt: '2026-09-29T20:00:00.000Z' }));
});

test('an empty plan invites writing one, and every line is saved as it is added', async () => {
  mocked.loadPlan.mockResolvedValue(safetyPlan.emptyPlan());
  await renderPlan();

  fireEvent.press(screen.getByRole('button', { name: 'start' }));
  fireEvent.changeText(screen.getByLabelText('New line for warning signs'), 'awake after 2am');
  fireEvent.press(screen.getByRole('button', { name: 'Add to warning signs' }));

  await waitFor(() => expect(mocked.savePlan).toHaveBeenCalled());
  expect(mocked.savePlan.mock.calls[0][0].warningSigns).toEqual([{ text: 'awake after 2am' }]);

  fireEvent.press(screen.getByRole('button', { name: 'done' }));
  expect(screen.getByText('1 · warning signs')).toBeTruthy();
  expect(screen.getByText('awake after 2am')).toBeTruthy();
});

test('reading shows only the filled steps, with one tap to call', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  mocked.loadPlan.mockResolvedValue(
    safetyPlan.addItem(
      safetyPlan.addItem(safetyPlan.emptyPlan(), 'people', { text: 'Asha', phone: '+91 98765 43210' }),
      'reasons',
      { text: 'my dog' }
    )
  );
  await renderPlan();

  expect(screen.getByText('4 · people to ask')).toBeTruthy();
  expect(screen.getByText('7 · reasons')).toBeTruthy();
  expect(screen.queryByText('1 · warning signs')).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'Call Asha' }));
  expect(open).toHaveBeenCalledWith('tel:+919876543210');
});

test('lines can be removed while editing', async () => {
  mocked.loadPlan.mockResolvedValue(safetyPlan.addItem(safetyPlan.emptyPlan(), 'coping', { text: 'a walk' }));
  await renderPlan();

  fireEvent.press(screen.getByRole('button', { name: 'edit plan' }));
  fireEvent.press(screen.getByRole('button', { name: 'Remove a walk' }));
  await waitFor(() => expect(mocked.savePlan).toHaveBeenCalled());
  expect(mocked.savePlan.mock.calls[0][0].coping).toEqual([]);
});
