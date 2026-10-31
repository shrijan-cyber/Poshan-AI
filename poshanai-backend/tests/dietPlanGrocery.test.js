import assert from 'node:assert/strict';
import { before, after, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import app from '../src/app.js';
import DietPlan from '../src/models/DietPlan.js';
import User from '../src/models/User.js';

let mongod;
let ipCounter = 60;

async function createAuthenticatedUser(name, email) {
  const ip = `10.0.5.${ipCounter++}`;
  const response = await request(app)
    .post('/api/auth/register')
    .set('X-Forwarded-For', ip)
    .send({ name, email, password: 'password123', consent: true });
  assert.equal(response.status, 201);
  return { user: response.body.data.user, token: response.body.data.accessToken, ip };
}

async function createPlan(userId, meals, overrides = {}) {
  return DietPlan.create({
    userId,
    goal: 'maintain',
    targetCalories: 2000,
    macros: { protein: 80, carbs: 250, fat: 65 },
    meals,
    type: 'basic',
    profile: {
      age: 30,
      gender: 'female',
      weightKg: 60,
      heightCm: 165,
      activityLevel: 'moderate',
      dietType: 'veg',
      mealsPerDay: 3,
      dislikes: [],
    },
    disclaimer: 'Educational nutrition information.',
    ...overrides,
  });
}

const legacyMeal = (items) => ({
  mealName: 'Lunch',
  calories: 500,
  macros: { protein: 20, carbs: 60, fat: 15 },
  items,
});

const structuredMeal = (ingredients) => ({
  mealName: 'Lunch',
  dishName: 'Vegetable curry',
  calories: 500,
  macros: { protein: 20, carbs: 60, fat: 15 },
  ingredients,
});

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await DietPlan.deleteMany({});
  await User.deleteMany({});
});

describe('GET /api/diet-plans/:id/grocery-list', () => {
  it('requires authentication and validates the plan ID', async () => {
    const unauthenticated = await request(app).get('/api/diet-plans/507f1f77bcf86cd799439011/grocery-list');
    assert.equal(unauthenticated.status, 401);
    assert.equal(unauthenticated.body.error.code, 'UNAUTHORIZED');

    const owner = await createAuthenticatedUser('ID validation', 'id-validation@example.com');
    const invalidId = await request(app)
      .get('/api/diet-plans/not-an-id/grocery-list')
      .set('Authorization', `Bearer ${owner.token}`)
      .set('X-Forwarded-For', owner.ip);
    assert.equal(invalidId.status, 400);
    assert.equal(invalidId.body.error.code, 'VALIDATION_ERROR');
  });

  it('returns 404 for a missing plan and for a plan owned by another user', async () => {
    const owner = await createAuthenticatedUser('Grocery owner', 'grocery-owner@example.com');
    const other = await createAuthenticatedUser('Other user', 'grocery-other@example.com');
    const plan = await createPlan(owner.user.id, [legacyMeal([
      { foodName: 'Onion, big', ifctCode: 'G017', quantity: 200 },
    ])]);

    const missing = await request(app)
      .get(`/api/diet-plans/${new mongoose.Types.ObjectId()}/grocery-list`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('X-Forwarded-For', owner.ip);
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, 'DIET_PLAN_NOT_FOUND');

    const forbiddenByNotFound = await request(app)
      .get(`/api/diet-plans/${plan._id}/grocery-list`)
      .set('Authorization', `Bearer ${other.token}`)
      .set('X-Forwarded-For', other.ip);
    assert.equal(forbiddenByNotFound.status, 404);
    assert.equal(forbiddenByNotFound.body.error.code, 'DIET_PLAN_NOT_FOUND');
  });

  it('aggregates duplicate legacy gram ingredients and persists the derived list', async () => {
    const owner = await createAuthenticatedUser('Legacy plan', 'legacy-grocery@example.com');
    const plan = await createPlan(owner.user.id, [
      legacyMeal([{ foodName: 'Onion, big', ifctCode: 'G017', quantity: 125 }]),
      legacyMeal([{ foodName: 'Onion, big', ifctCode: 'G017', quantity: 175 }]),
    ]);

    const response = await request(app)
      .get(`/api/diet-plans/${plan._id}/grocery-list`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('X-Forwarded-For', owner.ip);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.dietPlanId, String(plan._id));
    assert.deepEqual(response.body.data.groceryList, [{
      category: 'Vegetables',
      items: [{
        foodName: 'Pyaaz',
        ifctCodes: ['G017'],
        quantity: 300,
        unit: 'g',
        state: null,
        quantityGrams: 300,
        quantityLabel: '300 g',
      }],
    }]);

    const saved = await DietPlan.findById(plan._id).lean();
    assert.deepEqual(saved.groceryList, response.body.data.groceryList);
  });

  it('aggregates structured ingredients only when canonical name, unit, and state match', async () => {
    const owner = await createAuthenticatedUser('Structured plan', 'structured-grocery@example.com');
    const plan = await createPlan(owner.user.id, [
      structuredMeal([
        { ifctCode: 'G017', canonicalName: 'Onion', quantity: 0.5, unit: 'kg', state: 'raw' },
        { ifctCode: 'G017', canonicalName: 'Onion', quantity: 200, unit: 'g', state: 'raw' },
        { ifctCode: 'G017', canonicalName: 'Onion', quantity: 100, unit: 'g', state: 'cooked' },
      ]),
    ]);

    const response = await request(app)
      .get(`/api/diet-plans/${plan._id}/grocery-list`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('X-Forwarded-For', owner.ip);

    assert.equal(response.status, 200);
    const items = response.body.data.groceryList[0].items;
    assert.deepEqual(items.map(({ foodName, quantity, unit, state, quantityLabel }) => ({
      foodName, quantity, unit, state, quantityLabel,
    })), [
      { foodName: 'Pyaaz', quantity: 100, unit: 'g', state: 'cooked', quantityLabel: '100 g' },
      { foodName: 'Pyaaz', quantity: 700, unit: 'g', state: 'raw', quantityLabel: '700 g' },
    ]);
    assert.deepEqual(items[1].ifctCodes, ['G017']);
    assert.equal(items.some((item) => 'estimatedPrice' in item || 'purchaseQuantity' in item), false);
  });

  it('rejects high-risk conditions on the basic plan API, regardless of frontend validation', async () => {
    const owner = await createAuthenticatedUser('Condition plan', 'condition-plan@example.com');
    const response = await request(app)
      .post('/api/diet-plans/generate-basic')
      .set('Authorization', `Bearer ${owner.token}`)
      .set('X-Forwarded-For', owner.ip)
      .send({
        age: 35,
        gender: 'female',
        weightKg: 60,
        heightCm: 165,
        activityLevel: 'moderate',
        goal: 'maintain',
        dietType: 'veg',
        mealsPerDay: 3,
        conditions: ['diabetes'],
      });

    assert.equal(response.status, 422);
    assert.equal(response.body.error.code, 'PROFESSIONAL_REVIEW_REQUIRED');
    assert.match(response.body.error.message, /qualified healthcare professional/i);
  });
});
