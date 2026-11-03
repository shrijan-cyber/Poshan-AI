import Redis from 'ioredis';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';

let redisClient;

function unavailableError() {
  const error = new Error('Request protection is temporarily unavailable. Please try again.');
  error.statusCode = 503;
  error.code = 'RATE_LIMIT_STORE_UNAVAILABLE';
  return error;
}

function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis(env.redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
      retryStrategy: (attempt) => Math.min(attempt * 100, 3000),
    });
    redisClient.on('error', () => {});
  }
  return redisClient;
}

export class RedisWindowStore {
  constructor(prefix, clientProvider = getRedisClient) {
    this.prefix = `poshanai:ratelimit:${prefix}:`;
    this.clientProvider = clientProvider;
  }

  init({ windowMs }) {
    this.windowMs = windowMs;
  }

  async increment(key) {
    const script = [
      "local count = redis.call('INCR', KEYS[1])",
      "if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
      "return { count, redis.call('PTTL', KEYS[1]) }",
    ].join('\n');

    try {
      const [totalHits, ttl] = await this.clientProvider().eval(
        script,
        1,
        `${this.prefix}${key}`,
        this.windowMs,
      );
      return {
        totalHits: Number(totalHits),
        resetTime: new Date(Date.now() + Math.max(Number(ttl), 0)),
      };
    } catch {
      throw unavailableError();
    }
  }

  async decrement(key) {
    try {
      await this.clientProvider().decr(`${this.prefix}${key}`);
    } catch {
      throw unavailableError();
    }
  }

  async resetKey(key) {
    try {
      await this.clientProvider().del(`${this.prefix}${key}`);
    } catch {
      throw unavailableError();
    }
  }
}

export async function closeSensitiveRateLimitRedis() {
  if (!redisClient) return;
  const client = redisClient;
  redisClient = undefined;
  client.disconnect();
}

export function createSensitiveRateLimitStore(name) {
  if (env.nodeEnv === 'test' || !env.redisUrl) return undefined;
  return new RedisWindowStore(name);
}

export function sensitiveRateLimiter({ name, windowMs, limit }) {
  if (env.nodeEnv === 'test') return (_req, _res, next) => next();

  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: env.redisUrl ? new RedisWindowStore(name) : undefined,
    keyGenerator: (req) => req.user?._id
      ? `user:${req.user._id}`
      : `ip:${ipKeyGenerator(req.ip)}`,
    handler: (_req, res) => res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' },
    }),
  });
}
