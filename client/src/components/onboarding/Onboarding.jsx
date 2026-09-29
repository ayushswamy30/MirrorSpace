import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../../context/useUser';
import './Onboarding.css';

const pageVariants = {
  enter: { opacity: 0, y: 20, filter: 'blur(4px)' },
  center: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -15, filter: 'blur(4px)' }
};

const pageTransition = {
  duration: 0.6,
  ease: [0.25, 0.46, 0.45, 0.94]
};

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [intents, setIntents] = useState([]);
  const [permissions, setPermissions] = useState({
    sleepTracking: false,
    journaling: false,
    chatReflections: false
  });
  const { completeOnboarding } = useUser();

  const intentOptions = [
    { id: 'understand_mind', label: 'Understand my mind' },
    { id: 'reduce_anxiety', label: 'Reduce anxiety & panic' },
    { id: 'sleep_better', label: 'Sleep better' },
    { id: 'vent_without_judgment', label: 'Vent without judgment' }
  ];

  const toggleIntent = (id) => {
    setIntents(prev => {
      if (prev.includes(id)) return prev.filter(i => i !== id);
      return [...prev, id];
    });
  };

  const togglePermission = (key) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFinish = async () => {
    await completeOnboarding(intents, permissions);
    onComplete();
  };

  return (
    <div className="onboarding">
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="welcome"
            className="onboarding-screen"
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={pageTransition}
          >
            <div className="onboarding-content">
              <motion.h1 
                className="onboarding-title"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.8 }}
              >
                This app doesn't ask<br />who you are.
              </motion.h1>
              <motion.p
                className="onboarding-subtitle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.8 }}
              >
                It notices how you move through days.
              </motion.p>
            </div>
            <motion.button
              className="btn-primary onboarding-btn"
              onClick={() => setStep(1)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4, duration: 0.6 }}
            >
              Continue
            </motion.button>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="intent"
            className="onboarding-screen"
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={pageTransition}
          >
            <div className="onboarding-content">
              <h2 className="onboarding-question">What brings you here?</h2>
              <p className="onboarding-hint mono">choose what resonates</p>
              <div className="intent-grid">
                {intentOptions.map((option) => (
                  <button
                    key={option.id}
                    className={`intent-option ${intents.includes(option.id) ? 'selected' : ''}`}
                    onClick={() => toggleIntent(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="onboarding-actions">
              <button className="btn-ghost" onClick={() => setStep(0)}>Back</button>
              <button 
                className="btn-primary onboarding-btn"
                onClick={() => setStep(2)}
                disabled={intents.length === 0}
              >
                Continue
              </button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="permissions"
            className="onboarding-screen"
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={pageTransition}
          >
            <div className="onboarding-content">
              <h2 className="onboarding-question">What feels comfortable?</h2>
              <p className="onboarding-hint mono">no pressure — skip anything</p>
              <div className="permissions-list">
                {[
                  { key: 'sleepTracking', label: 'Sleep tracking', desc: 'Log when you sleep and wake' },
                  { key: 'journaling', label: 'Journaling', desc: 'Write or vent freely' },
                  { key: 'chatReflections', label: 'Chat reflections', desc: 'Reflective conversations' }
                ].map(({ key, label, desc }) => (
                  <button
                    key={key}
                    className={`permission-toggle ${permissions[key] ? 'active' : ''}`}
                    onClick={() => togglePermission(key)}
                  >
                    <div className="permission-info">
                      <span className="permission-label">{label}</span>
                      <span className="permission-desc mono">{desc}</span>
                    </div>
                    <div className={`toggle-switch ${permissions[key] ? 'on' : ''}`}>
                      <div className="toggle-knob" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="onboarding-actions">
              <button className="btn-ghost" onClick={() => setStep(1)}>Back</button>
              <button className="btn-primary onboarding-btn" onClick={handleFinish}>
                Enter MirrorSpace
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
