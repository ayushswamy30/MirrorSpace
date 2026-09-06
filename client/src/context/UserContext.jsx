import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { supabase, AUTH_REDIRECT_URL } from '../lib/supabase';
import { UserContext } from './UserContextValue.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export function UserProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  // StrictMode mounts effects twice in development; without this the app would
  // create two anonymous accounts on first load.
  const bootstrapped = useRef(false);

  const api = useMemo(() => {
    const instance = axios.create({ baseURL: API_URL });

    instance.interceptors.request.use(async (config) => {
      // Ask the client for the session rather than caching the token here:
      // getSession refreshes it when it is close to expiring, so a long
      // journalling session never fails on a stale token.
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        config.headers.Authorization = `Bearer ${data.session.access_token}`;
      }
      return config;
    });

    return instance;
  }, []);

  /** Pull this app's profile for the current Supabase session. */
  const loadProfile = useCallback(async () => {
    try {
      const { data } = await api.get('/user/profile');
      setUser(data);
      setOffline(false);
      return data;
    } catch (error) {
      console.error('Profile load failed:', error);
      // The API is unreachable but the session is real. Fall back to whatever
      // onboarding state we remember so the app still opens.
      setOffline(true);
      setUser(prev => prev ?? {
        id: null,
        email: null,
        isAnonymous: true,
        onboardingComplete: localStorage.getItem('mirrorspace_onboarding') === 'true',
        intents: JSON.parse(localStorage.getItem('mirrorspace_intents') || '[]'),
        permissions: JSON.parse(localStorage.getItem('mirrorspace_permissions') || '{}')
      });
      return null;
    }
  }, [api]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    // Everyone gets a session immediately — anonymous if they have none yet.
    // There is no sign-in wall; an account is something you add later.
    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) {
          console.error('Anonymous sign-in failed:', error);
          setOffline(true);
          setLoading(false);
          return;
        }
      }
    };

    bootstrap();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      setSession(nextSession);

      if (!nextSession) {
        // Signing out drops you back into a fresh anonymous space rather than
        // a locked door.
        setUser(null);
        if (event === 'SIGNED_OUT') await supabase.auth.signInAnonymously();
        return;
      }

      // TOKEN_REFRESHED fires often and changes nothing about who you are.
      if (event !== 'TOKEN_REFRESHED') {
        await loadProfile();
      }

      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, [loadProfile]);

  const completeOnboarding = async (intents, permissions) => {
    // Remembered locally too, so the flow is not repeated if the API is down.
    localStorage.setItem('mirrorspace_onboarding', 'true');
    localStorage.setItem('mirrorspace_intents', JSON.stringify(intents));
    localStorage.setItem('mirrorspace_permissions', JSON.stringify(permissions));

    try {
      const { data } = await api.put('/user/onboarding', { intents, permissions });
      setUser(data);
    } catch (error) {
      console.error('Onboarding save failed:', error);
      setUser(prev => ({ ...prev, onboardingComplete: true, intents, permissions }));
    }
  };

  /**
   * Attach an email to the current anonymous account. Supabase sends a
   * confirmation link; the account keeps its id, so nothing written so far is
   * lost. This is deliberately updateUser and not a fresh sign-in, which
   * would strand the anonymous data behind a different user.
   */
  const linkEmail = async (email) => {
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: AUTH_REDIRECT_URL }
    );
    if (error) throw error;
  };

  /** Attach a Google identity to the current anonymous account. */
  const linkGoogle = async () => {
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: AUTH_REDIRECT_URL }
    });
    if (error) throw error;
  };

  /**
   * Sign in to an account that already exists — a returning user on a new
   * device. This replaces the current anonymous session, which is the point.
   */
  const signInWithEmail = async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: AUTH_REDIRECT_URL,
        // Restoring an existing space must not quietly create a new empty one
        // because of a typo — an unknown address should fail, not sign up.
        shouldCreateUser: false
      }
    });
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: AUTH_REDIRECT_URL }
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = {
    user,
    session,
    loading,
    offline,
    api,
    isAnonymous: user?.isAnonymous !== false,
    email: user?.email ?? null,
    completeOnboarding,
    refreshProfile: loadProfile,
    linkEmail,
    linkGoogle,
    signInWithEmail,
    signInWithGoogle,
    signOut
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
