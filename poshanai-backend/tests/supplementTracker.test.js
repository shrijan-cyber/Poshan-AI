import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import test, { before, beforeEach, mock } from 'node:test';
import request from 'supertest';

const userRows = [];
const historyRows = [];
const idOne = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const idTwo = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const supplementId = '111111111111111111111111';

class FakeUserSupplement {
  static find({ userId }) {
    return { sort: () => ({ lean: async () => userRows.filter((item) => item.userId === String(userId)).map((item) => ({ ...item })) }) };
  }
  static async create(data) {
    const row = { ...data, userId: String(data.userId), _id: supplementId, id: supplementId };
    userRows.push(row);
    return { ...row };
  }
  static findOneAndUpdate({ _id, userId }, { $set }) {
    return { lean: async () => {
      const row = userRows.find((item) => item._id === _id && item.userId === String(userId));
      if (!row) return null;
      Object.assign(row, Object.fromEntries(Object.entries($set).filter(([, value]) => value !== undefined)));
      return { ...row };
    } };
  }
  static async findOneAndDelete({ _id, userId }) {
    const index = userRows.findIndex((item) => item._id === _id && item.userId === String(userId));
    if (index < 0) return null;
    return userRows.splice(index, 1)[0];
  }
}

class FakeSupplementLog {
  static find(filter) {
    return {
      sort: () => ({ limit: () => ({ lean: async () => historyRows
        .filter((row) => row.userId === String(filter.userId)
          && (!filter.date?.$gte || row.date >= filter.date.$gte)
          && (!filter.date?.$lte || row.date <= filter.date.$lte))
        .slice(0, 50) }) }),
    };
  }
}

let app;
let tokenOne;
let tokenTwo;

before(async () => {
  mock.module('../src/models/UserSupplement.js', { exports: { default: FakeUserSupplement, unitByNutrient: { vitaminD: ['IU', 'µg', 'mcg'] } } });
  mock.module('../src/models/SupplementLog.js', { exports: { default: FakeSupplementLog } });
  const { env } = await import('../src/config/env.js');
  const sign = (sub) => jwt.sign({ sub, role: 'user', type: 'access' }, env.jwtAccessSecret, { algorithm: 'HS256', expiresIn: '5m' });
  tokenOne = sign(idOne);
  tokenTwo = sign(idTwo);
  app = (await import('../src/app.js?supplement-tracker-tests')).default;
});

beforeEach(() => {
  userRows.length = 0;
  historyRows.length = 0;
});

const validSupplement = {
  name: 'Daily D', brand: 'Example', servingSize: { amount: 1, unit: 'tablet' },
  dosage: { amount: 1, unit: 'tablet' },
  components: [{ nutrient: 'vitaminD', amount: 25, unit: 'µg' }],
  schedule: 'As recorded on my label', notes: 'User-entered note',
};

test('supplement CRUD validates units, preserves label values and isolates users', async () => {
  assert.equal((await request(app).get('/api/supplements/mine')).status, 401);
  const created = await request(app).post('/api/supplements/mine')
    .set('Authorization', `Bearer ${tokenOne}`).send(validSupplement);
  assert.equal(created.status, 201);
  assert.equal(created.body.data.supplement.brand, 'Example');
  assert.deepEqual(created.body.data.supplement.components[0], validSupplement.components[0]);

  const ownList = await request(app).get('/api/supplements/mine').set('Authorization', `Bearer ${tokenOne}`);
  const otherList = await request(app).get('/api/supplements/mine').set('Authorization', `Bearer ${tokenTwo}`);
  assert.equal(ownList.body.data.supplements.length, 1);
  assert.equal(otherList.body.data.supplements.length, 0);

  const invalidUnit = await request(app).post('/api/supplements/mine')
    .set('Authorization', `Bearer ${tokenOne}`)
    .send({ ...validSupplement, components: [{ nutrient: 'calcium', amount: 10, unit: 'IU' }] });
  assert.equal(invalidUnit.status, 400);

  const updated = await request(app).patch(`/api/supplements/mine/${supplementId}`)
    .set('Authorization', `Bearer ${tokenOne}`).send({ brand: 'Updated brand' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.supplement.brand, 'Updated brand');
  assert.equal(updated.body.data.supplement.name, validSupplement.name);

  assert.equal((await request(app).delete(`/api/supplements/mine/${supplementId}`)
    .set('Authorization', `Bearer ${tokenTwo}`)).status, 404);
  assert.equal((await request(app).delete(`/api/supplements/mine/${supplementId}`)
    .set('Authorization', `Bearer ${tokenOne}`)).status, 200);
});

test('supplement history is authenticated, date-filtered and owner-scoped', async () => {
  historyRows.push(
    { userId: idOne, date: '2026-11-04', supplementName: 'Iron' },
    { userId: idOne, date: '2026-11-01', supplementName: 'B12' },
    { userId: idTwo, date: '2026-11-04', supplementName: 'Private' },
  );
  const response = await request(app).get('/api/supplements/history?from=2026-11-03&to=2026-11-05')
    .set('Authorization', `Bearer ${tokenOne}`);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.entries.map((row) => row.supplementName), ['Iron']);
  assert.equal((await request(app).get('/api/supplements/history?from=2026-02-31')
    .set('Authorization', `Bearer ${tokenOne}`)).status, 400);
});
