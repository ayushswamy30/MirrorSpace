import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { kv } from './db/kv';

/**
 * Your own photo, for your profile. Picked from the phone's library, cropped
 * square, and kept on this phone only — it is never uploaded. Your circle
 * sees the drawing you chose, not the photo.
 *
 * On a phone the picture is copied into the app's own files (the picker's
 * copy can be cleared by the system); in a browser it is kept as a data URL,
 * since a blob URL doesn't outlive the page.
 */

const KEY = 'profile.photo';
const NAME = 'profile-photo.jpg';

const listeners = new Set<(uri: string | null) => void>();

function announce(uri: string | null) {
  listeners.forEach(l => l(uri));
}

export async function loadPhoto(): Promise<string | null> {
  return (await kv.get(KEY)) ?? null;
}

/** Opens the library; resolves to the kept photo, or null if nothing was chosen. */
export async function pickPhoto(): Promise<string | null> {
  const web = Platform.OS === 'web';
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
    base64: web
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];

  let uri: string;
  if (web) {
    uri = asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset.uri;
  } else {
    const kept = new File(Paths.document, NAME);
    if (kept.exists) kept.delete();
    await new File(asset.uri).copy(kept);
    // A new name each time, so an image cache never shows the old face.
    uri = `${kept.uri}?v=${Date.now()}`;
  }
  await kv.set(KEY, uri);
  announce(uri);
  return uri;
}

export async function removePhoto(): Promise<void> {
  if (Platform.OS !== 'web') {
    const kept = new File(Paths.document, NAME);
    if (kept.exists) kept.delete();
  }
  await kv.remove(KEY);
  announce(null);
}

/** The photo, kept in step across every screen that shows it. */
export function usePhoto(): string | null {
  const [uri, setUri] = useState<string | null>(null);
  const update = useCallback((next: string | null) => setUri(next), []);
  useEffect(() => {
    let live = true;
    loadPhoto().then(u => live && setUri(u), () => undefined);
    listeners.add(update);
    return () => {
      live = false;
      listeners.delete(update);
    };
  }, [update]);
  return uri;
}
