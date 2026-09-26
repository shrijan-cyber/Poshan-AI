import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import multer from 'multer';
import Report from '../models/Report.js';
import logger from '../utils/logger.js';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'reports');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

function fileFilter(_req, file, cb) {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Invalid file type. Only PDF and image files (JPEG, PNG, WebP) are allowed.',
      ),
      false,
    );
  }
}

export const uploadReportMiddleware = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter,
}).single('file');

export async function uploadReport(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FILE_REQUIRED',
          message: 'Report file (PDF or image) is required in the "file" field.',
        },
      });
    }

    const fileType = req.file.mimetype === 'application/pdf' ? 'pdf' : 'image';
    const fileUrl = `/uploads/reports/${req.file.filename}`;

    const report = await Report.create({
      userId: req.user.id,
      fileUrl,
      fileType,
      ocrStatus: 'pending',
      uploadedAt: new Date(),
    });

    logger.info('Report uploaded successfully', {
      reportId: report.id,
      userId: req.user.id,
      fileType,
    });

    return res.status(201).json({
      success: true,
      data: { report },
      message: 'Report uploaded successfully.',
    });
  } catch (error) {
    next(error);
  }
}

export async function listReports(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = req.user.role === 'admin' && req.query.all === 'true'
      ? {}
      : { userId: req.user.id };

    const [reports, total] = await Promise.all([
      Report.find(filter).sort({ uploadedAt: -1 }).skip(skip).limit(limit),
      Report.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: {
        reports,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getReportById(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid report ID format.' },
      });
    }

    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: { code: 'REPORT_NOT_FOUND', message: 'Report not found.' },
      });
    }

    // BOLA check
    if (report.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied to this report.' },
      });
    }

    return res.json({
      success: true,
      data: { report },
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteReport(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid report ID format.' },
      });
    }

    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: { code: 'REPORT_NOT_FOUND', message: 'Report not found.' },
      });
    }

    // BOLA check
    if (report.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied to this report.' },
      });
    }

    // Try deleting physical file
    if (report.fileUrl) {
      const fileName = path.basename(report.fileUrl);
      const filePath = path.join(UPLOAD_DIR, fileName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (fileErr) {
          logger.warn('Failed to delete report file on disk', { error: fileErr.message });
        }
      }
    }

    await Report.findByIdAndDelete(req.params.id);

    logger.info('Report deleted', { reportId: req.params.id, userId: req.user.id });

    return res.json({
      success: true,
      message: 'Report deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
}
