import { Worker } from 'bullmq';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { NOTIFICATION_SETTINGS } from '../config/constants.js';
import logger from '../utils/logger.js';
import { runRetestReminderSweep } from '../services/retestReminderService.js';
import {
  prepareNotificationIndexes,
  runMealLogReminderSweep,
  runWaterReminderSweep,
} from '../services/notificationService.js';
import { closeNotificationQueue, getNotificationQueue, scheduleNotificationJobs } from './notificationQueue.js';
import { redisConnection } from './queue.js';

let worker;

export async function startNotificationWorker() {
  if (!env.redisUrl) throw new Error('REDIS_URL must be configured to run the notification worker.');
  if (worker) return worker;

  if (mongoose.connection.readyState !== 1) await connectDB();
  await prepareNotificationIndexes();
  await scheduleNotificationJobs();
  worker = new Worker(
    NOTIFICATION_SETTINGS.queueName,
    async (job) => {
      const processingTime = job.processedOn ? new Date(job.processedOn) : new Date();
      if (job.name === 'water-reminder-sweep') return runWaterReminderSweep({ now: processingTime });
      if (job.name === 'meal-log-reminder-sweep') return runMealLogReminderSweep({ now: processingTime });
      if (job.name === 'retest-reminder-sweep') return runRetestReminderSweep();
      throw new Error('Unknown notification job.');
    },
    { connection: redisConnection(null), concurrency: 1 },
  );

  worker.on('completed', (job) => logger.info(`The ${job.name} completed.`));
  worker.on('failed', (job) => logger.error(`The ${job?.name ?? 'notification'} job failed.`));
  worker.on('error', () => logger.error('The notification worker encountered a Redis or processing error.'));
  getNotificationQueue().on('error', () => logger.warn('The notification queue is unavailable.'));
  return worker;
}

export async function stopNotificationWorker() {
  await worker?.close();
  worker = null;
  await closeNotificationQueue();
}

export default { startNotificationWorker, stopNotificationWorker };
