import { Queue } from 'bullmq';
import { NOTIFICATION_SETTINGS } from '../config/constants.js';
import { redisConnection } from './queue.js';

let queue;

export function getNotificationQueue() {
  if (!queue) {
    queue = new Queue(NOTIFICATION_SETTINGS.queueName, {
      connection: redisConnection(1),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }
  return queue;
}

export async function scheduleNotificationJobs() {
  const notificationQueue = getNotificationQueue();
  const recurringJobs = [
    {
      name: 'water-reminder-sweep',
      jobId: 'water-reminder-sweep',
      pattern: NOTIFICATION_SETTINGS.waterReminderSchedule,
    },
    {
      name: 'meal-log-reminder-sweep',
      jobId: 'meal-log-reminder-sweep',
      pattern: NOTIFICATION_SETTINGS.mealReminderSchedule,
    },
    {
      name: 'retest-reminder-sweep',
      jobId: 'retest-reminder-sweep',
      pattern: NOTIFICATION_SETTINGS.retestReminderSchedule,
    },
  ];

  return Promise.all(recurringJobs.map(({ name, jobId, pattern }) => notificationQueue.add(
    name,
    {},
    { jobId, repeat: { pattern, tz: NOTIFICATION_SETTINGS.timezone } },
  )));
}

export async function closeNotificationQueue() {
  await queue?.close();
  queue = null;
}
