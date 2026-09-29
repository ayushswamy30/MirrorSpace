/**
 * Build-time configuration. EXPO_PUBLIC_* values are inlined into the bundle
 * and are therefore public: only the Supabase publishable (anon) key belongs
 * here, never the service_role key.
 *
 * Expo only inlines `process.env.EXPO_PUBLIC_X` written out in full, so each
 * one is read by name rather than through a helper.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing ${name}. Copy mobile/.env.example to mobile/.env.local and fill it in.`);
  }
  return value.trim().replace(/\/+$/, '');
}

export const config = {
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: required(
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ),
  apiUrl: required('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL),
  /** Development only: open every progressive unlock from day one. */
  unlockAll: process.env.EXPO_PUBLIC_UNLOCK_ALL === '1'
};
