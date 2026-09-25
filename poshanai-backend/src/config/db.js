import mongoose from 'mongoose';
import { env } from './env.js';
import logger from '../utils/logger.js';

mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
mongoose.connection.on('error', () => logger.error('MongoDB connection error'));

export async function connectDB() {
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
    logger.info('MongoDB connected');
    return mongoose.connection;
  } catch {
    logger.error('MongoDB connection failed');
    throw new Error('Database connection failed');
  }
}

export default connectDB;
