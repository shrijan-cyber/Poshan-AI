import { Router } from 'express';
import { getCurrentUser, updateCurrentUser, listAllUsers, changeUserRole } from '../controllers/userController.js';
import { verifyToken, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/me', verifyToken, getCurrentUser);
router.put('/me', verifyToken, updateCurrentUser);
router.get('/', verifyToken, requireRole('admin'), listAllUsers);
router.patch('/:id/role', verifyToken, requireRole('admin'), changeUserRole);

export default router;
