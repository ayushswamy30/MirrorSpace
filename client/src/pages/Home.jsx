import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useUser } from '../context/useUser';
import { useNavigate } from 'react-router-dom';
import './Home.css';

export default function Home() {
  const { api, isAnonymous, email } = useUser();
  const navigate = useNavigate();
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('morning');
    else if (hour < 17) setGreeting('afternoon');
    else if (hour < 21) setGreeting('evening');
    else setGreeting('night');
  }, []);

  useEffect(() => {
    const fetchInsight = async () => {
      try {
        const { data } = await api.get('/insights/today');
        setInsight(data);
      } catch {
        setInsight({
          headline: "Be still for a moment.\nNot every day needs a reflection.",
          subtext: null
        });
      } finally {
        setLoading(false);
      }
    };
    fetchInsight();
  }, [api]);

  const modules = [
    { id: 'vent', label: 'Vent It Out', desc: 'write or scream into the void', path: '/vent' },
    { id: 'sleep', label: 'Sleep', desc: 'log last night', path: '/sleep' },
    { id: 'chat', label: 'Talk to Mirror', desc: 'a quiet conversation', path: '/chat' },
    { id: 'voice', label: 'Voice Mirror', desc: 'speak your mind', path: '/voice' },
    { id: 'patterns', label: 'Prediction Center', desc: 'view my patterns', path: '/patterns', accent: 'full-width' },
    { id: 'calm', label: 'I feel anxious', desc: null, path: '/calm', accent: 'calm' }
  ];

  return (
    <div className="home page-container">
      {/* Daily Insight — The hero */}
      <motion.section 
        className="insight-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <span className="mono insight-time">
          {greeting !== 'night' ? `good ${greeting}` : 'the night is here'}
        </span>

        {loading ? (
          <div className="insight-loading">
            <div className="insight-skeleton" />
            <div className="insight-skeleton short" />
          </div>
        ) : (
          <>
            <h1 className="insight-headline">
              {insight?.headline?.split('\n').map((line, i) => (
                <motion.span
                  key={i}
                  className="insight-line"
                  initial={{ opacity: 0, y: 8, filter: 'blur(2px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ delay: 0.3 + i * 0.25, duration: 0.7 }}
                >
                  {line}
                </motion.span>
              ))}
            </h1>
            {insight?.subtext && (
              <motion.p 
                className="insight-subtext mono"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2, duration: 0.6 }}
              >
                {insight.subtext}
              </motion.p>
            )}
          </>
        )}
      </motion.section>

      {/* Modules */}
      <motion.section 
        className="modules-section"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.6 }}
      >
        <div className="modules-grid">
          {modules.map((mod, i) => (
            <motion.button
              key={mod.id}
              className={`module-card ${mod.accent || ''}`}
              onClick={() => navigate(mod.path)}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 + i * 0.1, duration: 0.5 }}
              whileHover={{ y: -2, transition: { duration: 0.2 } }}
            >
              <span className="module-label">{mod.label}</span>
              {mod.desc && <span className="module-desc mono">{mod.desc}</span>}
            </motion.button>
          ))}
        </div>
        
        {/* Account: anonymous by default, claimable whenever they want */}
        <div className="home-account">
          {isAnonymous ? (
            <button className="home-account-link mono" onClick={() => navigate('/account')}>
              this space lives only in this browser — save it
            </button>
          ) : (
            <button className="home-account-link mono" onClick={() => navigate('/account')}>
              signed in as {email}
            </button>
          )}
        </div>
      </motion.section>
    </div>
  );
}
