import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: '32kb' }));
app.use(mongoSanitize());
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'poshanai-api' }));
app.get('/ready', (_req, res) => res.json({ status: 'ready' }));
app.get('/api/v1', (_req, res) => res.json({ name: 'PoshanAI API', version: 'v1' }));

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(err.status ?? 500).json({ error: err.status ? err.message : 'Internal server error' });
});

export default app;
