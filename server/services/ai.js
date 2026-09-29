import OpenAI from 'openai';

import { config } from '../config/env.js';
import { GEMINI_ENDPOINT, geminiRequest, geminiText, providerOrder } from '../lib/aiProviders.js';

/**
 * One way to ask an AI for text, shared by reflections, chat and insights.
 * Tries each allowed provider in turn (see lib/aiProviders.js for which are
 * allowed for personal text) and returns null if none answers, so every
 * caller keeps its own fallback line.
 */

const TIMEOUT_MS = 20_000;

let groqClient = null;
let openaiClient = null;

async function gemini({ system, prompt, temperature, maxTokens }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${GEMINI_ENDPOINT}/${config.ai.geminiModel}:generateContent`, {
      method: 'POST',
      // The key goes in a header, not the URL, so it never lands in a log.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.ai.geminiApiKey },
      body: JSON.stringify(geminiRequest({ system, prompt, temperature, maxTokens })),
      signal: controller.signal
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error?.message ?? `Gemini answered ${res.status}`);
    return geminiText(body);
  } finally {
    clearTimeout(timer);
  }
}

async function openAiCompatible(client, model, { system, prompt, temperature, maxTokens }) {
  const completion = await client.chat.completions.create({
    model,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: prompt }
    ],
    temperature,
    max_tokens: maxTokens
  });
  return completion.choices[0]?.message?.content ?? null;
}

const providers = {
  gemini,
  groq: request => {
    groqClient ??= new OpenAI({ apiKey: config.ai.groqApiKey, baseURL: 'https://api.groq.com/openai/v1' });
    return openAiCompatible(groqClient, 'llama-3.3-70b-versatile', request);
  },
  openai: request => {
    openaiClient ??= new OpenAI({ apiKey: config.ai.openaiApiKey });
    return openAiCompatible(openaiClient, 'gpt-4o-mini', request);
  }
};

/**
 * @param {object} request
 * @param {string} [request.system]
 * @param {string} request.prompt
 * @param {boolean} request.personal  true when the prompt carries someone's own writing
 * @param {number} [request.temperature]
 * @param {number} [request.maxTokens]
 * @returns {Promise<string|null>}
 */
export async function generateText({ system, prompt, personal, temperature = 0.7, maxTokens = 400 }) {
  for (const name of providerOrder(config.ai, { personal })) {
    try {
      const text = await providers[name]({ system, prompt, temperature, maxTokens });
      if (text) return text;
    } catch (error) {
      // The message only: never the prompt, which may be someone's journal.
      console.error(`AI provider ${name} failed:`, error.message);
    }
  }
  return null;
}

/** Whether personal writing can be reflected on at all with this setup. */
export function canReflectOnPersonalText() {
  return providerOrder(config.ai, { personal: true }).length > 0;
}
