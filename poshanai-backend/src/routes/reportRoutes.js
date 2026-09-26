import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import {
  uploadReportMiddleware,
  uploadReport,
  listReports,
  getReportById,
  deleteReport,
} from '../controllers/reportController.js';

const router = Router();

router.use(verifyToken);

router.post(
  '/upload',
  (req, res, next) => {
    uploadReportMiddleware(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'FILE_UPLOAD_ERROR',
            message: err.message || 'File upload failed.',
          },
        });
      }
      next();
    });
  },
  uploadReport,
);

router.get('/', listReports);
router.get('/:id', getReportById);
router.delete('/:id', deleteReport);

export default router;
