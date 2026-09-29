import { getUserContext } from './patternEngine.js';
import { PERSONALITY_PROMPT, DAILY_INSIGHT_PROMPT } from '../prompts/personality.js';
import * as insights from '../db/insights.js';
import { config } from '../config/env.js';
import OpenAI from 'openai';

/**
 * Generate AI response using Groq (primary) or OpenAI (fallback)
 */
export async function generateAIResponse(systemPrompt, userPrompt) {
  // Try Groq first (free, fastest)
  if (config.ai.groqApiKey) {
    try {
      const groq = new OpenAI({
        apiKey: config.ai.groqApiKey,
        baseURL: 'https://api.groq.com/openai/v1'
      });
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 200
      });
      return completion.choices[0].message.content;
    } catch (error) {
      console.error('Groq insight error:', error.message);
    }
  }

  // Try OpenAI
  if (config.ai.openaiApiKey) {
    try {
      const openai = new OpenAI({ apiKey: config.ai.openaiApiKey });
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 200
      });
      return completion.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI insight error:', error.message);
    }
  }

  return null;
}

/**
 * Generate daily insight — appears once per day, Co-Star style
 */
export async function generateDailyInsight(userId) {
  try {
    const context = await getUserContext(userId);
    
    const systemPrompt = `${PERSONALITY_PROMPT}\n\n${DAILY_INSIGHT_PROMPT}`;
    const userPrompt = `User context for today's insight:\n- Sleep: ${context.sleepTrend}\n- Journal: ${context.journalSentiment}\n- Activity: ${context.recentPatterns.chatSessions} conversations, ${context.recentPatterns.journalEntries} journal entries in the past 7 days.\n- Days since last journal: ${context.recentPatterns.daysSinceJournal ?? 'unknown'}`;

    const response = await generateAIResponse(systemPrompt, userPrompt);

    let headline, subtext, basedOn = [];
    
    if (response) {
      try {
        // Try parsing JSON response
        const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        headline = parsed.headline;
        subtext = parsed.subtext;
      } catch {
        // If not JSON, use as headline
        headline = response.trim();
        subtext = null;
      }
    } else {
      // Fallback insights when no AI is available
      const fallbacks = [
        { headline: "Today might feel heavier than it needs to.\nNot because of emotions — but because of exhaustion.", subtext: "A gentle observation." },
        { headline: "Some days exist just to be survived.\nThat's not failure. That's endurance.", subtext: null },
        { headline: "The quiet you carry is not emptiness.\nIt's a room that hasn't been entered yet.", subtext: null },
        { headline: "Rest is not the absence of doing.\nIt's the presence of allowing.", subtext: null },
        { headline: "Your mind is processing more than you realize.\nLet it work without watching.", subtext: null }
      ];
      const fallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      headline = fallback.headline;
      subtext = fallback.subtext;
    }

    // Determine what data was used
    if (context.recentPatterns.sleepLogs > 0) basedOn.push('sleep');
    if (context.recentPatterns.journalEntries > 0) basedOn.push('journal');
    if (context.recentPatterns.chatSessions > 0) basedOn.push('chat');

    return insights.create(userId, { type: 'daily', headline, subtext, basedOn });
  } catch (error) {
    console.error('Daily insight generation error:', error);
    return null;
  }
}

/**
 * Generate weekly insight — pattern summary in words, not charts
 */
export async function generateWeeklyInsight(userId) {
  try {
    const context = await getUserContext(userId);

    const systemPrompt = `${PERSONALITY_PROMPT}\n\nGenerate a WEEKLY reflection. This is a longer, more observational piece — 2-4 sentences. It should summarize patterns over the entire week. NO charts, NO numbers shown to user. Just patterns in words.\n\nFormat as JSON: { "headline": "...", "subtext": "..." }`;
    
    const userPrompt = `Weekly context:\n- Sleep: ${context.sleepTrend}\n- Journal: ${context.journalSentiment}\n- Sentiment trend: ${context.recentPatterns.sentimentTrend}\n- Total entries: ${context.recentPatterns.journalEntries} journals, ${context.recentPatterns.chatSessions} conversations`;

    const response = await generateAIResponse(systemPrompt, userPrompt);

    let headline, subtext;
    
    if (response) {
      try {
        const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        headline = parsed.headline;
        subtext = parsed.subtext;
      } catch {
        headline = response.trim();
        subtext = null;
      }
    } else {
      headline = "You've been quieter this week.\nNot sad. Just tired.";
      subtext = "Patterns noticed across your rhythms.";
    }

    return insights.create(userId, {
      type: 'weekly',
      headline,
      subtext,
      basedOn: ['sleep', 'journal', 'activity']
    });
  } catch (error) {
    console.error('Weekly insight generation error:', error);
    return null;
  }
}
