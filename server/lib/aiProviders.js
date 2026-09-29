/**
 * Which AI provider may handle a request, and the Gemini wire format.
 *
 * The rule that matters: a request carrying someone's own writing (a vent
 * page, a Mirror message) is `personal`, and personal text never goes to
 * Gemini's unpaid tier. Google's terms for unpaid Gemini API use allow human
 * review and product improvement on inputs and ask developers not to send
 * sensitive or personal information — journals are exactly that. Such text
 * can use Gemini only once the key's project has billing enabled
 * (GEMINI_PAID_TIER=true), where those uses do not apply.
 *
 * Derived summaries (counts, trends, sentiment labels) are not personal text
 * and may use any configured provider.
 */

export const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Providers to try, in order, for one request. */
export function providerOrder(ai, { personal }) {
  const order = [];
  if (ai.geminiApiKey && (!personal || ai.geminiPaidTier)) order.push('gemini');
  if (ai.groqApiKey) order.push('groq');
  if (ai.openaiApiKey) order.push('openai');
  return order;
}

export function geminiRequest({ system, prompt, temperature, maxTokens }) {
  return {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens }
  };
}

/** The reply's text, or null when there is none (blocked, empty, malformed). */
export function geminiText(body) {
  const parts = body?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts
    .filter(p => typeof p?.text === 'string' && !p.thought)
    .map(p => p.text)
    .join('')
    .trim();
  return text || null;
}
