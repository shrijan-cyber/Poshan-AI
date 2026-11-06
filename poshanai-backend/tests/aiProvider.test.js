import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatCompletionProvider } from '../src/services/aiProviders/chatCompletionProvider.js';
import { env } from '../src/config/env.js';
import { enhanceRecipeInstructions } from '../src/services/aiService.js';

function okResponse(content = '{"recipes":[]}', options = {}) {
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => (name === 'x-omniroute-response-cost' ? options.cost ?? null : null) },
    json: async () => ({ choices: [{ message: { content } }], usage: options.usage }),
  };
}

test('provider parses successful OpenAI-compatible structured content and usage', async () => {
  const provider = createChatCompletionProvider({
    endpoint: 'http://localhost:20128/v1/chat/completions', model: 'gemini-2.0-flash',
    fetchImpl: async () => okResponse('{"recipes":[]}', { usage: { total_tokens: 42 } }),
  });
  const result = await provider([{ role: 'user', content: 'only recipe data' }]);
  assert.equal(result.content, '{"recipes":[]}');
  assert.equal(result.usage.total_tokens, 42);
});

test('provider retries one transient HTTP failure then succeeds', async () => {
  let calls = 0;
  const provider = createChatCompletionProvider({
    endpoint: 'http://localhost:20128/v1/chat/completions', model: 'gemini-2.0-flash', maxRetries: 1,
    fetchImpl: async () => {
      calls += 1;
      return calls === 1 ? { ok: false, status: 503 } : okResponse();
    },
  });
  await provider([]);
  assert.equal(calls, 2);
});

test('provider reports missing configuration without a network request', async () => {
  let calls = 0;
  const provider = createChatCompletionProvider({ endpoint: null, model: null, fetchImpl: async () => { calls += 1; } });
  await assert.rejects(provider([]), { code: 'AI_SERVICE_NOT_CONFIGURED' });
  assert.equal(calls, 0);
});

test('provider normalizes timeout and invalid response JSON', async () => {
  const timeoutProvider = createChatCompletionProvider({
    endpoint: 'http://localhost:20128/v1/chat/completions', model: 'model', maxRetries: 0,
    fetchImpl: async () => { const error = new Error('deadline'); error.name = 'TimeoutError'; throw error; },
  });
  await assert.rejects(timeoutProvider([]), { code: 'AI_PROVIDER_TIMEOUT' });

  const invalidJsonProvider = createChatCompletionProvider({
    endpoint: 'http://localhost:20128/v1/chat/completions', model: 'model', maxRetries: 0,
    fetchImpl: async () => ({ ok: true, json: async () => { throw new Error('invalid JSON'); } }),
  });
  await assert.rejects(invalidJsonProvider([]), { code: 'AI_RESPONSE_INVALID' });
});

test('optional OmniRoute POC sends only the recipe payload and uses server-side gateway credentials', async () => {
  const originalConfig = [env.aiProvider, env.omniroutePocUrl, env.omniroutePocModel, env.omniroutePocApiKey];
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestOptions;
  env.aiProvider = 'omniroute';
  env.omniroutePocUrl = 'http://127.0.0.1:20128/v1/chat/completions';
  env.omniroutePocModel = 'test/provider-model';
  env.omniroutePocApiKey = 'server-only-test-token';
  globalThis.fetch = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return okResponse(JSON.stringify({ recipes: [{ mealIndex: 0, recipeId: 'test-recipe', cookingInstructions: ['Cook the listed ingredients until ready.'], swapSuggestion: null }] }));
  };
  try {
    const [result] = await enhanceRecipeInstructions([{
      recipeId: 'test-recipe', dishName: 'Test dish', ingredients: [],
      cookingInstructions: ['Prepare the listed ingredients carefully.'],
    }]);
    assert.equal(requestUrl, env.omniroutePocUrl);
    assert.equal(JSON.parse(requestOptions.body).model, env.omniroutePocModel);
    assert.equal(requestOptions.headers.Authorization, 'Bearer server-only-test-token');
    assert.match(result.cookingInstructions[0], /listed ingredients/);
  } finally {
    globalThis.fetch = originalFetch;
    [env.aiProvider, env.omniroutePocUrl, env.omniroutePocModel, env.omniroutePocApiKey] = originalConfig;
  }
});

test('optional OmniRoute POC without configuration uses no network and stays on static instructions', async () => {
  const originalConfig = [env.aiProvider, env.omniroutePocUrl, env.omniroutePocModel];
  const originalFetch = globalThis.fetch;
  let calls = 0;
  env.aiProvider = 'omniroute';
  env.omniroutePocUrl = null;
  env.omniroutePocModel = null;
  globalThis.fetch = async () => { calls += 1; };
  try {
    const meal = { recipeId: 'fallback', ingredients: [], cookingInstructions: ['Prepare the listed ingredients carefully.'] };
    const [result] = await enhanceRecipeInstructions([meal]);
    assert.deepEqual(result.cookingInstructions, meal.cookingInstructions);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    [env.aiProvider, env.omniroutePocUrl, env.omniroutePocModel] = originalConfig;
  }
});
