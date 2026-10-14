/**
 * The phone app shares cards with react-native-view-shot and expo-sharing
 * (ShareCard.tsx); this is only the web app's way (shareImage.web.ts).
 */

export const canShareImages = false;

export type ShareResult = 'shared' | 'saved' | 'cancelled' | 'needs-tap';

export async function renderCard(_node: unknown, _paper: string): Promise<Blob> {
  throw new Error('Cards are drawn this way only on the web');
}

export async function shareImage(_blob: Blob, _name?: string): Promise<ShareResult> {
  throw new Error('Cards are shared this way only on the web');
}
