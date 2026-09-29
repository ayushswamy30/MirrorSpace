import { fireEvent, render, screen } from '@testing-library/react-native';

import { consentCopy } from '@/lib/consent';
import { Text } from 'react-native';

import { OnboardingProvider, useOnboarding } from '@/lib/onboarding';
import { ThemeProvider } from '@/theme/ThemeProvider';

import Consent from '@/app/onboarding/consent/[purpose]';

const mockPush = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>redirect:{href}</Text>;
  }
}));
jest.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: jest.fn() } } }));
jest.mock('@/lib/db/kv', () => ({ kv: { get: jest.fn(), set: jest.fn(), remove: jest.fn() } }));

/** Renders the draft so tests can read what the screen recorded. */
function Spy() {
  const { draft } = useOnboarding();
  return <Text testID="draft">{JSON.stringify(draft.consents)}</Text>;
}

const recorded = () => JSON.parse(screen.getByTestId('draft').props.children);

function renderConsent(purpose: string) {
  mockParams = { purpose };
  return render(
    <ThemeProvider>
      <OnboardingProvider>
        <Consent />
        <Spy />
      </OnboardingProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  mockPush.mockReset();
});

test('shows what is sent and what is not, for this purpose only', () => {
  renderConsent('readings');
  expect(screen.getByText(consentCopy.readings.title)).toBeTruthy();
  expect(screen.queryByText(consentCopy.ai_reflections.title)).toBeNull();
});

test('"not now" records a refusal and moves on', () => {
  renderConsent('readings');
  fireEvent.press(screen.getByRole('button', { name: 'not now' }));

  expect(recorded()).toEqual({ readings: false });
  expect(mockPush).toHaveBeenCalledWith('/onboarding/consent/ai_reflections');
});

test('the last consent leads to the lock question', () => {
  renderConsent('ai_reflections');
  fireEvent.press(screen.getByRole('button', { name: 'allow' }));

  expect(recorded()).toEqual({ ai_reflections: true });
  expect(mockPush).toHaveBeenCalledWith('/onboarding/lock');
});

test('an unknown purpose goes back to the start instead of rendering a blank consent', () => {
  renderConsent('marketing');
  expect(screen.getByText('redirect:/onboarding')).toBeTruthy();
});
