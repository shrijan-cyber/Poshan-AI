import { env } from '../config/env.js';
import httpError from '../utils/httpError.js';

const FDC_API_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';
const MAX_PAGE_SIZE = 200;
const DEFAULT_TIMEOUT_MS = 10_000;

function rateLimitMetadata(headers) {
  const limit = headers.get('x-ratelimit-limit');
  const remaining = headers.get('x-ratelimit-remaining');
  return {
    limit: limit !== null && Number.isFinite(Number(limit)) ? Number(limit) : null,
    remaining: remaining !== null && Number.isFinite(Number(remaining)) ? Number(remaining) : null,
  };
}

function parseRetryAfter(value, now = Date.now()) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

function createRateLimitError(response, now) {
  const error = httpError(429, 'FDC_RATE_LIMITED', 'FoodData Central rate limit reached. Retry after the provider window resets.');
  error.retryAfterMs = parseRetryAfter(response.headers.get('retry-after'), now());
  error.rateLimit = rateLimitMetadata(response.headers);
  return error;
}

function validateQuery(query) {
  if (typeof query !== 'string' || query.trim().length === 0 || query.trim().length > 200) {
    throw httpError(400, 'FDC_QUERY_INVALID', 'FoodData Central search query must contain 1 to 200 characters.');
  }
  return query.trim();
}

function validatePositiveInteger(value, label, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw httpError(400, 'FDC_PARAMETER_INVALID', `${label} must be a positive integer${Number.isFinite(max) ? ` no greater than ${max}` : ''}.`);
  }
  return value;
}

function validateTimeout(timeoutMs) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60_000) {
    throw httpError(400, 'FDC_TIMEOUT_INVALID', 'FoodData Central timeout must be an integer between 100 and 60000 milliseconds.');
  }
}

/**
 * Build an injectable FDC client. Responses retain the provider's raw food
 * records; source metadata is returned separately and is never merged into IFCT.
 */
export function createFoodDataCentralClient({
  apiKey = env.fdcApiKey,
  fetchImpl = globalThis.fetch,
  baseUrl = FDC_API_BASE_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  now = Date.now,
} = {}) {
  async function request(endpoint, { params = {}, signal, expectedShape } = {}) {
    if (typeof apiKey !== 'string' || !apiKey.trim()) {
      throw httpError(503, 'FDC_NOT_CONFIGURED', 'FoodData Central is not configured on the server.');
    }
    if (typeof fetchImpl !== 'function') {
      throw httpError(503, 'FDC_UNAVAILABLE', 'FoodData Central is unavailable.');
    }
    validateTimeout(timeoutMs);

    const url = new URL(`${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`);
    url.searchParams.set('api_key', apiKey.trim());
    for (const [name, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) value.forEach((entry) => url.searchParams.append(name, entry));
      else url.searchParams.set(name, String(value));
    }

    let response;
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const requestSignal = signal ? AbortSignal.any([timeoutSignal, signal]) : timeoutSignal;
    try {
      response = await fetchImpl(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: requestSignal,
      });
    } catch (error) {
      if (signal?.aborted) {
        throw httpError(499, 'FDC_REQUEST_ABORTED', 'FoodData Central request was cancelled.');
      }
      const timedOut = timeoutSignal.aborted || error?.name === 'TimeoutError' || error?.name === 'AbortError';
      throw httpError(
        timedOut ? 504 : 503,
        timedOut ? 'FDC_TIMEOUT' : 'FDC_UNAVAILABLE',
        timedOut ? 'FoodData Central request timed out.' : 'FoodData Central is unavailable.',
      );
    }

    if (response.status === 429) throw createRateLimitError(response, now);
    if (!response.ok) {
      throw httpError(502, 'FDC_REQUEST_FAILED', `FoodData Central returned HTTP ${response.status}.`);
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw httpError(502, 'FDC_INVALID_RESPONSE', 'FoodData Central returned an invalid JSON response.');
    }

    const validShape = expectedShape === 'search'
      ? data && typeof data === 'object' && Array.isArray(data.foods)
      : data && typeof data === 'object' && !Array.isArray(data);
    if (!validShape) {
      throw httpError(502, 'FDC_INVALID_RESPONSE', 'FoodData Central returned a response with an unexpected shape.');
    }

    const headers = response.headers;
    return {
      data,
      sourceMetadata: {
        source: 'USDA FoodData Central',
        license: 'CC0-1.0',
        endpoint: endpoint.startsWith('/') ? endpoint : `/${endpoint}`,
        retrievedAt: new Date(now()).toISOString(),
        rateLimit: rateLimitMetadata(headers),
        etag: headers.get('etag'),
        lastModified: headers.get('last-modified'),
      },
    };
  }

  return Object.freeze({
    async searchFoods(query, {
      dataType,
      pageSize = 25,
      pageNumber = 1,
      sortBy,
      sortOrder,
      signal,
    } = {}) {
      const cleanQuery = validateQuery(query);
      validatePositiveInteger(pageSize, 'pageSize', MAX_PAGE_SIZE);
      validatePositiveInteger(pageNumber, 'pageNumber');
      return request('/foods/search', {
        params: { query: cleanQuery, dataType, pageSize, pageNumber, sortBy, sortOrder },
        signal,
        expectedShape: 'search',
      });
    },

    async getFood(fdcId, { signal } = {}) {
      validatePositiveInteger(fdcId, 'fdcId');
      return request(`/food/${fdcId}`, { signal, expectedShape: 'detail' });
    },
  });
}

const defaultClient = createFoodDataCentralClient();

export const searchFoodDataCentral = (...args) => defaultClient.searchFoods(...args);
export const getFoodDataCentralDetails = (...args) => defaultClient.getFood(...args);

export default { createFoodDataCentralClient, searchFoodDataCentral, getFoodDataCentralDetails };
