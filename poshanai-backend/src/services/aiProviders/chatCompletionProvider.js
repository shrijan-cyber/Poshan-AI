import logger from '../../utils/logger.js';
import httpError from '../../utils/httpError.js';

function completionText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.filter((part) => part?.type === 'text').map((part) => part.text).join('\n');
  throw httpError(502, 'AI_RESPONSE_INVALID', 'The AI provider returned no content.');
}

function retryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

/** Minimal OpenAI Chat Completions client for the low-risk, non-sensitive recipe instruction pilot. */
export function createChatCompletionProvider({
  endpoint,
  model,
  apiKey = null,
  timeoutMs = 15_000,
  maxRetries = 1,
  fetchImpl = (...args) => fetch(...args),
  providerName = 'AI provider',
}) {
  return async function complete(messages) {
    if (!endpoint || !model) {
      throw httpError(503, 'AI_SERVICE_NOT_CONFIGURED', `${providerName} is not configured.`);
    }
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const startedAt = Date.now();
      try {
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          headers,
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 1800 }),
        });
        if (!response.ok) {
          const retryable = retryableStatus(response.status);
          lastError = httpError(502, 'AI_PROVIDER_REQUEST_FAILED', `${providerName} returned HTTP ${response.status}.`);
          logger.warn(`${providerName} request failed (HTTP ${response.status}, attempt ${attempt + 1}).`);
          if (retryable && attempt < maxRetries) continue;
          throw lastError;
        }
        let payload;
        try {
          payload = await response.json();
        } catch {
          throw httpError(502, 'AI_RESPONSE_INVALID', `${providerName} returned an invalid response body.`);
        }
        const usage = payload?.usage;
        const costHeader = response.headers?.get?.('x-omniroute-response-cost');
        const reportedCost = costHeader === null || costHeader === undefined || costHeader === '' ? null : Number(costHeader);
        logger.info(`${providerName} request succeeded in ${Date.now() - startedAt}ms (attempt ${attempt + 1}${Number.isFinite(usage?.total_tokens) ? `, ${usage.total_tokens} tokens` : ''}${Number.isFinite(reportedCost) && reportedCost >= 0 ? `, reported cost $${reportedCost}` : ''}).`);
        return { content: completionText(payload), usage: usage ?? null };
      } catch (error) {
        if (error === lastError) throw error;
        if (error?.code === 'AI_RESPONSE_INVALID') throw error;
        const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
        lastError = httpError(
          timedOut ? 504 : 503,
          timedOut ? 'AI_PROVIDER_TIMEOUT' : 'AI_PROVIDER_UNAVAILABLE',
          timedOut ? `${providerName} request timed out.` : `${providerName} is unavailable.`,
        );
        logger.warn(`${providerName} request ${timedOut ? 'timed out' : 'failed to connect'} (attempt ${attempt + 1}).`);
        if (attempt < maxRetries) continue;
        throw lastError;
      }
    }
    throw lastError;
  };
}
