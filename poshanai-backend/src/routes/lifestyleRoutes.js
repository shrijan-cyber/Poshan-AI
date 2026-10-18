import { Router } from 'express';
import Joi from 'joi';
import { saveOnboarding, getOnboarding } from '../controllers/lifestyleController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import validationError from '../utils/validationError.js';

const profileSchema = Joi.object({
  consentGiven: Joi.boolean().valid(true).required(),
  dietType: Joi.string().valid('veg', 'non-veg', 'vegan', 'eggetarian').required(),
  mealsPerDay: Joi.number().integer().min(1).max(6).required(),
  typicalDiet: Joi.array().items(Joi.string().trim().max(80)).max(10).required(),
  sleepHours: Joi.number().min(3).max(14).required(),
  sleepTime: Joi.string().valid('early', 'normal', 'late night').required(),
  sunExposure: Joi.string().valid('high', 'moderate', 'low').required(),
  activityLevel: Joi.string().valid('sedentary', 'moderate', 'active').required(),
  habits: Joi.array()
    .items(Joi.string().valid('smoking', 'alcohol', 'none'))
    .max(3)
    .required(),
  symptoms: Joi.array()
    .items(Joi.string().valid('fatigue', 'hair fall', 'bone pain', 'none'))
    .max(4)
    .required(),
  region: Joi.string().trim().max(100).required(),
})
  .required()
  .unknown(false);

function validateOnboarding(req, _res, next) {
  const { error, value } = profileSchema.validate(req.body ?? {}, {
    abortEarly: false,
    convert: true,
  });
  if (error) return next(validationError());
  req.body = value;
  return next();
}

const router = Router();
router.get('/onboarding', verifyToken, getOnboarding);
router.post('/onboarding', verifyToken, validateOnboarding, saveOnboarding);
export default router;
