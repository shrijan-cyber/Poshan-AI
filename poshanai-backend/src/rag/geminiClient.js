import { ensureMedicalDisclaimer } from './promptBuilder.js';

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export const generateText = async (prompt, {
  apiKey = process.env.GEMINI_API_KEY,
  model = DEFAULT_MODEL,
  signal,
  temperature = 0.3,
} = {}) => {
  if (!apiKey) throw new Error('Gemini is unavailable: GEMINI_API_KEY is not configured.');
  if (typeof prompt !== 'string' || !prompt.trim()) throw new TypeError('Gemini prompt must be a non-empty string.');

  try {
    const response = await fetch(`${API_BASE_URL}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt.trim() }] }],
        generationConfig: { temperature },
      }),
      signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = body?.error?.message || `Gemini returned HTTP ${response.status}.`;
      throw new Error(message);
    }
    const text = body?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('')
      .trim();
    if (!text) throw new Error('Gemini returned no usable text.');
    return text;
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Meal-plan generation is temporarily unavailable. Please try again later.', { cause: error });
  }
};

export const generateMealPlan = async (prompt, options) => {
  const generated = await generateText(prompt, options);
  return ensureMedicalDisclaimer(generated);
};

// TODO: Validate generated meal plans and nutrient quantities against product schemas and safe bounds before persistence or display.
