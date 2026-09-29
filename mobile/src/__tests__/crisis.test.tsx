import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { ThemeProvider } from '@/theme/ThemeProvider';

import Crisis from '@/app/crisis';

let mockParams: Record<string, string> = {};
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: { back: () => mockBack(), replace: (...args: unknown[]) => mockReplace(...args) },
  useLocalSearchParams: () => mockParams
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ regionCode: 'IN' }] }));

function renderCrisis(tier?: string) {
  mockParams = tier ? { tier } : {};
  return render(
    <ThemeProvider>
      <Crisis />
    </ThemeProvider>
  );
}

beforeEach(() => jest.clearAllMocks());

test('acute puts the local line first, one tap to call', () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  renderCrisis('acute');

  expect(screen.getByText('Please talk to someone right now.')).toBeTruthy();
  // The same line is in the full list further down; the first is the big
  // button at the top of the card.
  const [primary] = screen.getAllByRole('button', { name: 'Call Tele-MANAS on 14416' });
  fireEvent.press(primary);
  expect(open).toHaveBeenCalledWith('tel:14416');
});

test('elevated interrupts with a breath and the lines, and can be closed', () => {
  renderCrisis('elevated');

  expect(screen.getByText('That sounds like a lot to carry.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'breathe for a minute' }));
  expect(mockReplace).toHaveBeenCalledWith('/calm');

  fireEvent.press(screen.getByRole('button', { name: 'i’m okay for now' }));
  expect(mockBack).toHaveBeenCalled();
});

test('a missing or unknown tier still shows help, as elevated', () => {
  renderCrisis('whatever');
  expect(screen.getByText('That sounds like a lot to carry.')).toBeTruthy();
});
