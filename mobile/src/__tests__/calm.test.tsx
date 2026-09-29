import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '@/theme/ThemeProvider';

import Calm from '@/app/calm';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: (...args: unknown[]) => mockReplace(...args) }
}));

function renderCalm() {
  return render(
    <ThemeProvider>
      <Calm />
    </ThemeProvider>
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

test('breathing is guided phase by phase, and can be stopped', () => {
  renderCalm();

  fireEvent.press(screen.getByRole('button', { name: /^Box breathing/ }));
  expect(screen.getByText('breathe in')).toBeTruthy();
  expect(screen.getByText('round 1 of 5')).toBeTruthy();

  act(() => jest.advanceTimersByTime(4200));
  expect(screen.getByText('hold')).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'stop' }));
  expect(screen.getByRole('button', { name: /^Double sigh/ })).toBeTruthy();
});

test('a pattern that runs to the end says so and offers another round', () => {
  renderCalm();
  fireEvent.press(screen.getByRole('button', { name: /^Double sigh/ }));

  act(() => jest.advanceTimersByTime(9 * 6 * 1000 + 400));

  expect(screen.getByText('That’s it. Notice how you feel now.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'again' }));
  expect(screen.getByText('round 1 of 6')).toBeTruthy();
});

test('grounding goes one sense at a time, five to one', () => {
  renderCalm();
  fireEvent.press(screen.getByRole('tab', { name: 'ground' }));

  expect(screen.getByText(/Name five things you can see/)).toBeTruthy();
  for (let i = 0; i < 4; i++) fireEvent.press(screen.getByRole('button', { name: 'next' }));
  expect(screen.getByText(/one thing you can taste/)).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'finish' }));
  expect(screen.getByText('You’re here, in this room, right now.')).toBeTruthy();
});

test('crisis lines are one tap away from calm', () => {
  renderCalm();
  fireEvent.press(screen.getByRole('button', { name: 'Need help now' }));
  expect(mockReplace).toHaveBeenCalledWith('/help');
});
