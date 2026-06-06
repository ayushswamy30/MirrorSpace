import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../context/UserContext';
import './Patterns.css';

export default function Patterns() {
  const { api } = useUser();
  const [pattern, setPattern] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchLatestPattern = async () => {
    try {
      const { data } = await api.get('/patterns');
      if (data && data.length > 0) {
        setPattern(data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch patterns:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestPattern();
  }, []);

  const generatePrediction = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post('/patterns/predict');
      setPattern(data);
    } catch (error) {
      console.error('Failed to generate prediction:', error);
    } finally {
      setGenerating(false);
    }
  };

  const getRiskColor = (value) => {
    if (value < 33) return 'var(--accent-calm)';    // Low risk - teal
    if (value < 66) return 'var(--accent-reflect)'; // Medium - gold
    return 'var(--text-error)';                     // High - red-ish
  };

  if (loading) {
    return (
      <div className="patterns-page page-container">
        <p className="mono" style={{ opacity: 0.5, textAlign: 'center', marginTop: '20vh' }}>
          observing patterns...
        </p>
      </div>
    );
  }

  return (
    <div className="patterns-page page-container">
      <div className="patterns-header">
        <h2 className="patterns-title">Predictions</h2>
        <p className="mono patterns-hint">tracking the tides of your mind</p>
      </div>

      <div className="patterns-content">
        {!pattern && !generating && (
          <div className="patterns-empty">
            <p className="mono">no predictions yet.</p>
            <button className="btn-primary" onClick={generatePrediction}>
              Generate Prediction
            </button>
          </div>
        )}

        {generating && (
          <div className="patterns-empty">
            <div className="patterns-scanning">
              <div className="scanner-line"></div>
            </div>
            <p className="mono">analyzing recent sleep, journals, and chats...</p>
          </div>
        )}

        {pattern && !generating && (
          <motion.div 
            className="patterns-dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* AI Insight Hero */}
            <div className="pattern-insight-card">
              <h3 className="pattern-headline">
                {pattern.aiInsight?.headline || "The system is quiet."}
              </h3>
              <p className="pattern-summary mono">
                {pattern.aiInsight?.summary || "Not enough data gathered to form a deep reflection."}
              </p>
            </div>

            {/* Risk Meters */}
            <div className="pattern-meters">
              
              <div className="meter-card">
                <span className="mono meter-label">burnout risk</span>
                <div className="meter-bar-container">
                  <motion.div 
                    className="meter-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${pattern.patterns.burnoutIndicators}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    style={{ backgroundColor: getRiskColor(pattern.patterns.burnoutIndicators) }}
                  />
                </div>
                <span className="mono meter-value">{pattern.patterns.burnoutIndicators}%</span>
              </div>

              <div className="meter-card">
                <span className="mono meter-label">anxiety buildup</span>
                <div className="meter-bar-container">
                  <motion.div 
                    className="meter-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${pattern.patterns.anxietyBuildUp}%` }}
                    transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                    style={{ backgroundColor: getRiskColor(pattern.patterns.anxietyBuildUp) }}
                  />
                </div>
                <span className="mono meter-value">{pattern.patterns.anxietyBuildUp}%</span>
              </div>

              <div className="meter-card">
                <span className="mono meter-label">emotional drift</span>
                <div className="meter-bar-container">
                  <motion.div 
                    className="meter-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${pattern.patterns.emotionalDrift}%` }}
                    transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
                    style={{ backgroundColor: getRiskColor(pattern.patterns.emotionalDrift) }}
                  />
                </div>
                <span className="mono meter-value">{pattern.patterns.emotionalDrift}%</span>
              </div>
            </div>

            {/* Data sources */}
            <div className="pattern-sources mono">
              Based on {pattern.dataPoints?.sleepLogs || 0} sleep logs, {pattern.dataPoints?.journalEntries || 0} journal entries, and {pattern.dataPoints?.chatSessions || 0} chats this week.
            </div>

            <button 
              className="btn-ghost update-prediction-btn" 
              onClick={generatePrediction}
            >
              refresh analysis
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
