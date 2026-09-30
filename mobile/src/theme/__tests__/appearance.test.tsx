import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { dark, light } from '../tokens';
import { ThemeProvider, useAppearance, useTheme } from '../ThemeProvider';

let mockSaved = 'system';
jest.mock('@/lib/appearance', () => ({
  loadAppearance: () => Promise.resolve(mockSaved),
  saveAppearance: jest.fn(() => Promise.resolve())
}));

function Probe() {
  const { scheme, colors } = useTheme();
  const { appearance } = useAppearance();
  return <Text testID="probe">{`${appearance} ${scheme} ${colors.paper}`}</Text>;
}

async function renderProbe() {
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>
  );
  await act(async () => {});
  return screen.getByTestId('probe').props.children as string;
}

test('follows the phone until something else is chosen', async () => {
  mockSaved = 'system';
  expect(await renderProbe()).toBe(`system light ${light.paper}`);
});

test('a saved choice wins over the phone, from the first screen on', async () => {
  mockSaved = 'dark';
  expect(await renderProbe()).toBe(`dark dark ${dark.paper}`);
});
