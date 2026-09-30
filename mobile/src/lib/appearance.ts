import * as SecureStore from 'expo-secure-store';

/**
 * Light, dark, or the phone's own setting. Kept outside the encrypted
 * database on purpose: the theme is needed before that opens (and behind the
 * app lock), and it says nothing about the person.
 */
export type Appearance = 'system' | 'light' | 'dark';

const KEY = 'mirrorspace.appearance';

function isAppearance(value: unknown): value is Appearance {
  return value === 'system' || value === 'light' || value === 'dark';
}

export async function loadAppearance(): Promise<Appearance> {
  try {
    const saved = await SecureStore.getItemAsync(KEY);
    return isAppearance(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

export async function saveAppearance(appearance: Appearance): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, appearance);
  } catch (err) {
    // The choice still applies for this session; it just won't be remembered.
    console.warn('Appearance not saved:', err);
  }
}
