import { useState } from 'react';
import { motion } from 'framer-motion';
import { useUser } from '../context/useUser';
import { useNavigate } from 'react-router-dom';
import './VentItOut.css';

export default function VentItOut() {
  const { api } = useUser();
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [mode, setMode] = useState('text'); // 'text' or 'chaos'
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await api.post('/journal', { content, type: mode });
      setSaved(true);
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="vent page-centered">
        <motion.div
          className="vent-saved"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="vent-saved-text">
            It's out now.
            <br />
            <span className="vent-saved-sub">You don't have to carry it.</span>
          </h2>
          <p className="mono vent-saved-note">
            a reflection may come later — not now
          </p>
          <button className="btn-primary" onClick={() => navigate('/')} style={{ marginTop: '40px' }}>
            Return
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="vent page-container">
      <motion.div
        className="vent-inner"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Header */}
        <div className="vent-header">
          <h2 className="vent-title">Vent It Out</h2>
          <p className="mono vent-hint">no one is watching. no one is grading.</p>
        </div>

        {/* Mode Toggle */}
        <div className="vent-modes">
          <button 
            className={`vent-mode ${mode === 'text' ? 'active' : ''}`}
            onClick={() => setMode('text')}
          >
            structured
          </button>
          <button 
            className={`vent-mode ${mode === 'chaos' ? 'active' : ''}`}
            onClick={() => setMode('chaos')}
          >
            chaos
          </button>
        </div>

        {/* Writing Area */}
        <div className="vent-area">
          <textarea
            className={`vent-textarea ${mode === 'chaos' ? 'chaos-mode' : ''}`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={mode === 'chaos' 
              ? "let it out. no rules. no punctuation needed. just words..." 
              : "write whatever comes to mind..."}
            autoFocus
          />
        </div>

        {/* Actions */}
        <div className="vent-actions">
          <span className="mono vent-wordcount">
            {content.split(/\s+/).filter(w => w.length > 0).length} words
          </span>
          <button 
            className="btn-primary"
            onClick={handleSave}
            disabled={!content.trim() || saving}
          >
            {saving ? 'releasing...' : 'let it go'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
