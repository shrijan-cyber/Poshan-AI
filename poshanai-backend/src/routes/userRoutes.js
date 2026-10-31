import { Router } from 'express';
import Joi from 'joi';
import { verifyToken } from '../middleware/authMiddleware.js';
import * as userController from '../controllers/userController.js';
import validationError from '../utils/validationError.js';

const router = Router();

const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).optional(),
  profile: Joi.object({
    age: Joi.number().min(13).max(100).optional(),
    gender: Joi.string().valid('male', 'female', 'other').optional(),
    weightKg: Joi.number().min(20).max(200).optional(),
    heightCm: Joi.number().min(100).max(250).optional(),
    activityLevel: Joi.string().valid('sedentary', 'moderate', 'active').optional(),
    dietType: Joi.string().valid('veg', 'non-veg', 'vegan', 'eggetarian').optional(),
    region: Joi.string().trim().max(80).optional(),
  }).min(1).unknown(false).optional(),
  consent: Joi.alternatives()
    .try(
      Joi.boolean(),
      Joi.object({
        given: Joi.boolean().required(),
        version: Joi.string().optional(),
      }),
    )
    .optional(),
}).min(1);

const saveProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  age: Joi.number().min(13).max(100).required(),
  gender: Joi.string().valid('male', 'female', 'other').required(),
  heightCm: Joi.number().min(100).max(250).required(),
  weightKg: Joi.number().min(20).max(200).required(),
  activityLevel: Joi.string().valid('sedentary', 'moderate', 'active').required(),
  dietaryPreference: Joi.string().valid('Veg', 'Non-Veg', 'Vegan').required(),
  monthlyFoodBudget: Joi.number().min(0).required(),
}).required();

const deleteAccountSchema = Joi.object({
  password: Joi.string().min(1).max(128).required(),
}).required();

function validate(schema) {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req.body ?? {}, { abortEarly: false, stripUnknown: true });
    if (error) return next(validationError());
    req.body = value;
    return next();
  };
}

router.get('/me', verifyToken, userController.getProfile);
router.patch('/me', verifyToken, validate(updateProfileSchema), userController.updateProfile);
router.post('/profile', verifyToken, validate(saveProfileSchema), userController.saveProfile);
router.get('/me/export', verifyToken, userController.exportUserData);
router.delete('/me', verifyToken, validate(deleteAccountSchema), userController.deleteAccount);

export default router;
