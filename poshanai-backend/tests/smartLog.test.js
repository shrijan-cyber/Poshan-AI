import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import test, { before, mock } from 'node:test';
import request from 'supertest';

let app;
let accessToken;
const savedMeals = [];

class FakeDailyLog {
  static async findOneAndUpdate(filter, update) {
    const meal = { _id: `meal-${savedMeals.length + 1}`, ...update.$push.meals };
    savedMeals.push({ userId: String(filter.userId), date: filter.date, meal });
    return { meals: [meal] };
  }
}

before(async () => {
  mock.module('../src/models/DailyLog.js', { exports: { default: FakeDailyLog } });
  const { env } = await import('../src/config/env.js');
  accessToken = jwt.sign(
    { sub: 'aaaaaaaaaaaaaaaaaaaaaaaa', role: 'user', type: 'access' },
    env.jwtAccessSecret,
    { algorithm: 'HS256', expiresIn: '5m' },
  );
  app = (await import('../src/app.js?smart-log-validation')).default;
});

test('Smart Log preview and confirmation both use the validated DailyLog contract', async (t) => {
  savedMeals.length = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const requestBody = JSON.parse(options.body);
    const userMessage = requestBody.messages.find(({ role }) => role === 'user')?.content;
    const prompt = JSON.parse(userMessage);
    assert.equal(prompt.diaryText, '2 eggs for breakfast');
    assert.ok(prompt.ifctCatalog.some(({ ifctCode }) => ifctCode === 'M001'));
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ items: [
        { ifctCode: 'M001', quantityGrams: 100, mealType: 'breakfast' },
      ] }) } }] }),
    };
  });

  const response = await request(app)
    .post('/api/daily-logs/smart-log')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ text: '2 eggs for breakfast' });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.items[0].ifctCode, 'M001');
  assert.equal(response.body.data.items[0].quantityGrams, 100);
  assert.ok(response.body.data.items[0].calories > 0);

  const added = await request(app)
    .post('/api/daily-logs/add-food')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      mealType: response.body.data.items[0].mealType,
      ifctCode: response.body.data.items[0].ifctCode,
      quantityGrams: response.body.data.items[0].quantityGrams,
    });
  assert.equal(added.status, 201);
  assert.equal(added.body.data.meal.ifctCode, 'M001');
  assert.equal(savedMeals.length, 1);
});

test('Smart Log rejects missing and too-short text before calling the parser', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Parser must not be called for invalid request bodies.');
  });
  for (const body of [{}, { text: ' x ' }, { text: '2 eggs', otp: '123456' }]) {
    const response = await request(app)
      .post('/api/daily-logs/smart-log')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(body);
    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('Smart Log remains authenticated', async () => {
  const response = await request(app).post('/api/daily-logs/smart-log').send({ text: '2 eggs' });
  assert.equal(response.status, 401);
});

test('legacy /logs keeps its existing contract instead of intercepting DailyLog requests', async () => {
  const response = await request(app)
    .post('/api/logs/add-food')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ mealType: 'breakfast', ifctCode: 'M001', quantityGrams: 100 });
  assert.equal(response.status, 400);
  assert.equal(savedMeals.length, 1);
});
