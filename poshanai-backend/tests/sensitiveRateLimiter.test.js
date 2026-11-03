import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RedisWindowStore } from '../src/middleware/sensitiveRateLimiter.js';

describe('RedisWindowStore', () => {
  it('increments a namespaced key and returns the reset time', async () => {
    const calls = [];
    const store = new RedisWindowStore('auth-login', () => ({
      eval: async (...args) => {
        calls.push(args);
        return [3, 12_000];
      },
    }));
    store.init({ windowMs: 60_000 });

    const result = await store.increment('client-key');

    assert.equal(result.totalHits, 3);
    assert.ok(result.resetTime instanceof Date);
    assert.equal(result.resetTime.getTime() - Date.now() <= 12_000, true);
    assert.equal(calls[0][1], 1);
    assert.equal(calls[0][2], 'poshanai:ratelimit:auth-login:client-key');
    assert.equal(calls[0][3], 60_000);
  });

  it('supports decrement and reset using the same namespace', async () => {
    const calls = [];
    const client = {
      decr: async (key) => calls.push(['decr', key]),
      del: async (key) => calls.push(['del', key]),
    };
    const store = new RedisWindowStore('api', () => client);

    await store.decrement('client-key');
    await store.resetKey('client-key');

    assert.deepEqual(calls, [
      ['decr', 'poshanai:ratelimit:api:client-key'],
      ['del', 'poshanai:ratelimit:api:client-key'],
    ]);
  });

  it('fails closed when Redis cannot increment the key', async () => {
    const store = new RedisWindowStore('api', () => ({
      eval: async () => { throw new Error('offline'); },
    }));
    store.init({ windowMs: 60_000 });

    await assert.rejects(store.increment('client-key'), {
      statusCode: 503,
      code: 'RATE_LIMIT_STORE_UNAVAILABLE',
    });
  });

  it('recovers after a simulated Redis outage without opening the rate limit', async () => {
    let available = false;
    const store = new RedisWindowStore('api', () => ({
      eval: async () => {
        if (!available) throw new Error('simulated outage');
        return [2, 30_000];
      },
    }));
    store.init({ windowMs: 60_000 });

    await assert.rejects(store.increment('client-key'), {
      statusCode: 503,
      code: 'RATE_LIMIT_STORE_UNAVAILABLE',
    });

    available = true;
    const result = await store.increment('client-key');
    assert.equal(result.totalHits, 2);
  });

  it('sanitizes Redis errors from decrement and reset operations', async () => {
    const store = new RedisWindowStore('api', () => ({
      decr: async () => { throw new Error('redis://user:secret@host'); },
      del: async () => { throw new Error('redis://user:secret@host'); },
    }));

    await assert.rejects(store.decrement('client-key'), {
      statusCode: 503,
      code: 'RATE_LIMIT_STORE_UNAVAILABLE',
      message: 'Request protection is temporarily unavailable. Please try again.',
    });
    await assert.rejects(store.resetKey('client-key'), {
      statusCode: 503,
      code: 'RATE_LIMIT_STORE_UNAVAILABLE',
      message: 'Request protection is temporarily unavailable. Please try again.',
    });
  });
});
