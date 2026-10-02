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
    const ext = {
      'application/pdf': '.pdf',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    }[file.mimetype];
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
  let uploadedPath;
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
    uploadedPath = req.file.path;

    const header = await fs.promises.open(req.file.path, 'r');
    let signature;
    try {
      signature = Buffer.alloc(12);
      await header.read(signature, 0, signature.length, 0);
    } finally {
      await header.close();
    }
    const isValidSignature = req.file.mimetype === 'application/pdf'
      ? signature.subarray(0, 5).toString() === '%PDF-'
      : req.file.mimetype === 'image/jpeg'
        ? signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff
        : req.file.mimetype === 'image/png'
          ? signature.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : signature.subarray(0, 4).toString() === 'RIFF' && signature.subarray(8, 12).toString() === 'WEBP';
    if (!isValidSignature) {
      await fs.promises.unlink(req.file.path);
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_FILE_CONTENT', message: 'The uploaded file content does not match its file type.' },
      });
    }

    const fileType = req.file.mimetype === 'application/pdf' ? 'pdf' : 'image';
    const report = new Report({
      userId: req.user.id,
      fileUrl: '',
      storageKey: req.file.filename,
      fileType,
      ocrStatus: 'pending',
      uploadedAt: new Date(),
    });
    report.fileUrl = `/api/reports/${report.id}/file`;
    await report.save();

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
    if (uploadedPath) {
      try {
        await fs.promises.unlink(uploadedPath);
      } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') logger.warn('Failed to clean up an incomplete report upload.');
      }
    }
    next(error);
  }
}

export async function downloadReportFile(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid report ID format.' } });
    }
    const report = await Report.findById(req.params.id).select('+storageKey');
    if (!report) {
      return res.status(404).json({ success: false, error: { code: 'REPORT_NOT_FOUND', message: 'Report not found.' } });
    }
    if (report.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to this report.' } });
    }
    const fileName = path.basename(report.storageKey);
    const filePath = path.join(UPLOAD_DIR, fileName);
    return res.download(filePath, fileName, (error) => {
      if (error && !res.headersSent) next(error);
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

    const report = await Report.findById(req.params.id).select('+storageKey');
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
    if (report.storageKey) {
      const fileName = path.basename(report.storageKey);
      const filePath = path.join(UPLOAD_DIR, fileName);
      if (fs.existsSync(filePath)) {
        try {
          await fs.promises.unlink(filePath);
        } catch (fileErr) {
          logger.warn('Failed to delete report file on disk', { error: fileErr.message });
        }
      }
    }

    await report.deleteOne();

    logger.info('Report deleted', { reportId: req.params.id, userId: req.user.id });

    return res.json({
      success: true,
      message: 'Report deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
}
