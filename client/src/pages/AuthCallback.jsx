import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/useUser';

/**
 * Landing point for magic-link and OAuth redirects.
 *
 * The Supabase client is configured with detectSessionInUrl, so it exchanges
 * the code in the URL for a session on its own. All this page does is wait for
 * that to land, refresh the app profile so the new email shows immediately,
 * and get out of the way.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const { refreshProfile } = useUser();
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const finish = async () => {
      // Supabase reports redirect failures in the URL fragment.
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const urlError = params.get('error_description') || params.get('error');
      if (urlError) {
        if (!cancelled) setError(urlError);
        return;
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (cancelled) return;

      if (sessionError || !data.session) {
        setError(sessionError?.message || 'That link has expired. Ask for a new one.');
        return;
      }

      await refreshProfile();
      if (!cancelled) navigate('/', { replace: true });
    };

    finish();
    return () => { cancelled = true; };
  }, [navigate, refreshProfile]);

  return (
    <div className="page-centered">
      {error ? (
        <div style={{ textAlign: 'center', maxWidth: '32ch' }}>
          <p className="mono" style={{ opacity: 0.6 }}>{error}</p>
          <button className="btn-ghost" style={{ marginTop: '24px' }} onClick={() => navigate('/account')}>
            try again
          </button>
        </div>
      ) : (
        <p className="mono" style={{ opacity: 0.3 }}>finishing up...</p>
      )}
    </div>
  );
}
