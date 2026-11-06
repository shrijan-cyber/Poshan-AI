import assert from 'node:assert/strict';
import test from 'node:test';
import { createFoodDataCentralClient } from '../src/services/foodDataCentralClient.js';

function response({ status = 200, body = {}, headers = {} } = {}) {
  const normalizedHeaders = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => normalizedHeaders.get(name.toLowerCase()) ?? null },
    json: async () => body,
  };
}

test('FDC search sends server key and returns untouched provider records with response provenance', async () => {
  let requestUrl;
  let requestOptions;
  const rawPayload = {
    foods: [{ fdcId: 123, dataType: 'Foundation', publicationDate: '2024-04-25', foodNutrients: [{ nutrientId: 1003, value: 3.2, unitName: 'g' }] }],
    totalHits: 1,
  };
  const client = createFoodDataCentralClient({
    apiKey: 'server-test-key',
    now: () => Date.parse('2026-01-02T03:04:05.000Z'),
    fetchImpl: async (url, options) => {
      requestUrl = new URL(url);
      requestOptions = options;
      return response({ body: rawPayload, headers: { 'x-ratelimit-limit': '1000', 'x-ratelimit-remaining': '998', etag: 'abc' } });
    },
  });

  const result = await client.searchFoods('  brown rice  ', {
    dataType: ['Foundation', 'SR Legacy'], pageSize: 10, pageNumber: 2,
  });

  assert.equal(requestUrl.pathname, '/fdc/v1/foods/search');
  assert.equal(requestUrl.searchParams.get('api_key'), 'server-test-key');
  assert.equal(requestUrl.searchParams.get('query'), 'brown rice');
  assert.deepEqual(requestUrl.searchParams.getAll('dataType'), ['Foundation', 'SR Legacy']);
  assert.equal(requestUrl.searchParams.get('pageSize'), '10');
  assert.equal(requestUrl.searchParams.get('pageNumber'), '2');
  assert.equal(requestOptions.method, 'GET');
  assert.equal(result.data, rawPayload);
  assert.deepEqual(result.sourceMetadata, {
    source: 'USDA FoodData Central',
    license: 'CC0-1.0',
    endpoint: '/foods/search',
    retrievedAt: '2026-01-02T03:04:05.000Z',
    rateLimit: { limit: 1000, remaining: 998 },
    etag: 'abc',
    lastModified: null,
  });
  assert.equal(JSON.stringify(result).includes('server-test-key'), false);
});

test('FDC detail lookup validates ID and preserves raw release metadata', async () => {
  const rawPayload = { fdcId: 321, dataType: 'SR Legacy', publicationDate: '2019-04-01', foodNutrients: [] };
  let requestedUrl;
  const client = createFoodDataCentralClient({
    apiKey: 'key',
    fetchImpl: async (url) => { requestedUrl = new URL(url); return response({ body: rawPayload }); },
  });

  const result = await client.getFood(321);
  assert.equal(requestedUrl.pathname, '/fdc/v1/food/321');
  assert.equal(result.data, rawPayload);
  assert.equal(result.data.publicationDate, '2019-04-01');
});

test('client reports unconfigured key without making a request', async () => {
  let called = false;
  const client = createFoodDataCentralClient({ apiKey: null, fetchImpl: async () => { called = true; } });
  await assert.rejects(client.searchFoods('rice'), { code: 'FDC_NOT_CONFIGURED', statusCode: 503 });
  assert.equal(called, false);
});

test('client validates query, page size, and food identifiers', async () => {
  const client = createFoodDataCentralClient({ apiKey: 'key', fetchImpl: async () => response({ body: { foods: [] } }) });
  await assert.rejects(client.searchFoods('  '), { code: 'FDC_QUERY_INVALID' });
  await assert.rejects(client.searchFoods('rice', { pageSize: 201 }), { code: 'FDC_PARAMETER_INVALID' });
  await assert.rejects(client.getFood(0), { code: 'FDC_PARAMETER_INVALID' });
});

test('FDC 429 response exposes rate limit and retry delay without automatic retry', async () => {
  let calls = 0;
  const client = createFoodDataCentralClient({
    apiKey: 'key',
    fetchImpl: async () => {
      calls += 1;
      return response({ status: 429, headers: { 'retry-after': '30', 'x-ratelimit-limit': '1000', 'x-ratelimit-remaining': '0' } });
    },
  });
  await assert.rejects(client.searchFoods('rice'), (error) => {
    assert.equal(error.code, 'FDC_RATE_LIMITED');
    assert.equal(error.statusCode, 429);
    assert.equal(error.retryAfterMs, 30_000);
    assert.deepEqual(error.rateLimit, { limit: 1000, remaining: 0 });
    return true;
  });
  assert.equal(calls, 1);
});

test('FDC timeout, network failure, non-JSON and unexpected responses are normalized', async () => {
  const timeoutClient = createFoodDataCentralClient({
    apiKey: 'key',
    fetchImpl: async () => { const error = new Error('timeout'); error.name = 'TimeoutError'; throw error; },
  });
  await assert.rejects(timeoutClient.searchFoods('rice'), { code: 'FDC_TIMEOUT', statusCode: 504 });

  const networkClient = createFoodDataCentralClient({ apiKey: 'key', fetchImpl: async () => { throw new Error('socket'); } });
  await assert.rejects(networkClient.searchFoods('rice'), { code: 'FDC_UNAVAILABLE', statusCode: 503 });

  const invalidJsonClient = createFoodDataCentralClient({ apiKey: 'key', fetchImpl: async () => ({ ...response(), json: async () => { throw new Error('invalid'); } }) });
  await assert.rejects(invalidJsonClient.searchFoods('rice'), { code: 'FDC_INVALID_RESPONSE', statusCode: 502 });

  const unexpectedClient = createFoodDataCentralClient({ apiKey: 'key', fetchImpl: async () => response({ body: { notFoods: [] } }) });
  await assert.rejects(unexpectedClient.searchFoods('rice'), { code: 'FDC_INVALID_RESPONSE', statusCode: 502 });
});
