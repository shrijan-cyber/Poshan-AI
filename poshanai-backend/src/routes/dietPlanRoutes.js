import { Router } from 'express';
import Joi from 'joi';
import { verifyToken } from '../middleware/authMiddleware.js';
import * as dietPlanController from '../controllers/dietPlanController.js';
import validationError from '../utils/validationError.js';
import { sensitiveRateLimiter } from '../middleware/sensitiveRateLimiter.js';

const router = Router();
const generationLimiter = sensitiveRateLimiter({ name: 'basic-diet-generation', windowMs: 60 * 60 * 1000, limit: 10 });

const basicPlanSchema = Joi.object({
  age: Joi.number().integer().min(18).max(100).required(),
  gender: Joi.string().valid('male', 'female', 'other').required(),
  weightKg: Joi.number().min(30).max(300).required(),
  heightCm: Joi.number().min(120).max(250).required(),
  activityLevel: Joi.string().valid('sedentary', 'light', 'moderate', 'active', 'very_active').required(),
  goal: Joi.string().valid('lose', 'maintain', 'gain').required(),
  dietType: Joi.string().valid('veg', 'eggetarian', 'nonveg', 'non-veg', 'vegan').required(),
  mealsPerDay: Joi.number().integer().min(1).max(10).required(),
  dislikes: Joi.array().items(Joi.string().trim().min(1).max(80)).max(50).unique().default([]),
  allergies: Joi.array().items(Joi.string().trim().min(1).max(80)).max(20).unique().default([]),
  conditions: Joi.array().items(Joi.string().trim().min(2).max(80)).max(20).unique().default([]),
  preferredFoods: Joi.array().items(Joi.string().trim().min(1).max(80)).max(30).unique().default([]),
  typicalDiet: Joi.alternatives().try(
    Joi.string().trim().max(600),
    Joi.array().items(Joi.string().trim().min(1).max(80)).max(20),
  ).default(''),
}).unknown(false);

const idSchema = Joi.object({ id: Joi.string().hex().length(24).required() }).unknown(false);

function validateBody(schema) {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req.body ?? {}, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) return next(validationError());
    req.body = value;
    return next();
  };
}

function validateParams(schema) {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req.params ?? {}, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) return next(validationError());
    req.params = value;
    return next();
  };
}

router.post('/generate-basic', verifyToken, generationLimiter, validateBody(basicPlanSchema), dietPlanController.generateBasic);
router.get('/:id/grocery-list', verifyToken, validateParams(idSchema), dietPlanController.getGroceryList);
router.get('/', verifyToken, dietPlanController.list);

export default router;
