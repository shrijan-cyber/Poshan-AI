import mongoose from 'mongoose';
import app from './app.js';
import { env } from './config/env.js';

try {
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
  app.listen(env.port, '0.0.0.0', () => console.log(`PoshanAI API listening on ${env.port}`));
} catch (error) {
  console.error(`Startup failed: ${error.message}`);
  process.exit(1);
}
