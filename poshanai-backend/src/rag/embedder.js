import { isVerifiedIfctRecord } from './ifctLoader.js';

const DEFAULT_MODEL = 'gemini-embedding-001';
const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export const embedText = async (text, {
  apiKey = process.env.GEMINI_API_KEY,
  model = DEFAULT_MODEL,
  taskType = 'RETRIEVAL_DOCUMENT',
  title,
  outputDimensionality,
  signal,
} = {}) => {
  if (!apiKey) throw new Error('Gemini embeddings are unavailable: GEMINI_API_KEY is not configured.');
  if (typeof text !== 'string' || !text.trim()) throw new TypeError('Embedding input must be a non-empty string.');

  const requestBody = {
    content: { parts: [{ text: text.trim() }] },
    embedContentConfig: {
      taskType,
      ...(title ? { title } : {}),
      ...(outputDimensionality ? { outputDimensionality } : {}),
    },
  };

  try {
    const response = await fetch(`${API_BASE_URL}/models/${encodeURIComponent(model)}:embedContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(requestBody),
      signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = body?.error?.message || `Gemini embeddings returned HTTP ${response.status}.`;
      throw new Error(message);
    }
    const vector = body?.embedding?.values;
    if (!Array.isArray(vector) || !vector.length || vector.some((value) => !Number.isFinite(value))) {
      throw new Error('Gemini returned an invalid embedding vector.');
    }
    return vector;
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Failed to create Gemini embedding. Check API availability and configuration.', { cause: error });
  }
};

export const embedIfctRecord = async (record, options = {}) => {
  if (!isVerifiedIfctRecord(record)) {
    throw new TypeError('Only records loaded from the verified IFCT 2017 dataset may be embedded for RAG.');
  }
  return embedText(JSON.stringify(record), { ...options, taskType: 'RETRIEVAL_DOCUMENT', title: record.foodName });
};

export const embedQuery = (query, options = {}) => embedText(query, { ...options, taskType: 'RETRIEVAL_QUERY' });
