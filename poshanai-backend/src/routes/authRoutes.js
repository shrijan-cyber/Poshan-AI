import { Router } from 'express';
import Joi from 'joi';
import { rateLimit } from 'express-rate-limit';
import { login, logout, refresh, register } from '../controllers/authController.js';
import validateRequest from '../middleware/validateRequest.js';

const router = Router();
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many authentication requests. Try again later.' },
  },
});

const registerSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  email: Joi.string().trim().email().max(254).required(),
  password: Joi.string().min(8).max(128).required(),
  age: Joi.number().integer().min(1).max(120).required(),
  gender: Joi.string().trim().min(1).max(30).required(),
  weightKg: Joi.number().min(1).max(500).required(),
  heightCm: Joi.number().min(30).max(300).required(),
  dietType: Joi.string().valid('veg', 'non-veg', 'vegan').required(),
  allergies: Joi.array().items(Joi.string().trim().max(100)).default([]),
  region: Joi.string().trim().max(100),
  activityLevel: Joi.string().trim().max(50),
}).required();

const loginSchema = Joi.object({
  email: Joi.string().trim().email().max(254).required(),
  password: Joi.string().min(8).max(128).required(),
}).required();

const emptySchema = Joi.object({}).unknown(false);

router.use(authRateLimit);
router.post('/register', validateRequest(registerSchema), register);
router.post('/login', validateRequest(loginSchema), login);
router.post('/refresh', validateRequest(emptySchema), refresh);
router.post('/logout', validateRequest(emptySchema), logout);

export default router;
