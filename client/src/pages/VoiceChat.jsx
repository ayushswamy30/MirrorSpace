import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../context/useUser';
import './VoiceChat.css';

// Resolved once: these are browser globals that never change for the life of
// the page, so they do not belong in a hook dependency list.
const SpeechRecognition =
  typeof window === 'undefined'
    ? null
    : window.SpeechRecognition || window.webkitSpeechRecognition;

const STATES = {
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  SPEAKING: 'speaking'
};

export default function VoiceChat() {
  const { api } = useUser();
  const [state, setState] = useState(STATES.IDLE);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  // Check for browser support
  const supported = !!SpeechRecognition;

  const stopSpeaking = useCallback(() => {
    synthRef.current.cancel();
    setState(STATES.IDLE);
  }, []);

  const speak = useCallback((text) => {
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configure voice
    const voices = synthRef.current.getVoices();
    const preferred = voices.find(v => 
      v.name.includes('Google') && v.lang.startsWith('en')
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
    
    if (preferred) utterance.voice = preferred;
    utterance.rate = 0.9;
    utterance.pitch = 0.95;
    utterance.volume = 0.85;

    utterance.onstart = () => setState(STATES.SPEAKING);
    utterance.onend = () => setState(STATES.IDLE);
    utterance.onerror = () => setState(STATES.IDLE);

    synthRef.current.speak(utterance);
  }, []);

  const sendToMirror = useCallback(async (text) => {
    setState(STATES.PROCESSING);
    try {
      const { data } = await api.post('/chat/message', {
        message: text,
        sessionId
      });
      setSessionId(data.sessionId);
      setResponse(data.response);
      speak(data.response);
    } catch {
      const fallback = "I'm here. Sometimes silence speaks louder than words.";
      setResponse(fallback);
      speak(fallback);
    }
  }, [api, sessionId, speak]);

  const startListening = useCallback(() => {
    if (!supported) return;

    stopSpeaking();
    setTranscript('');
    setResponse('');

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setState(STATES.LISTENING);
    
    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(final || interim);
      
      if (final) {
        sendToMirror(final);
      }
    };

    recognition.onend = () => {
      if (state === STATES.LISTENING) {
        // If we're still in listening state (no final result), check if we have transcript
        if (transcript) {
          sendToMirror(transcript);
        } else {
          setState(STATES.IDLE);
        }
      }
    };

    recognition.onerror = (e) => {
      console.error('Speech recognition error:', e.error);
      setState(STATES.IDLE);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [supported, stopSpeaking, sendToMirror, state, transcript]);

  const handleMainButton = () => {
    if (state === STATES.IDLE) {
      startListening();
    } else if (state === STATES.LISTENING) {
      recognitionRef.current?.stop();
    } else if (state === STATES.SPEAKING) {
      stopSpeaking();
    }
  };

  // Cleanup
  useEffect(() => {
    // Captured now rather than read in the cleanup: by then the ref could point
    // somewhere else. recognitionRef is deliberately read late, because the
    // recognition instance is replaced on every listen and we want the current
    // one aborted.
    const synth = synthRef.current;
    return () => {
      recognitionRef.current?.abort();
      synth.cancel();
    };
  }, []);

  const stateLabels = {
    [STATES.IDLE]: 'tap to speak',
    [STATES.LISTENING]: 'listening...',
    [STATES.PROCESSING]: 'reflecting...',
    [STATES.SPEAKING]: 'speaking...'
  };

  return (
    <div className="voice-chat page-container">
      <div className="voice-header">
        <h2 className="voice-title">Voice Mirror</h2>
        <p className="mono voice-hint">speak your mind. hear it reflected.</p>
      </div>

      <div className="voice-main">
        {/* Circular UI */}
        <div className="voice-circle-container">
          {/* Ripple rings */}
          <AnimatePresence>
            {(state === STATES.LISTENING || state === STATES.SPEAKING) && (
              <>
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={`ring-${i}`}
                    className={`voice-ring ${state}`}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ 
                      scale: [1, 1.4 + i * 0.2], 
                      opacity: [0.3, 0] 
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.5,
                      ease: 'easeOut'
                    }}
                  />
                ))}
              </>
            )}
          </AnimatePresence>

          {/* Main button */}
          <motion.button
            className={`voice-button ${state}`}
            onClick={handleMainButton}
            whileTap={{ scale: 0.95 }}
            animate={state === STATES.PROCESSING ? {
              scale: [1, 1.05, 1],
              transition: { duration: 1.5, repeat: Infinity }
            } : {}}
            disabled={!supported}
          >
            {state === STATES.IDLE && (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
            {state === STATES.LISTENING && (
              <div className="voice-waves">
                {[0,1,2,3,4].map(i => (
                  <span key={i} className="voice-wave-bar" style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            )}
            {state === STATES.PROCESSING && (
              <div className="voice-processing-dots">
                <span /><span /><span />
              </div>
            )}
            {state === STATES.SPEAKING && (
              <div className="voice-speaking-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              </div>
            )}
          </motion.button>
        </div>

        {/* State label */}
        <p className="mono voice-state">{stateLabels[state]}</p>

        {/* Transcript */}
        <AnimatePresence>
          {transcript && (
            <motion.div
              className="voice-transcript"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <span className="mono voice-label">you said</span>
              <p className="voice-text">{transcript}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Response */}
        <AnimatePresence>
          {response && (
            <motion.div
              className="voice-response"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <span className="mono voice-label mirror-label">mirror</span>
              <p className="voice-text mirror-text">{response}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!supported && (
        <p className="mono voice-unsupported">
          voice input isn't supported in this browser. try Chrome.
        </p>
      )}
    </div>
  );
}
