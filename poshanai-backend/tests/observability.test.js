import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import request from 'supertest';
import requestLogger from '../src/middleware/requestLogger.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

test('server errors return a generic message and retain the request correlation ID', async () => {
  const app = express();
  app.use(requestLogger);
  app.get('/failure', (_req, _res, next) => {
    const error = new Error('private provider URL and secret payload');
    error.statusCode = 500;
    error.code = 'PRIVATE_FAILURE';
    next(error);
  });
  app.use(errorHandler);

  const response = await request(app).get('/failure');
  assert.equal(response.status, 500);
  assert.equal(response.body.error.message, 'An unexpected error occurred.');
  assert.doesNotMatch(JSON.stringify(response.body), /private provider URL|secret payload|PRIVATE_FAILURE/);
  assert.match(response.headers['x-request-id'], /^[0-9a-f-]{36}$/i);
  assert.equal(response.body.error.requestId, response.headers['x-request-id']);
});
