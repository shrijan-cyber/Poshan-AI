import Redis from 'ioredis';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { redisConnection } from '../jobs/queue.js';
import logger from '../utils/logger.js';

let healthRedis;

export function evaluateHealthStatus({ mongo, redis, isProduction, uptime }) {
  const status = !mongo || (isProduction && !redis) ? 'unhealthy' : redis ? 'ok' : 'degraded';
  const warning = !redis && mongo
    ? isProduction
      ? 'Redis is unavailable. Distributed rate limits and background jobs are not ready.'
      : 'Redis is offline. OCR will use synchronous fallback in this environment.'
    : undefined;

  return {
    status,
    checks: { mongo, redis, uptime },
    ...(warning ? { warning } : {}),
  };
}

export function getLivenessStatus() {
  return { status: 'ok', checks: { process: true, uptime: process.uptime() } };
}

function getHealthRedis() {
  if (!env.redisUrl) return null;
  if (!healthRedis || healthRedis.status === 'end') {
    healthRedis = new Redis(redisConnection(1, {
      lazyConnect: true,
      connectTimeout: 1000,
      commandTimeout: 1500,
      retryStrategy: (attempt) => (attempt <= 2 ? attempt * 100 : null),
    }));
    // Avoid logging the Redis error object because client errors can include
    // connection details. Readiness reports only a boolean dependency state.
    healthRedis.on('error', () => logger.error('Redis health check failed.'));
  }
  return healthRedis;
}

async function checkMongo() {
  try {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) return false;
    await mongoose.connection.db.command(
      { ping: 1 },
      { maxTimeMS: 1500, serverSelectionTimeoutMS: 1500 },
    );
    return true;
  } catch {
    return false;
  }
}

async function checkRedis() {
  try {
    const client = getHealthRedis();
    return Boolean(client && (await client.ping()) === 'PONG');
  } catch {
    return false;
  }
}

export async function getHealthStatus() {
  const [mongo, redis] = await Promise.all([checkMongo(), checkRedis()]);
  return evaluateHealthStatus({ mongo, redis, isProduction: env.isProduction, uptime: process.uptime() });
}

export async function closeHealthRedis() {
  healthRedis?.disconnect();
  healthRedis = null;
}
