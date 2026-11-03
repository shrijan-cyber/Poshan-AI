import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import * as notificationController from '../controllers/notificationController.js';
import Joi from 'joi';
import validationError from '../utils/validationError.js';

const router = Router();
const idSchema = Joi.object({ id: Joi.string().hex().length(24).required() }).unknown(false);

function validateId(req, _res, next) {
  const { error, value } = idSchema.validate(req.params, { abortEarly: false, stripUnknown: true });
  if (error) return next(validationError());
  req.params = value;
  return next();
}

router.get('/', verifyToken, notificationController.listNotifications);
router.patch('/:id/read', verifyToken, validateId, notificationController.markNotificationRead);

export default router;
