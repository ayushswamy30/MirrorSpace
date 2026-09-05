import OpenAI from 'openai';
import { PERSONALITY_PROMPT, CHATBOT_PROMPT, VENT_REFLECTION_PROMPT } from '../prompts/personality.js';
import { config } from '../config/env.js';

// Initialize AI clients — Groq first (fastest + most generous free tier), then Gemini, then OpenAI
let groqClient = null;
let openaiClient = null;

function initGroq() {
  if (!groqClient && config.ai.groqApiKey) {
    groqClient = new OpenAI({
      apiKey: config.ai.groqApiKey,
      baseURL: 'https://api.groq.com/openai/v1'
    });
  }
  return groqClient;
}

function initOpenAI() {
  if (!openaiClient && config.ai.openaiApiKey) {
    openaiClient = new OpenAI({ apiKey: config.ai.openaiApiKey });
  }
  return openaiClient;
}

/**
 * Generate a response using the AI provider
 * Priority: Groq (free, fast) → OpenAI (paid, reliable) → fallback
 */
async function generateAIResponse(systemPrompt, userPrompt) {
  // Try Groq first (free, fastest inference)
  const groq = initGroq();
  if (groq) {
    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 300
      });
      return completion.choices[0].message.content;
    } catch (error) {
      console.error('Groq error, trying OpenAI:', error.message);
    }
  }

  // Try OpenAI
  const openai = initOpenAI();
  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 300
      });
      return completion.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI error:', error.message);
    }
  }

  // Fallback — no AI configured
  return null;
}

/**
 * Generate reflective chatbot response
 */
export async function generateChatResponse(messages, context) {
  const systemPrompt = `${PERSONALITY_PROMPT}\n\n${CHATBOT_PROMPT}\n\nUser Context (use naturally, don't dump):\n- Sleep: ${context.sleepTrend}\n- Journal: ${context.journalSentiment}`;

  const conversationHistory = messages
    .map(m => `${m.role === 'user' ? 'User' : 'Mirror'}: ${m.content}`)
    .join('\n');

  const response = await generateAIResponse(
    systemPrompt,
    `Conversation so far:\n${conversationHistory}\n\nRespond as Mirror:`
  );

  return response || "I'm here. Sometimes presence is enough.";
}

/**
 * Generate delayed reflection on a vent/journal entry
 */
export async function generateVentReflection(content, patterns) {
  const systemPrompt = `${PERSONALITY_PROMPT}\n\n${VENT_REFLECTION_PROMPT}`;

  const userPrompt = `Journal entry to reflect on:\n"${content}"\n\nText patterns detected:\n- Word count: ${patterns.wordCount}\n- Average sentence length: ${patterns.avgSentenceLength} words\n- Emotional words used: ${patterns.emotionalWords}\n- Questions asked: ${patterns.questionCount}`;

  const response = await generateAIResponse(systemPrompt, userPrompt);
  
  return response || "Your words held something today. That's enough for now.";
}
