import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';
import { redisConnection } from './queue.js';

export const mealPlanQueueName = 'meal-plan-generation';
let queue;
let queueErrorLogged = false;

function getQueue() {
  if (!queue) {
    queue = new Queue(mealPlanQueueName, {
      connection: redisConnection(1, {
        connectTimeout: 2000,
        retryStrategy: (attempt) => (attempt <= 2 ? 250 : null),
      }),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { age: 86400, count: 500 },
        removeOnFail: { age: 604800, count: 1000 },
      },
    });
    queue.on('error', () => {
      if (queueErrorLogged) return;
      queueErrorLogged = true;
      logger.warn('The meal-plan generation queue is unavailable.');
    });
  }
  return queue;
}

function isRedisUnavailable(error) {
  const unavailableCodes = new Set([
    'REDIS_NOT_CONFIGURED', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH',
    'ENETUNREACH', 'EAI_AGAIN', 'ECONNABORTED', 'ENOTFOUND', 'EHOSTDOWN',
  ]);
  return unavailableCodes.has(error?.code)
    || error?.name === 'MaxRetriesPerRequestError'
    || /redis.*(?:unavailable|not configured|connect)|connection.*(?:closed|timeout|refused|lost)|failed to connect to redis|ECONNREFUSED|ETIMEDOUT/i.test(String(error?.message ?? ''));
}

export async function enqueueMealPlanGeneration({ userId, reportId, preferences = {} }) {
  if (env.nodeEnv !== 'production' || !env.redisUrl) return null;
  const jobId = randomUUID();
  let activeQueue;
  try {
    activeQueue = getQueue();
    await activeQueue.add('generate-meal-plan', {
      userId: String(userId), reportId: String(reportId), preferences,
    }, { jobId });
    queueErrorLogged = false;
    return jobId;
  } catch (error) {
    if (!isRedisUnavailable(error)) throw error;
    logger.warn('Redis is unavailable; meal-plan generation will run synchronously.');
    queue = null;
    queueErrorLogged = false;
    try {
      await activeQueue?.close();
    } catch {
      logger.warn('The unavailable meal-plan queue could not be closed cleanly.');
    }
    return null;
  }
}

export async function getMealPlanJob(jobId) {
  return getQueue().getJob(jobId);
}

export async function closeMealPlanQueue() {
  await queue?.close();
  queue = null;
  queueErrorLogged = false;
}
