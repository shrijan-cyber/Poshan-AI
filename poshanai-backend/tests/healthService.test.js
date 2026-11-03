import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateHealthStatus, getLivenessStatus } from '../src/services/healthService.js';

describe('health readiness', () => {
  it('keeps process liveness healthy when dependencies are unavailable', () => {
    const result = getLivenessStatus();

    assert.equal(result.status, 'ok');
    assert.equal(result.checks.process, true);
  });

  it('reports production as unhealthy when its required Redis dependency is offline', () => {
    const result = evaluateHealthStatus({ mongo: true, redis: false, isProduction: true, uptime: 20 });

    assert.equal(result.status, 'unhealthy');
    assert.match(result.warning, /Distributed rate limits and background jobs/);
  });

  it('reports local Redis outages as degraded while Mongo remains available', () => {
    const result = evaluateHealthStatus({ mongo: true, redis: false, isProduction: false, uptime: 20 });

    assert.equal(result.status, 'degraded');
    assert.match(result.warning, /synchronous fallback/);
  });

  it('reports any environment as unhealthy when MongoDB is unavailable', () => {
    const result = evaluateHealthStatus({ mongo: false, redis: true, isProduction: false, uptime: 20 });

    assert.equal(result.status, 'unhealthy');
    assert.equal(result.checks.mongo, false);
  });
});
