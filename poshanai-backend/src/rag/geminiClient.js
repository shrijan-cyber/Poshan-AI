import logger from '../utils/logger.js';
import { ensureMedicalDisclaimer, MEDICAL_DISCLAIMER } from './promptBuilder.js';

const DEFAULT_MODEL = process.env.OMNIROUTE_MODEL;
const API_BASE_URL = process.env.OMNIROUTE_BASE_URL || 'http://localhost:20128';
const UNAVAILABLE_MESSAGE = 'AI meal-plan generation is temporarily unavailable. Please try again later.';

export const generateText = async (prompt, {
  apiKey = process.env.OMNIROUTE_API_KEY,
  model = DEFAULT_MODEL,
  signal,
  temperature = 0.3,
} = {}) => {
  if (typeof prompt !== 'string' || !prompt.trim()) throw new TypeError('AI prompt must be a non-empty string.');
  if (!apiKey || !model) {
    logger.error('OmniRoute configuration is incomplete.');
    return `${UNAVAILABLE_MESSAGE}\n\n${MEDICAL_DISCLAIMER}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt.trim() }],
        temperature,
      }),
      signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = body?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty completion');
    return text;
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    logger.error('OmniRoute chat completion failed; returning fallback response.');
    return `${UNAVAILABLE_MESSAGE}\n\n${MEDICAL_DISCLAIMER}`;
  }
};

export const generateMealPlan = async (prompt, options) => {
  const generated = await generateText(prompt, options);
  return ensureMedicalDisclaimer(generated);
};

// TODO: Validate generated meal plans and nutrient quantities against product schemas and safe bounds before persistence or display.
