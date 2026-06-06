import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider, useUser } from './context/UserContext';
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
import HomeButton from './components/HomeButton';
import './styles/global.css';

function AppContent() {
  const { user, loading } = useUser();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      setShowOnboarding(!user.onboardingComplete);
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="page-centered">
        <p className="mono" style={{ opacity: 0.3 }}>entering mirrorspace...</p>
      </div>
    );
  }

  if (showOnboarding) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />;
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
