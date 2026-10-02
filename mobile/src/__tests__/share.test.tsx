import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import { ReadingCard, ShareButton } from '@/components/ShareCard';
import { ThemeProvider } from '@/theme/ThemeProvider';

jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(() => Promise.resolve(true)), shareAsync: jest.fn(() => Promise.resolve()) }));

const reading = { headline: 'Let it be easy.', subtext: '', dos: ['Daylight'], donts: ['Overbooking'] };

test('sharing makes a story-sized card and opens the share sheet', async () => {
  render(
    <ThemeProvider>
      <ShareButton label="share today’s reading" card={<ReadingCard reading={reading} art="swan" date="Fri, Oct 2" />} />
    </ThemeProvider>
  );
  await act(async () => {});
  // The card is drawn, off screen, in the print style.
  expect(screen.getByText('Let it be easy.', { includeHiddenElements: true })).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'share today’s reading' }));
  await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///card.png', expect.objectContaining({ mimeType: 'image/png' })));
  expect(captureRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ width: 1080, height: 1920 }));
});
