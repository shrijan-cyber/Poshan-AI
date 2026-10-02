import mongoose from 'mongoose';
import app from './app.js';
import { env } from './config/env.js';
import logger from './utils/logger.js';

try {
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
  logger.info(`MongoDB Connected: ${mongoose.connection.host}`);
  const server = app.listen(env.port, '0.0.0.0', () => logger.info(`PoshanAI API listening on port ${env.port}`));
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${env.port} is already in use. Stop its process or set PORT to another free port (for example, PORT=5001).`);
      process.exit(1);
    }
    logger.error(`HTTP server failed: ${error.message}`);
    process.exit(1);
  });
} catch (error) {
  logger.error(`Startup failed: ${error.message}`, { stack: error.stack });
  process.exit(1);
}
