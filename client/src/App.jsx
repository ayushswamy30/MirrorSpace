import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import { useUser } from './context/useUser';
import ParticleField from './components/ambient/ParticleField';
import GradientOrbs from './components/ambient/GradientOrbs';
import Onboarding from './components/onboarding/Onboarding';
import Home from './pages/Home';
import VentItOut from './pages/VentItOut';
import Sleep from './pages/Sleep';
import Chat from './pages/Chat';
import CalmMode from './pages/CalmMode';
import VoiceChat from './pages/VoiceChat';
import Patterns from './pages/Patterns';
import Account from './pages/Account';
import AuthCallback from './pages/AuthCallback';
import HomeButton from './components/HomeButton';
import './styles/global.css';

function AppContent() {
  const { user, loading, offline } = useUser();
  const location = useLocation();
  const [dismissedOnboarding, setDismissedOnboarding] = useState(false);

  // Derived rather than stored in an effect: the only thing that can dismiss
  // onboarding besides finishing it is the auth callback, which has to be able
  // to render while the profile is still loading.
  const isAuthCallback = location.pathname === '/auth/callback';
  const showOnboarding =
    !isAuthCallback && !dismissedOnboarding && Boolean(user) && !user.onboardingComplete;

  if (isAuthCallback) {
    return (
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Routes>
    );
  }

  if (loading) {
    return (
      <div className="page-centered">
        <p className="mono" style={{ opacity: 0.3 }}>entering mirrorspace...</p>
      </div>
    );
  }

  // No session at all. Almost always means anonymous sign-ins are turned off
  // for the Supabase project, which would otherwise present as a blank app.
  if (offline && !user) {
    return (
      <div className="page-centered">
        <div style={{ textAlign: 'center', maxWidth: '34ch' }}>
          <p className="mono" style={{ opacity: 0.5, lineHeight: 1.8 }}>
            couldn&apos;t open your space.
          </p>
          <p className="mono" style={{ opacity: 0.3, fontSize: '0.7rem', marginTop: '16px', lineHeight: 1.8 }}>
            the connection to the server failed. check back in a moment.
          </p>
          <button
            className="btn-ghost"
            style={{ marginTop: '32px' }}
            onClick={() => window.location.reload()}
          >
            try again
          </button>
        </div>
      </div>
    );
  }

  if (showOnboarding) {
    return <Onboarding onComplete={() => setDismissedOnboarding(true)} />;
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/vent" element={<VentItOut />} />
      <Route path="/sleep" element={<Sleep />} />
      <Route path="/chat" element={<Chat />} />
      <Route path="/voice" element={<VoiceChat />} />
      <Route path="/patterns" element={<Patterns />} />
      <Route path="/calm" element={<CalmMode />} />
      <Route path="/account" element={<Account />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <UserProvider>
        {/* Ambient background — always present */}
        <ParticleField />
        <GradientOrbs />
        
        {/* Global home button */}
        <HomeButton />
        
        {/* App content */}
        <AppContent />
      </UserProvider>
    </Router>
  );
}
