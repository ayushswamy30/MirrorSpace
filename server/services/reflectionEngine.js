import { PERSONALITY_PROMPT, CHATBOT_PROMPT, VENT_REFLECTION_PROMPT } from '../prompts/personality.js';
import { generateText } from './ai.js';

/**
 * Reflections on someone's own words. Both functions send personal text, so
 * they only reach providers allowed to see it (lib/aiProviders.js); with none
 * configured they fall back to a fixed line.
 */

/**
 * Generate reflective chatbot response
 */
export async function generateChatResponse(messages, context) {
  const system = `${PERSONALITY_PROMPT}\n\n${CHATBOT_PROMPT}\n\nUser Context (use naturally, don't dump):\n- Sleep: ${context.sleepTrend}\n- Journal: ${context.journalSentiment}`;

  const conversationHistory = messages
    .map(m => `${m.role === 'user' ? 'User' : 'Mirror'}: ${m.content}`)
    .join('\n');

  const response = await generateText({
    system,
    prompt: `Conversation so far:\n${conversationHistory}\n\nRespond as Mirror:`,
    personal: true
  });

  return response || "I'm here. Sometimes presence is enough.";
}

/**
 * Generate delayed reflection on a vent/journal entry
 */
export async function generateVentReflection(content, patterns) {
  const system = `${PERSONALITY_PROMPT}\n\n${VENT_REFLECTION_PROMPT}`;

  const prompt = `Journal entry to reflect on:\n"${content}"\n\nText patterns detected:\n- Word count: ${patterns.wordCount}\n- Average sentence length: ${patterns.avgSentenceLength} words\n- Emotional words used: ${patterns.emotionalWords}\n- Questions asked: ${patterns.questionCount}`;

  const response = await generateText({ system, prompt, personal: true });

  return response || "Your words held something today. That's enough for now.";
}
