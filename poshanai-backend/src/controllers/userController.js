import Joi from 'joi';
import User from '../models/User.js';
import logger from '../utils/logger.js';

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

export async function getCurrentUser(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'The user account was not found.' },
      });
    }

    return res.json({ success: true, data: { user: publicUser(user) } });
  } catch (error) {
    next(error);
  }
}

const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100),
  age: Joi.number().integer().min(1).max(120),
  gender: Joi.string().trim().min(1).max(30),
  weightKg: Joi.number().min(1).max(500),
  heightCm: Joi.number().min(30).max(300),
  dietType: Joi.string().valid('veg', 'non-veg', 'vegan'),
  allergies: Joi.array().items(Joi.string().trim().max(100)),
  region: Joi.string().trim().max(100),
  activityLevel: Joi.string().trim().max(50),
}).min(1).required();

export async function updateCurrentUser(req, res, next) {
  try {
    const { error, value } = updateProfileSchema.validate(req.body, {
      abortEarly: false,
      convert: true,
      stripUnknown: true,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details.map(({ message }) => message).join('; '),
        },
      });
    }

    const profileUpdate = {};
    for (const [key, val] of Object.entries(value)) {
      profileUpdate[`profile.${key}`] = val;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: profileUpdate },
      { new: true, runValidators: true },
    );
    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'The user account was not found.' },
      });
    }

    logger.info('User profile updated', { userId: user.id });
    return res.json({ success: true, data: { user: publicUser(user) } });
  } catch (error) {
    next(error);
  }
}

export async function listAllUsers(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments({}),
    ]);

    return res.json({
      success: true,
      data: {
        users: users.map(publicUser),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    next(error);
  }
}

const changeRoleSchema = Joi.object({
  role: Joi.string().valid('user', 'dietitian', 'admin').required(),
}).required();

export async function changeUserRole(req, res, next) {
  try {
    const { error, value } = changeRoleSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details.map(({ message }) => message).join('; '),
        },
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { role: value.role } },
      { new: true, runValidators: true },
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found.' },
      });
    }

    logger.info('User role changed', { userId: user.id, newRole: value.role });
    return res.json({ success: true, data: { user: publicUser(user) } });
  } catch (error) {
    next(error);
  }
}
