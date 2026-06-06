import express from 'express';
import auth from '../middleware/auth.js';
import MoodPattern from '../models/MoodPattern.js';
import { getUserContext } from '../services/patternEngine.js';
import { generateAIResponse } from '../services/insightGenerator.js';
import { PERSONALITY_PROMPT } from '../prompts/personality.js';

const router = express.Router();

// GET /api/patterns — Get detected patterns
router.get('/', auth, async (req, res) => {
  try {
    const patterns = await MoodPattern.find({ userId: req.userId })
      .sort({ 'period.end': -1 })
      .limit(4);

    res.json(patterns);
  } catch (error) {
    res.status(500).json({ message: 'Could not fetch patterns' });
  }
});

// POST /api/patterns/predict — Generate prediction based on all data
router.post('/predict', auth, async (req, res) => {
  try {
    const context = await getUserContext(req.userId);

    const systemPrompt = `${PERSONALITY_PROMPT}\n\nYou are the Prediction Engine of MirrorSpace. Analyze the user's recent data (Sleep Logs, Journal Entries, Chat Sessions) and predict their current burnout, anxiety, and emotional drift risks. 
Return ONLY a valid JSON object with the following schema:
{
  "burnoutIndicators": <number 0-100>,
  "anxietyBuildUp": <number 0-100>,
  "emotionalDrift": <number 0-100>,
  "headline": "<1 short poetic sentence>",
  "summary": "<1-2 sentences of gentle reflection on their state>"
}`;

    const userPrompt = `User Context:\n- Sleep: ${context.sleepTrend}\n- Journal: ${context.journalSentiment}\n- Activity: ${context.recentPatterns.chatSessions} chats, ${context.recentPatterns.journalEntries} journals.\n- Days since last journal: ${context.recentPatterns.daysSinceJournal ?? 'unknown'}`;

    const response = await generateAIResponse(systemPrompt, userPrompt);
    let parsedText = {
      burnoutIndicators: 30,
      anxietyBuildUp: 30,
      emotionalDrift: 30,
      headline: "The system is quiet.",
      summary: "We don't have enough data yet, but what we see is calm."
    };

    if (response) {
      try {
        const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsedText = JSON.parse(cleaned);
      } catch (e) {
        console.error('Failed to parse prediction json:', e);
      }
    }

    const pattern = await MoodPattern.create({
      userId: req.userId,
      period: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // last 7 days
        end: new Date()
      },
      patterns: {
        emotionalDrift: parsedText.emotionalDrift || 0,
        burnoutIndicators: parsedText.burnoutIndicators || 0,
        anxietyBuildUp: parsedText.anxietyBuildUp || 0,
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
        headline: parsedText.headline,
        summary: parsedText.summary
      }
    });

    res.json(pattern);
  } catch (error) {
    console.error('Prediction generation error:', error);
    res.status(500).json({ message: 'Could not generate prediction' });
  }
});

export default router;
