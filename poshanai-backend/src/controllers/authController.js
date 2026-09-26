import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_COOKIE = 'refreshToken';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/auth',
};

function tokenSecret(name) {
  const secret = process.env[name];
  if (!secret || secret.length < 32) {
    throw new Error(`${name} must be configured with at least 32 characters.`);
  }
  return secret;
}

function issueTokens(user) {
  const claims = { role: user.role };
  const accessToken = jwt.sign({ ...claims, tokenUse: 'access' }, tokenSecret('JWT_ACCESS_SECRET'), {
    subject: user.id,
    expiresIn: ACCESS_TOKEN_TTL,
    algorithm: 'HS256',
  });
  const refreshToken = jwt.sign({ ...claims, tokenUse: 'refresh' }, tokenSecret('JWT_REFRESH_SECRET'), {
    subject: user.id,
    expiresIn: REFRESH_TOKEN_TTL,
    algorithm: 'HS256',
  });
  return { accessToken, refreshToken };
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, COOKIE_OPTIONS);
}

function publicUser(user) {
  return {
    id: user.id,
    firebaseUid: user.firebaseUid,
    email: user.email,
    role: user.role,
    profile: user.profile,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    isActive: user.isActive,
  };
}

function sendAuthError(res, status, code, message) {
  return res.status(status).json({ success: false, error: { code, message } });
}

export async function register(req, res) {
  try {
    const email = req.body.email.toLowerCase();
    if (await User.exists({ email })) {
      return sendAuthError(res, 409, 'EMAIL_EXISTS', 'An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const {
      name, age, gender, weightKg, heightCm, dietType, allergies = [], region, activityLevel,
    } = req.body;
    const user = await User.create({
      email,
      passwordHash,
      profile: { name, age, gender, weightKg, heightCm, dietType, allergies, region, activityLevel },
    });
    const { accessToken, refreshToken } = issueTokens(user);
    await RefreshToken.create({
      userId: user._id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_COOKIE_MAX_AGE),
    });
    setRefreshCookie(res, refreshToken);

    return res.status(201).json({
      success: true,
      data: { user: publicUser(user), accessToken },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return sendAuthError(res, 409, 'EMAIL_EXISTS', 'An account with this email already exists.');
    }
    if (error.message?.includes('JWT_')) {
      return sendAuthError(res, 500, 'AUTH_CONFIGURATION_ERROR', 'Authentication is not configured.');
    }
    return sendAuthError(res, 500, 'REGISTER_FAILED', 'Unable to register this account.');
  }
}

export async function login(req, res) {
  try {
    const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+passwordHash');
    if (!user || !user.isActive || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
      return sendAuthError(res, 401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }

    const { accessToken, refreshToken } = issueTokens(user);
    await RefreshToken.deleteMany({ userId: user._id });
    await RefreshToken.create({
      userId: user._id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_COOKIE_MAX_AGE),
    });
    setRefreshCookie(res, refreshToken);

    return res.json({ success: true, data: { user: publicUser(user), accessToken } });
  } catch (error) {
    if (error.message?.includes('JWT_')) {
      return sendAuthError(res, 500, 'AUTH_CONFIGURATION_ERROR', 'Authentication is not configured.');
    }
    return sendAuthError(res, 500, 'LOGIN_FAILED', 'Unable to log in.');
  }
}

export async function refresh(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) return sendAuthError(res, 401, 'REFRESH_REQUIRED', 'A refresh token is required.');

  try {
    const payload = jwt.verify(token, tokenSecret('JWT_REFRESH_SECRET'), { algorithms: ['HS256'] });
    if (payload.tokenUse !== 'refresh' || !payload.sub) throw new Error('Invalid token');

    const storedToken = await RefreshToken.findOne({
      userId: payload.sub,
      tokenHash: hashToken(token),
      expiresAt: { $gt: new Date() },
    });
    if (!storedToken) {
      clearRefreshCookie(res);
      return sendAuthError(res, 401, 'INVALID_REFRESH_TOKEN', 'The refresh token is invalid or expired.');
    }
    const consumed = await RefreshToken.deleteOne({ _id: storedToken._id });
    if (consumed.deletedCount !== 1) {
      clearRefreshCookie(res);
      return sendAuthError(res, 401, 'INVALID_REFRESH_TOKEN', 'The refresh token is invalid or expired.');
    }

    const user = await User.findById(payload.sub);
    if (!user?.isActive) {
      clearRefreshCookie(res);
      return sendAuthError(res, 401, 'INVALID_REFRESH_TOKEN', 'The refresh token is invalid or expired.');
    }

    const tokens = issueTokens(user);
    await RefreshToken.create({
      userId: user._id,
      tokenHash: hashToken(tokens.refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_COOKIE_MAX_AGE),
    });
    setRefreshCookie(res, tokens.refreshToken);
    return res.json({ success: true, data: { accessToken: tokens.accessToken } });
  } catch (error) {
    clearRefreshCookie(res);
    if (error.message?.includes('JWT_')) {
      return sendAuthError(res, 500, 'AUTH_CONFIGURATION_ERROR', 'Authentication is not configured.');
    }
    return sendAuthError(res, 401, 'INVALID_REFRESH_TOKEN', 'The refresh token is invalid or expired.');
  }
}

export async function logout(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    try {
      const payload = jwt.verify(token, tokenSecret('JWT_REFRESH_SECRET'), { algorithms: ['HS256'] });
      if (payload.tokenUse === 'refresh' && payload.sub) {
        await RefreshToken.deleteOne({ userId: payload.sub, tokenHash: hashToken(token) });
      }
    } catch {
      // Always clear the client cookie, even when its token is expired or invalid.
    }
  }
  clearRefreshCookie(res);
  return res.json({ success: true, data: { message: 'Logged out successfully.' } });
}
