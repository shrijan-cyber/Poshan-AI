import assert from 'node:assert/strict';
import test, { before, after, beforeEach } from 'node:test';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import LifestyleProfile from '../src/models/LifestyleProfile.js';
import Notification from '../src/models/Notification.js';
import Report from '../src/models/Report.js';
import { env } from '../src/config/env.js';
import { loadTestRules, validateTestRules } from '../src/services/testRules.js';
import { sendRetestReminders } from '../src/services/retestReminderService.js';

let mongod;

const completeProfile = {
  consentGiven: true,
  dietType: 'veg',
  mealsPerDay: 3,
  typicalDiet: ['roti', 'dal', 'rice'],
  sleepHours: 7,
  sleepTime: 'late night',
  sunExposure: 'low',
  activityLevel: 'sedentary',
  habits: ['none'],
  symptoms: ['fatigue', 'hair fall'],
  region: 'North India',
};

async function createUser(email = 'lifestyle@example.com') {
  const user = await User.create({
    name: 'Lifestyle User',
    email,
    passwordHash: 'not-used-by-this-test',
    consent: { given: true, givenAt: new Date() },
  });
  return {
    user,
    token: jwt.sign({ role: 'user', type: 'access' }, env.jwtAccessSecret, {
      subject: user.id,
    }),
  };
}

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    LifestyleProfile.deleteMany({}),
    Notification.deleteMany({}),
    Report.deleteMany({}),
  ]);
});

test('requires a JWT for onboarding and notification routes', async () => {
  assert.equal(
    (await request(app).post('/api/lifestyle/onboarding').send(completeProfile)).status,
    401,
  );
  assert.equal((await request(app).get('/api/notifications')).status, 401);
});

test('validates onboarding and overwrites one profile per authenticated user', async () => {
  const { user, token } = await createUser();
  const url = '/api/lifestyle/onboarding';
  const first = await request(app)
    .post(url)
    .set('Authorization', `Bearer ${token}`)
    .send(completeProfile);
  assert.equal(first.status, 200);
  assert.equal(first.body.data.dietType, 'veg');
  assert.equal(first.body.data.userId, undefined);

  const updated = {
    ...completeProfile,
    dietType: 'vegan',
    mealsPerDay: 4,
    region: 'South India',
  };
  const second = await request(app).post(url).set('Authorization', `Bearer ${token}`).send(updated);
  assert.equal(second.status, 200);
  assert.equal(second.body.data.dietType, 'vegan');
  assert.equal(await LifestyleProfile.countDocuments({ userId: user._id }), 1);
  assert.equal((await LifestyleProfile.findOne({ userId: user._id })).region, 'South India');

  const invalid = await request(app)
    .post(url)
    .set('Authorization', `Bearer ${token}`)
    .send({ ...updated, consentGiven: false });
  assert.equal(invalid.status, 400);
});

test('returns only unread notifications owned by the current user', async () => {
  const { user, token } = await createUser();
  const other = await createUser('other@example.com');
  await Notification.create([
    {
      userId: user._id,
      title: 'Unread',
      message: 'Discuss with your doctor.',
      type: 'retest_reminder',
    },
    {
      userId: user._id,
      title: 'Read',
      message: 'Already read.',
      type: 'retest_reminder',
      isRead: true,
    },
    {
      userId: other.user._id,
      title: 'Other',
      message: 'Private.',
      type: 'retest_reminder',
    },
  ]);

  const response = await request(app)
    .get('/api/notifications')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.data.notifications.map(({ title }) => title),
    ['Unread'],
  );
  assert.equal(response.body.data.notifications[0].userId, undefined);
});

test('creates one reminder per completed report at 90 days and remains idempotent', async () => {
  const { user } = await createUser();
  const now = new Date('2026-10-18T12:00:00Z');
  const report = await Report.create({
    userId: user._id,
    fileUrl: 'uploads/reports/123e4567-e89b-12d3-a456-426614174000.pdf',
    fileSizeBytes: 1024,
    fileType: 'application/pdf',
    ocrStatus: 'completed',
    uploadedAt: new Date(now.getTime() - 91 * 24 * 60 * 60 * 1000),
  });

  assert.deepEqual(await sendRetestReminders({ now }), {
    scanned: 1,
    created: 1,
  });
  assert.deepEqual(await sendRetestReminders({ now }), {
    scanned: 0,
    created: 0,
  });
  assert.equal(
    await Notification.countDocuments({
      userId: user._id,
      type: 'retest_reminder',
    }),
    1,
  );
  assert.ok((await Report.findById(report._id)).retestReminderSentAt);
});

test('testRules allow only doctor-discussion suggestions', () => {
  assert.deepEqual(loadTestRules().rules, []);
  assert.throws(() =>
    validateTestRules({
      version: 1,
      disclaimer: 'Suggestions to discuss with a doctor.',
      rules: [{ id: 'bad', suggestion: 'You have a deficiency and need a test.' }],
    }),
  );
});
