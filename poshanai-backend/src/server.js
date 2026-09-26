import mongoose from 'mongoose';
import app from './app.js';
import { env } from './config/env.js';
import logger from './utils/logger.js';

try {
  if (env.isAtlasPlaceholder) {
    logger.warn(
      'MONGODB_URI in .env contains a credentials placeholder (<password>). Using local MongoDB (mongodb://127.0.0.1:27017/poshanai) for development.',
    );
  }
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
  logger.info('Connected to MongoDB');
  const port = process.env.PORT || 5000;
  app.listen(port, '0.0.0.0', () => logger.info(`PoshanAI API listening on port ${port}`));
} catch (error) {
  logger.error(`Startup failed: ${error.message}`, { stack: error.stack });
  process.exit(1);
}
