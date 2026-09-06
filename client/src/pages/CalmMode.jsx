import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/useUser';
import ambientSounds from '../utils/ambientSounds';
import './CalmMode.css';

const SOUNDS = [
  { id: 'rain', label: 'Rain', icon: '🌧', color: '#4a6d7c' },
  { id: 'ocean', label: 'Ocean Waves', icon: '🌊', color: '#2d5f6e' },
  { id: 'thunder', label: 'Rain & Thunder', icon: '⛈', color: '#3a4a5c' },
  { id: 'fireplace', label: 'Fireplace', icon: '🔥', color: '#7a4a2a' },
  { id: 'stream', label: 'Running Water', icon: '💧', color: '#3a6a5c' },
  { id: 'wind', label: 'Wind', icon: '🍃', color: '#4a5a4a' },
  { id: 'whitenoise', label: 'White Noise', icon: '◻', color: '#5a5a5a' },
  { id: 'synth', label: 'Synth Pad', icon: '✧', color: '#5a4a6a' },
  { id: 'drone', label: 'Deep Hum', icon: '◎', color: '#4a3a2a' },
  { id: 'binaural', label: 'REM Sleep', icon: '🌙', color: '#3a3a5a' }
];

export default function CalmMode() {
  const navigate = useNavigate();
  const { api } = useUser();
  const [phase, setPhase] = useState('entering');
  const [breathPhase, setBreathPhase] = useState('inhale');
  const [activeSound, setActiveSound] = useState(null);
  const breathTimer = useRef(null);

  useEffect(() => {
    api.post('/calm/trigger', { source: 'manual' }).catch(() => {});
  }, [api]);

  useEffect(() => {
    const timer = setTimeout(() => setPhase('breathing'), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Breathing cycle: 4s inhale, 4s hold, 6s exhale
  useEffect(() => {
    if (phase !== 'breathing') return;

    const cycle = () => {
      setBreathPhase('inhale');
      breathTimer.current = setTimeout(() => {
        setBreathPhase('hold');
        breathTimer.current = setTimeout(() => {
          setBreathPhase('exhale');
          breathTimer.current = setTimeout(cycle, 6000);
        }, 4000);
      }, 4000);
    };

    cycle();
    return () => clearTimeout(breathTimer.current);
  }, [phase]);

  const handleSoundToggle = async (soundId) => {
    if (activeSound === soundId) {
      await ambientSounds.stopAll();
      setActiveSound(null);
    } else {
      await ambientSounds.play(soundId);
      setActiveSound(soundId);
    }
  };

  const handleExit = async () => {
    await ambientSounds.stopAll(1);
    setPhase('entering');
    setTimeout(() => navigate('/'), 600);
  };

  return (
    <div className="calm-mode">
      <div className="calm-gradient" />

      {/* Breathing Section */}
      <AnimatePresence>
        {phase !== 'entering' && (
          <motion.div
            className="calm-breathing-section"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
          >
            <div className={`breathing-circle ${breathPhase}`}>
              <div className="breathing-inner" />
              <div className="breathing-ring" />
              <div className="breathing-ring ring-2" />
            </div>

            <motion.p 
              className="calm-text"
              key={breathPhase}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}
            >
              {breathPhase === 'inhale' && '...'}
              {breathPhase === 'hold' && ''}
              {breathPhase === 'exhale' && '...'}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audio Section */}
      <AnimatePresence>
        {phase !== 'entering' && (
          <motion.div
            className="calm-audio-section"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 1 }}
          >
            <p className="mono calm-audio-label">ambient sounds</p>
            <div className="calm-audio-grid">
              {SOUNDS.map(sound => (
                <button
                  key={sound.id}
                  className={`calm-sound-card ${activeSound === sound.id ? 'active' : ''}`}
                  onClick={() => handleSoundToggle(sound.id)}
                  style={{
                    '--sound-color': sound.color,
                    '--sound-glow': `${sound.color}40`
                  }}
                >
                  {/* Visual animation when playing */}
                  {activeSound === sound.id && (
                    <div className="sound-visual">
                      <div className="sound-wave-container">
                        {[...Array(5)].map((_, i) => (
                          <span 
                            key={i} 
                            className="sound-wave-line"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <span className="sound-icon">{sound.icon}</span>
                  <span className="sound-label">{sound.label}</span>
                  {activeSound === sound.id && (
                    <span className="sound-playing mono">playing</span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exit */}
      <button className="calm-exit" onClick={handleExit}>
        ← leave gently
      </button>
    </div>
  );
}
