import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import {
  uploadReportMiddleware,
  uploadReport,
  downloadReportFile,
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
        const isTooLarge = err.code === 'LIMIT_FILE_SIZE';
        return res.status(400).json({
          success: false,
          error: {
            code: isTooLarge ? 'FILE_TOO_LARGE' : 'FILE_UPLOAD_ERROR',
            message: isTooLarge ? 'Report files must be 10 MB or smaller.' : 'The report file could not be uploaded.',
          },
        });
      }
      next();
    });
  },
  uploadReport,
);

router.get('/', listReports);
router.get('/:id/file', downloadReportFile);
router.get('/:id', getReportById);
router.delete('/:id', deleteReport);

export default router;
