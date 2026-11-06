import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import app from '../src/app.js';

test('GET /api/lifestyle/recommendations rejects unauthenticated requests', async () => {
  const response = await request(app).get('/api/lifestyle/recommendations');
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'UNAUTHORIZED');
});
