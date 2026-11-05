import { Router } from 'express';
import * as supplementController from '../controllers/supplementController.js';
import Joi from 'joi';
import { MICRONUTRIENTS } from '../config/constants.js';
import { unitByNutrient } from '../models/UserSupplement.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import validationError from '../utils/validationError.js';

const router = Router();
const quantitySchema = Joi.object({
  amount: Joi.number().min(0.001).max(100000).required(),
  unit: Joi.string().trim().min(1).max(30).required(),
}).unknown(false);
const componentSchema = Joi.object({
  nutrient: Joi.string().valid(...MICRONUTRIENTS.map(({ key }) => key)).required(),
  amount: Joi.number().min(0).max(100000).required(),
  unit: Joi.string().trim().required(),
}).custom((value, helpers) => (unitByNutrient[value.nutrient]?.includes(value.unit)
  ? value
  : helpers.error('any.invalid'))).unknown(false);
const supplementFields = {
  name: Joi.string().trim().min(1).max(120).required(),
  brand: Joi.string().trim().allow('').max(120),
  servingSize: quantitySchema.required(),
  dosage: quantitySchema.allow(null),
  components: Joi.array().items(componentSchema).max(30),
  schedule: Joi.string().trim().allow('').max(160),
  notes: Joi.string().trim().allow('').max(1000),
};
const supplementSchema = Joi.object({
  ...supplementFields,
  brand: supplementFields.brand.default(null),
  dosage: supplementFields.dosage.default(null),
  components: supplementFields.components.default([]),
  schedule: supplementFields.schedule.default(null),
  notes: supplementFields.notes.default(null),
}).unknown(false);
const updateSupplementSchema = Joi.object(Object.fromEntries(Object.entries(supplementFields)
  .map(([key, schema]) => [key, schema.optional()]))).min(1).unknown(false);
const idSchema = Joi.object({ id: Joi.string().hex().length(24).required() }).unknown(false);
const dateKeySchema = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((value, helpers) => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? value
    : helpers.error('any.invalid');
});
const historyQuerySchema = Joi.object({
  from: dateKeySchema,
  to: dateKeySchema,
  limit: Joi.number().integer().min(1).max(100).default(50),
}).unknown(false).custom((value, helpers) => (
  value.from && value.to && value.from > value.to ? helpers.error('any.invalid') : value
));

function validate(schema, source) {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req[source] ?? {}, { abortEarly: false, stripUnknown: false });
    if (error) return next(validationError());
    req[source] = value;
    return next();
  };
}

// Public, read-only catalog; it contains no user-specific supplement logs.
router.get('/list', supplementController.list);
router.get('/mine', verifyToken, supplementController.listMine);
router.post('/mine', verifyToken, validate(supplementSchema, 'body'), supplementController.createMine);
router.get('/history', verifyToken, validate(historyQuerySchema, 'query'), supplementController.history);
router.patch('/mine/:id', verifyToken, validate(idSchema, 'params'), validate(updateSupplementSchema, 'body'), supplementController.updateMine);
router.delete('/mine/:id', verifyToken, validate(idSchema, 'params'), supplementController.deleteMine);

export default router;
