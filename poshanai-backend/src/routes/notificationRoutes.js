import { Router } from 'express';
import { listUnread } from '../controllers/notificationController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = Router();
router.get('/', verifyToken, listUnread);
export default router;
