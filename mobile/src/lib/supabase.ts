import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { config } from './config';
import { kv } from './db/kv';

/**
 * The session (access + refresh token) is persisted in the encrypted local
 * database, not in plain AsyncStorage or the unencrypted expo-sqlite
 * localStorage shim: a refresh token is a standing key to someone's journal.
 */
const encryptedStorage: SupportedStorage = {
  getItem: key => kv.get(`supabase:${key}`),
  setItem: (key, value) => kv.set(`supabase:${key}`, value),
  removeItem: key => kv.remove(`supabase:${key}`)
};

export const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: {
    storage: encryptedStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

// Refresh only while the app is in the foreground, so a backgrounded app is
// not waking the radio to rotate tokens.
AppState.addEventListener('change', state => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
