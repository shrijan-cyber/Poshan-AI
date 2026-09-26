import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import {
  listDeficiencyLogs,
  getDeficiencyTrends,
} from '../controllers/deficiencyLogController.js';

const router = Router();

router.use(verifyToken);

router.get('/', listDeficiencyLogs);
router.get('/trends', getDeficiencyTrends);

export default router;
