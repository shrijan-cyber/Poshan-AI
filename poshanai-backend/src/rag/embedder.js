import logger from '../utils/logger.js';
import { isVerifiedIfctRecord } from './ifctLoader.js';

const DEFAULT_MODEL = process.env.OMNIROUTE_EMBEDDING_MODEL || process.env.OMNIROUTE_MODEL;
const API_BASE_URL = process.env.OMNIROUTE_BASE_URL || 'http://localhost:20128';

export const embedText = async (text, {
  apiKey = process.env.OMNIROUTE_API_KEY,
  model = DEFAULT_MODEL,
  signal,
} = {}) => {
  if (typeof text !== 'string' || !text.trim()) throw new TypeError('Embedding input must be a non-empty string.');
  if (!apiKey || !model) {
    logger.error('OmniRoute embedding configuration is incomplete.');
    throw new Error('Embeddings are temporarily unavailable. Please try again later.');
  }

  try {
    const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, input: text.trim() }),
      signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const vector = body?.data?.[0]?.embedding;
    if (!Array.isArray(vector) || !vector.length || vector.some((value) => !Number.isFinite(value))) {
      throw new Error('Invalid embedding vector');
    }
    return vector;
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    logger.error('OmniRoute embedding request failed.');
    throw new Error('Embeddings are temporarily unavailable. Please try again later.', { cause: error });
  }
};

export const embedIfctRecord = async (record, options = {}) => {
  if (!isVerifiedIfctRecord(record)) {
    throw new TypeError('Only records loaded from the verified IFCT 2017 dataset may be embedded for RAG.');
  }
  return embedText(JSON.stringify(record), options);
};

export const embedQuery = (query, options = {}) => embedText(query, options);
