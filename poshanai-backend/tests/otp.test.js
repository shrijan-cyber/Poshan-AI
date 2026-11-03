import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createHash } from 'node:crypto';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import Otp from '../src/models/Otp.js';
import User from '../src/models/User.js';

let mongod;
let ipCounter = 90;

function nextIp() {
  return `10.0.2.${((ipCounter++ - 1) % 250) + 1}`;
}

async function createUser(email) {
  const user = new User({
    name: 'OTP Test User',
    email,
    consent: { given: true, givenAt: new Date(), version: '1.0' },
  });
  await user.setPassword('originalPassword123');
  await user.save();
  return user;
}

async function requestCode(email, purpose) {
  return request(app)
    .post('/api/v1/auth/otp/request')
    .set('X-Forwarded-For', nextIp())
    .send({ email, purpose });
}

async function verifyCode(email, purpose, otp) {
  return request(app)
    .post('/api/v1/auth/otp/verify')
    .set('X-Forwarded-For', nextIp())
    .send({ email, purpose, otp });
}

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([User.init(), Otp.init()]);
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Otp.deleteMany({})]);
});

describe('Email OTP API', () => {
  it('defaults new users to email verified while email verification is out of MVP scope', async () => {
    const user = await createUser('otp-default-verified@example.com');
    assert.equal(user.emailVerified, true);
    assert.equal((await User.findById(user._id)).emailVerified, true);
  });

  it('stores only a bcrypt hash, expires in five minutes, and does not reveal account existence', async () => {
    await createUser('otp-login@example.com');
    const response = await requestCode('otp-login@example.com', 'login');

    assert.equal(response.status, 200);
    assert.match(response.body.data.dev_otp, /^\d{6}$/);
    const stored = await Otp.findOne({ email: 'otp-login@example.com', purpose: 'login' }).select('+otpHash');
    assert.ok(stored);
    assert.notEqual(stored.otpHash, response.body.data.dev_otp);
    assert.equal(await bcrypt.compare(response.body.data.dev_otp, stored.otpHash), true);
    assert.ok(stored.expiresAt.getTime() > Date.now() + 4 * 60 * 1000);
    assert.ok(stored.expiresAt.getTime() <= Date.now() + 5 * 60 * 1000);

    const unknown = await requestCode('missing@example.com', 'login');
    assert.equal(unknown.status, 200);
    assert.equal(unknown.body.data.message, response.body.data.message);
    assert.equal(unknown.body.data.dev_otp, undefined);
  });

  it('never returns OTP codes from staging-like environments', async () => {
    const previousEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = 'staging';
    try {
      await createUser('otp-staging@example.com');
      const response = await requestCode('otp-staging@example.com', 'login');
      assert.equal(response.status, 200);
      assert.equal(response.body.data.dev_otp, undefined);
      assert.ok(await Otp.exists({ email: 'otp-staging@example.com', purpose: 'login' }));
    } finally {
      process.env.NODE_ENV = previousEnvironment;
    }
  });

  it('consumes a valid login OTP once and issues the existing JWT and refresh-cookie session', async () => {
    await createUser('otp-login@example.com');
    const requested = await requestCode('otp-login@example.com', 'login');
    const verified = await verifyCode('otp-login@example.com', 'login', requested.body.data.dev_otp);

    assert.equal(verified.status, 200);
    assert.ok(verified.body.data.accessToken);
    assert.equal(verified.body.data.user.emailVerified, true);
    assert.ok((verified.headers['set-cookie'] ?? []).some((cookie) => cookie.startsWith('refreshToken=')));
    assert.equal(await Otp.countDocuments({ email: 'otp-login@example.com' }), 0);

    const replay = await verifyCode('otp-login@example.com', 'login', requested.body.data.dev_otp);
    assert.equal(replay.status, 400);
    assert.equal(replay.body.error.code, 'OTP_INVALID_OR_EXPIRED');
  });

  it('deletes the challenge after three incorrect codes and blocks the correct code afterward', async () => {
    await createUser('otp-attempts@example.com');
    const requested = await requestCode('otp-attempts@example.com', 'login');

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const response = await verifyCode('otp-attempts@example.com', 'login', '000000');
      assert.equal(response.status, 400);
      if (attempt === 3) assert.equal(response.body.error.code, 'OTP_MAX_ATTEMPTS');
    }

    assert.equal(await Otp.countDocuments({ email: 'otp-attempts@example.com' }), 0);
    const correctAfterLimit = await verifyCode('otp-attempts@example.com', 'login', requested.body.data.dev_otp);
    assert.equal(correctAfterLimit.status, 400);
  });

  it('rejects expired OTPs even before the TTL monitor removes them', async () => {
    await createUser('otp-expired@example.com');
    const requested = await requestCode('otp-expired@example.com', 'login');
    await Otp.updateOne(
      { email: 'otp-expired@example.com', purpose: 'login' },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );

    const verified = await verifyCode('otp-expired@example.com', 'login', requested.body.data.dev_otp);
    assert.equal(verified.status, 400);
    assert.equal(verified.body.error.code, 'OTP_INVALID_OR_EXPIRED');
  });

  it('invalidates a previous code when a new code is requested for the same purpose', async () => {
    await createUser('otp-resend@example.com');
    const first = await requestCode('otp-resend@example.com', 'login');
    const second = await requestCode('otp-resend@example.com', 'login');
    assert.notEqual(first.body.data.dev_otp, second.body.data.dev_otp);

    const oldCode = await verifyCode('otp-resend@example.com', 'login', first.body.data.dev_otp);
    assert.equal(oldCode.status, 400);
    const currentCode = await verifyCode('otp-resend@example.com', 'login', second.body.data.dev_otp);
    assert.equal(currentCode.status, 200);
  });

  it('resets the password with a single-use reset token and revokes refresh sessions', async () => {
    const user = await createUser('otp-reset@example.com');
    user.refreshTokens.push({ hash: 'test-refresh-hash', deviceInfo: 'test', createdAt: new Date() });
    await user.save();

    const requested = await requestCode('otp-reset@example.com', 'reset-password');
    const verified = await verifyCode('otp-reset@example.com', 'reset-password', requested.body.data.dev_otp);
    assert.equal(verified.status, 200);
    assert.ok(verified.body.data.resetToken);
    assert.equal(verified.body.data.expiresInSeconds, 600);
    const resetUser = await User.findById(user._id).select('+passwordResetTokenHash');
    assert.equal(resetUser.passwordResetTokenHash, createHash('sha256').update(verified.body.data.resetToken).digest('hex'));
    assert.notEqual(resetUser.passwordResetTokenHash, verified.body.data.resetToken);

    const reset = await request(app)
      .post('/api/v1/auth/otp/reset-password')
      .set('X-Forwarded-For', nextIp())
      .send({ resetToken: verified.body.data.resetToken, password: 'updatedPassword456' });
    assert.equal(reset.status, 200);

    const updated = await User.findById(user._id).select('+passwordHash +passwordResetTokenHash +refreshTokens +tokenVersion');
    assert.equal(await updated.verifyPassword('originalPassword123'), false);
    assert.equal(await updated.verifyPassword('updatedPassword456'), true);
    assert.equal(updated.refreshTokens.length, 0);
    assert.equal(updated.tokenVersion, 1);
    assert.equal(updated.passwordResetTokenHash, undefined);

    const replay = await request(app)
      .post('/api/v1/auth/otp/reset-password')
      .set('X-Forwarded-For', nextIp())
      .send({ resetToken: verified.body.data.resetToken, password: 'anotherPassword789' });
    assert.equal(replay.status, 400);
    assert.equal(replay.body.error.code, 'RESET_TOKEN_INVALID');
  });

  it('rejects an expired password-reset token', async () => {
    const user = await createUser('otp-reset-expired@example.com');
    const requested = await requestCode('otp-reset-expired@example.com', 'reset-password');
    const verified = await verifyCode('otp-reset-expired@example.com', 'reset-password', requested.body.data.dev_otp);
    await User.updateOne({ _id: user._id }, { $set: { passwordResetTokenExpiresAt: new Date(Date.now() - 1000) } });

    const reset = await request(app)
      .post('/api/v1/auth/otp/reset-password')
      .set('X-Forwarded-For', nextIp())
      .send({ resetToken: verified.body.data.resetToken, password: 'updatedPassword456' });
    assert.equal(reset.status, 400);
    assert.equal(reset.body.error.code, 'RESET_TOKEN_INVALID');
  });

  it('rejects the removed verify-email OTP purpose', async () => {
    await createUser('otp-verify@example.com');
    const request = await requestCode('otp-verify@example.com', 'verify-email');
    assert.equal(request.status, 400);

    const verify = await verifyCode('otp-verify@example.com', 'verify-email', '123456');
    assert.equal(verify.status, 400);
  });

  it('validates purposes and codes and has the required MongoDB TTL index', async () => {
    assert.ok(Otp.schema.indexes().some(([, options]) => options.expireAfterSeconds === 0));

    const invalidPurpose = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ email: 'otp-validation@example.com', purpose: 'admin' });
    assert.equal(invalidPurpose.status, 400);

    const removedPurpose = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ email: 'otp-validation@example.com', purpose: 'verify-email' });
    assert.equal(removedPurpose.status, 400);

    const invalidCode = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ email: 'otp-validation@example.com', purpose: 'login', otp: '123' });
    assert.equal(invalidCode.status, 400);
  });
});
