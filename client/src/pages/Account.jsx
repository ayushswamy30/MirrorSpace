import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/useUser';
import './Account.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Account() {
  const { isAnonymous, email, linkEmail, linkGoogle, signInWithEmail, signInWithGoogle, signOut } = useUser();
  const navigate = useNavigate();

  // 'save' attaches an identity to the space you are already in.
  // 'restore' abandons it and opens one that already exists elsewhere.
  const [mode, setMode] = useState('save');
  const [input, setInput] = useState('');
  const [status, setStatus] = useState(null); // 'sending' | 'sent' | 'error'
  const [error, setError] = useState(null);

  const restoring = mode === 'restore';

  const submitEmail = async (e) => {
    e.preventDefault();
    if (!EMAIL_PATTERN.test(input.trim())) {
      setError('That does not look like an email address.');
      setStatus('error');
      return;
    }

    setStatus('sending');
    setError(null);
    try {
      await (restoring ? signInWithEmail(input.trim()) : linkEmail(input.trim()));
      setStatus('sent');
    } catch (err) {
      setError(err?.message || 'Something did not go through. Try again in a moment.');
      setStatus('error');
    }
  };

  const withGoogle = async () => {
    setError(null);
    try {
      await (restoring ? signInWithGoogle() : linkGoogle());
    } catch (err) {
      setError(err?.message || 'Google sign-in is unavailable right now.');
      setStatus('error');
    }
  };

  // Already has an identity — nothing to claim.
  if (!isAnonymous) {
    return (
      <div className="account page-container">
        <motion.div
          className="account-inner"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="account-header">
            <h2 className="account-title">Your space</h2>
            <p className="mono account-hint">this room has a key now</p>
          </div>

          <div className="account-identity">
            <span className="mono account-label">signed in as</span>
            <p className="account-email">{email}</p>
            <p className="mono account-note">
              Your entries follow you to any device you open this on.
            </p>
          </div>

          <div className="account-actions">
            <button className="btn-ghost" onClick={() => navigate('/')}>go back</button>
            <button
              className="btn-ghost account-signout"
              onClick={async () => { await signOut(); navigate('/'); }}
            >
              sign out
            </button>
          </div>

          <p className="mono account-signout-note">
            Signing out opens a new, empty space on this device. Nothing you have
            written is deleted — sign back in to find it again.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="account page-container">
      <motion.div
        className="account-inner"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="account-header">
          <h2 className="account-title">{restoring ? 'Find your space' : 'Save your space'}</h2>
          <p className="mono account-hint">
            {restoring
              ? 'open the one you already have'
              : 'so it survives a cleared browser'}
          </p>
        </div>

        <p className="account-blurb">
          {restoring
            ? 'Sign in and your existing entries come back. What you have written in this session stays behind.'
            : 'Right now this space lives only in this browser. Attach an email or a Google account and it follows you — same entries, same patterns, nothing lost.'}
        </p>

        <AnimatePresence mode="wait">
          {status === 'sent' ? (
            <motion.div
              key="sent"
              className="account-sent"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <p className="account-sent-title">Check your inbox.</p>
              <p className="mono account-sent-note">
                We sent a link to {input.trim()}. Opening it finishes this.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* noValidate so the field still gets an email keyboard on mobile,
                  but validation failures surface in the app's own voice rather
                  than a native browser bubble. */}
              <form className="account-form" onSubmit={submitEmail} noValidate>
                <label className="mono account-label" htmlFor="account-email">email</label>
                <input
                  id="account-email"
                  className="account-input"
                  type="email"
                  autoComplete="email"
                  placeholder="you@somewhere.com"
                  value={input}
                  onChange={(e) => { setInput(e.target.value); setStatus(null); setError(null); }}
                  disabled={status === 'sending'}
                />
                <button className="btn-primary account-submit" type="submit" disabled={status === 'sending'}>
                  {status === 'sending' ? 'sending...' : 'send me a link'}
                </button>
              </form>

              <div className="account-divider"><span className="mono">or</span></div>

              <button className="btn-ghost account-google" onClick={withGoogle}>
                continue with Google
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {error && <p className="mono account-error">{error}</p>}

        <div className="account-switch">
          <button
            className="account-link"
            onClick={() => { setMode(restoring ? 'save' : 'restore'); setStatus(null); setError(null); }}
          >
            {restoring ? 'actually, save this space instead' : 'I already have a space'}
          </button>
          <button className="account-link" onClick={() => navigate('/')}>not now</button>
        </div>
      </motion.div>
    </div>
  );
}
