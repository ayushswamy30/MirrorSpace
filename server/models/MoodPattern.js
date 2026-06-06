import mongoose from 'mongoose';

const moodPatternSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  period: {
    start: { type: Date, required: true },
    end: { type: Date, required: true }
  },
  patterns: {
    emotionalDrift: { type: Number, default: 0 },
    burnoutIndicators: { type: Number, default: 0 },
    anxietyBuildUp: { type: Number, default: 0 },
    sleepDebt: { type: Number, default: 0 },
    socialWithdrawal: { type: Number, default: 0 },
    languageComplexity: { type: Number, default: 0 }
  },
  dataPoints: {
    sleepLogs: { type: Number, default: 0 },
    journalEntries: { type: Number, default: 0 },
    chatSessions: { type: Number, default: 0 }
  },
  aiInsight: {
    headline: { type: String },
    summary: { type: String }
  }
}, { timestamps: true });

moodPatternSchema.index({ userId: 1, 'period.end': -1 });

export default mongoose.model('MoodPattern', moodPatternSchema);
