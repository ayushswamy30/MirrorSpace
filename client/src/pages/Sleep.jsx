import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../context/useUser';
import './Sleep.css';

const FILTERS = ['week', 'month', 'year', 'all'];

export default function Sleep() {
  const { api } = useUser();
  const [sleepTime, setSleepTime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sleepData, setSleepData] = useState([]);
  const [filter, setFilter] = useState('week');
  const [showGraph, setShowGraph] = useState(false);
  const canvasRef = useRef(null);

  // Fetch sleep history
  const fetchSleepData = useCallback(async () => {
    try {
      const { data } = await api.get(`/sleep?range=${filter}`);
      setSleepData(data);
      if (data.length > 0) setShowGraph(true);
    } catch {
      // Silently fail
    }
  }, [api, filter]);

  useEffect(() => {
    fetchSleepData();
  }, [fetchSleepData]);

  const calculateDuration = () => {
    const [sh, sm] = sleepTime.split(':').map(Number);
    const [wh, wm] = wakeTime.split(':').map(Number);
    let sleepMins = sh * 60 + sm;
    let wakeMins = wh * 60 + wm;
    if (wakeMins <= sleepMins) wakeMins += 24 * 60;
    const total = wakeMins - sleepMins;
    return { hours: Math.floor(total / 60), minutes: total % 60 };
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const sleepDate = new Date(`${today}T${sleepTime}:00`);
      const wakeDate = new Date(`${today}T${wakeTime}:00`);
      if (wakeDate <= sleepDate) wakeDate.setDate(wakeDate.getDate() + 1);

      await api.post('/sleep', {
        date: today,
        sleepTime: sleepDate.toISOString(),
        wakeTime: wakeDate.toISOString()
      });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        fetchSleepData();
      }, 2000);
    } catch (error) {
      console.error('Sleep save error:', error);
    } finally {
      setSaving(false);
    }
  };

  // Draw sleep graph on canvas
  useEffect(() => {
    if (!canvasRef.current || sleepData.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const padding = { top: 30, right: 20, bottom: 40, left: 45 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    // Parse durations
    const durations = sleepData.map(entry => {
      const sleep = new Date(entry.sleepTime);
      const wake = new Date(entry.wakeTime);
      return (wake - sleep) / (1000 * 60 * 60); // hours
    });

    const dates = sleepData.map(entry => {
      const d = new Date(entry.date);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });

    const maxHours = Math.max(12, ...durations);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      // Y labels
      const hrs = maxHours - (maxHours / 4) * i;
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${hrs.toFixed(0)}h`, padding.left - 8, y + 3);
    }

    // Draw bars
    const barWidth = Math.min(30, (chartW / durations.length) * 0.6);
    const gap = (chartW - barWidth * durations.length) / (durations.length + 1);

    durations.forEach((hrs, i) => {
      const x = padding.left + gap + (barWidth + gap) * i;
      const barH = (hrs / maxHours) * chartH;
      const y = padding.top + chartH - barH;

      // Bar gradient
      const grad = ctx.createLinearGradient(x, y, x, y + barH);
      if (hrs >= 7) {
        grad.addColorStop(0, 'rgba(107, 143, 158, 0.6)');
        grad.addColorStop(1, 'rgba(107, 143, 158, 0.15)');
      } else if (hrs >= 5) {
        grad.addColorStop(0, 'rgba(196, 181, 160, 0.6)');
        grad.addColorStop(1, 'rgba(196, 181, 160, 0.15)');
      } else {
        grad.addColorStop(0, 'rgba(158, 107, 107, 0.6)');
        grad.addColorStop(1, 'rgba(158, 107, 107, 0.15)');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, [4, 4, 0, 0]);
      ctx.fill();

      // Hour label on bar
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${hrs.toFixed(1)}`, x + barWidth / 2, y - 6);

      // Date label
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText(dates[i], x + barWidth / 2, h - padding.bottom + 18);
    });

    // Average line
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const avgY = padding.top + chartH - (avg / maxHours) * chartH;
    ctx.strokeStyle = 'rgba(196, 181, 160, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, avgY);
    ctx.lineTo(w - padding.right, avgY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(196, 181, 160, 0.4)';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`avg ${avg.toFixed(1)}h`, w - padding.right + 4, avgY + 3);

  }, [sleepData, filter]);

  const duration = calculateDuration();

  return (
    <div className="sleep page-container">
      <motion.div
        className="sleep-inner"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="sleep-header">
          <h2 className="sleep-title">Sleep</h2>
          <p className="mono sleep-hint">no scores. no judgment. just rhythm.</p>
        </div>

        {/* Log Section */}
        <AnimatePresence>
          {saved ? (
            <motion.div
              className="sleep-saved-inline"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="sleep-saved-text">Noted.</p>
              <p className="mono sleep-saved-sub">this will become part of your rhythm</p>
            </motion.div>
          ) : (
            <motion.div
              className="sleep-log-section"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="sleep-inputs">
                <div className="sleep-field">
                  <label className="mono sleep-label">fell asleep around</label>
                  <input 
                    type="time" 
                    value={sleepTime} 
                    onChange={(e) => setSleepTime(e.target.value)}
                    className="sleep-time-input"
                  />
                </div>

                <div className="sleep-divider">
                  <div className="sleep-divider-line" />
                  <span className="mono sleep-duration-preview">
                    {duration.hours}h {duration.minutes}m
                  </span>
                  <div className="sleep-divider-line" />
                </div>

                <div className="sleep-field">
                  <label className="mono sleep-label">woke up around</label>
                  <input 
                    type="time" 
                    value={wakeTime} 
                    onChange={(e) => setWakeTime(e.target.value)}
                    className="sleep-time-input"
                  />
                </div>
              </div>

              <div className="sleep-actions">
                <button 
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'logging...' : 'log sleep'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Graph Section */}
        {showGraph && (
          <motion.div
            className="sleep-graph-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="sleep-graph-header">
              <h3 className="sleep-graph-title">your rhythm</h3>
              <div className="sleep-filters">
                {FILTERS.map(f => (
                  <button
                    key={f}
                    className={`sleep-filter mono ${filter === f ? 'active' : ''}`}
                    onClick={() => setFilter(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="sleep-canvas-wrapper">
              <canvas ref={canvasRef} className="sleep-canvas" />
            </div>

            {sleepData.length > 0 && (
              <div className="sleep-stats">
                <div className="sleep-stat">
                  <span className="mono sleep-stat-label">entries</span>
                  <span className="sleep-stat-value">{sleepData.length}</span>
                </div>
                <div className="sleep-stat">
                  <span className="mono sleep-stat-label">avg sleep</span>
                  <span className="sleep-stat-value">
                    {(sleepData.reduce((acc, d) => {
                      const dur = (new Date(d.wakeTime) - new Date(d.sleepTime)) / 3600000;
                      return acc + dur;
                    }, 0) / sleepData.length).toFixed(1)}h
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
