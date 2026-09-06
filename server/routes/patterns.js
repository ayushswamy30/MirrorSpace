import express from 'express';
import auth from '../middleware/auth.js';
import { predictionLimiter } from '../middleware/rateLimit.js';
import * as moodPatterns from '../db/moodPatterns.js';
import { getUserContext } from '../services/patternEngine.js';
import { generateAIResponse } from '../services/insightGenerator.js';
import { PERSONALITY_PROMPT } from '../prompts/personality.js';

const router = express.Router();

const clampScore = (value, fallback = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n)));
};

// GET /api/patterns — Get detected patterns
router.get('/', auth, async (req, res, next) => {
  try {
    const patterns = await moodPatterns.listForUser(req.userId, 4);
    res.json(patterns);
  } catch (error) {
    next(error);
  }
});

// POST /api/patterns/predict — Generate prediction based on all data
router.post('/predict', auth, predictionLimiter, async (req, res, next) => {
  try {
    const context = await getUserContext(req.userId);

    const systemPrompt = `${PERSONALITY_PROMPT}

You are the Prediction Engine of MirrorSpace. Analyze the user's recent data (Sleep Logs, Journal Entries, Chat Sessions) and predict their current burnout, anxiety, and emotional drift risks.
Return ONLY a valid JSON object with the following schema:
{
  "burnoutIndicators": <number 0-100>,
  "anxietyBuildUp": <number 0-100>,
  "emotionalDrift": <number 0-100>,
  "headline": "<1 short poetic sentence>",
  "summary": "<1-2 sentences of gentle reflection on their state>"
}`;

    const userPrompt = [
      'User Context:',
      `- Sleep: ${context.sleepTrend}`,
      `- Journal: ${context.journalSentiment}`,
      `- Activity: ${context.recentPatterns.chatSessions} chats, ${context.recentPatterns.journalEntries} journals.`,
      `- Calm mode opened ${context.recentPatterns.calmTriggers} times in the past week.`,
      `- Days since last journal: ${context.recentPatterns.daysSinceJournal ?? 'unknown'}`
    ].join('\n');

    const response = await generateAIResponse(systemPrompt, userPrompt);

    let prediction = {
      burnoutIndicators: 30,
      anxietyBuildUp: 30,
      emotionalDrift: 30,
      headline: 'The system is quiet.',
      summary: "We don't have enough data yet, but what we see is calm."
    };

    if (response) {
      try {
        const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        prediction = { ...prediction, ...JSON.parse(cleaned) };
      } catch (e) {
        console.error('Failed to parse prediction json:', e.message);
      }
    }

    const pattern = await moodPatterns.create(req.userId, {
      periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      periodEnd: new Date().toISOString(),
      patterns: {
        // The Patterns page renders these straight into percentage-width bars,
        // so a model that answers "high" or 300 must not break the layout.
        emotionalDrift: clampScore(prediction.emotionalDrift),
        burnoutIndicators: clampScore(prediction.burnoutIndicators),
        anxietyBuildUp: clampScore(prediction.anxietyBuildUp),
        sleepDebt: 0,
        socialWithdrawal: 0,
        languageComplexity: 0
      },
      dataPoints: {
        sleepLogs: context.recentPatterns.sleepLogs,
        journalEntries: context.recentPatterns.journalEntries,
        chatSessions: context.recentPatterns.chatSessions
      },
      aiInsight: {
        headline: String(prediction.headline ?? ''),
        summary: String(prediction.summary ?? '')
      }
    });

    res.json(pattern);
  } catch (error) {
    next(error);
  }
});

export default router;
