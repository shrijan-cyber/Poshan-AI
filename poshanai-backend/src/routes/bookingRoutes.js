import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import * as bookingController from '../controllers/bookingController.js';

const router = Router();

router.get('/', verifyToken, bookingController.listUserBookings);

export default router;
