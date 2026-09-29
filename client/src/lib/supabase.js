import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Browser Supabase client. Only ever holds the publishable anon key, which is
 * designed to be public — every table denies that key outright, so a session
 * is required for anything at all, and Row Level Security then narrows that
 * session to its own rows.
 *
 * The session lives in localStorage and the access token refreshes in the
 * background, so a returning user is signed in before the first render.
 *
 * Note: these values are inlined by Vite at build time, so a missing one is a
 * build problem, not a runtime one. vite.config.js checks for them and fails
 * the build — deliberately, because a module-level `throw` here would be
 * statically true and let the minifier drop the whole app as unreachable.
 */
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Completes magic-link and OAuth redirects by exchanging the code in the
    // URL for a session, so we never parse it ourselves.
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

export const AUTH_REDIRECT_URL = `${window.location.origin}/auth/callback`;
