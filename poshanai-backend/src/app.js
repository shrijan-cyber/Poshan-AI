import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import mealPlanRoutes from './routes/mealPlanRoutes.js';
import deficiencyLogRoutes from './routes/deficiencyLogRoutes.js';
import path from 'node:path';
import logger from './utils/logger.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/mealplans', mealPlanRoutes);
app.use('/api/meal-plans', mealPlanRoutes);
app.use('/api/deficiency-logs', deficiencyLogRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'poshanai-api' }));
app.get('/ready', (_req, res) => res.json({ status: 'ready' }));
app.get('/api/v1', (_req, res) => res.json({ name: 'PoshanAI API', version: 'v1' }));

app.use((_req, res) => res.status(404).json({
  success: false,
  error: { code: 'NOT_FOUND', message: 'Not found.' },
}));
app.use((err, _req, res, _next) => {
  logger.error(err.message, { stack: err.stack });
  res.status(err.status ?? 500).json({
    success: false,
    error: {
      code: err.code ?? (err.status ? 'REQUEST_ERROR' : 'INTERNAL_SERVER_ERROR'),
      message: err.status ? err.message : 'Internal server error.',
    },
  });
});

export default app;
