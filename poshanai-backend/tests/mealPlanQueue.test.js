import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from '../src/config/env.js';
import { closeMealPlanQueue, enqueueMealPlanGeneration } from '../src/jobs/mealPlanQueue.js';

test('meal-plan queue returns synchronous fallback in development mode', async () => {
  const originalEnv = env.nodeEnv;
  env.nodeEnv = 'development';
  try {
    const jobId = await enqueueMealPlanGeneration({
      userId: '507f1f77bcf86cd799439011',
      reportId: '507f1f77bcf86cd799439012',
    });
    assert.equal(jobId, null);
  } finally {
    env.nodeEnv = originalEnv;
  }
});

test('meal-plan queue returns synchronous fallback when the production Redis connection fails', async () => {
  const originalEnv = { nodeEnv: env.nodeEnv, redisUrl: env.redisUrl };
  env.nodeEnv = 'production';
  env.redisUrl = 'redis://127.0.0.1:1';
  try {
    const jobId = await enqueueMealPlanGeneration({
      userId: '507f1f77bcf86cd799439011',
      reportId: '507f1f77bcf86cd799439012',
    });
    assert.equal(jobId, null);
  } finally {
    await closeMealPlanQueue();
    env.nodeEnv = originalEnv.nodeEnv;
    env.redisUrl = originalEnv.redisUrl;
  }
});
