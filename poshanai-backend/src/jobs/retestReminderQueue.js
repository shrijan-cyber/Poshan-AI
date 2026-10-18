import { Queue, Worker } from 'bullmq';
import { env } from '../config/env.js';
import { redisConnection } from './queue.js';
import { sendRetestReminders } from '../services/retestReminderService.js';

export const retestReminderQueueName = 'retest-reminders';
let queue;
let worker;

function getQueue() {
  if (!queue)
    queue = new Queue(retestReminderQueueName, {
      connection: redisConnection(1),
    });
  return queue;
}

export async function startRetestReminderWorker() {
  if (!env.redisUrl)
    throw new Error('REDIS_URL must be configured to run the retest reminder worker.');
  const connection = redisConnection(null);
  worker = new Worker(retestReminderQueueName, async () => sendRetestReminders(), { connection });
  await getQueue().add(
    'daily-retest-reminder-sweep',
    {},
    {
      jobId: 'daily-retest-reminder-sweep',
      repeat: { pattern: '0 9 * * *', tz: 'UTC' },
      removeOnComplete: 10,
      removeOnFail: 50,
    },
  );
  return worker;
}

export async function closeRetestReminderWorker() {
  await worker?.close();
  worker = null;
  await queue?.close();
  queue = null;
}
