import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import validateRequest from '../middleware/validateRequest.js';
import {
  generateMealPlan,
  generateMealPlanSchema,
  listMealPlans,
  getMealPlanById,
  updateMealPlanStatus,
  updateMealPlanStatusSchema,
} from '../controllers/mealPlanController.js';

const router = Router();

router.use(verifyToken);

router.post(
  '/generate',
  validateRequest(generateMealPlanSchema),
  generateMealPlan,
);

router.get('/', listMealPlans);
router.get('/:id', getMealPlanById);

router.patch(
  '/:id/status',
  validateRequest(updateMealPlanStatusSchema),
  updateMealPlanStatus,
);

export default router;
