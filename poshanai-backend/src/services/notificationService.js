import DailyLog from '../models/DailyLog.js';
import FoodLog from '../models/FoodLog.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

const TIMEZONE = 'Asia/Kolkata';
const mealReminderByHour = new Map([[10, 'breakfast'], [14, 'lunch'], [21, 'dinner']]);
const foodLogHourWindows = {
  breakfast: [4, 10],
  lunch: [10, 14],
  dinner: [14, 21],
};

export function getLocalDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
}

function getLocalDateKey(parts) {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function createNotificationOnce({ userId, type, dedupeKey, title, message }) {
  return Notification.updateOne(
    { userId, dedupeKey },
    { $setOnInsert: { type, title, message, isRead: false, readAt: null } },
    { upsert: true, runValidators: true },
  ).then((result) => result.upsertedCount === 1).catch((error) => {
    if (error?.code === 11000) return false;
    throw error;
  });
}

export async function runWaterReminderSweep({ now = new Date() } = {}) {
  const parts = getLocalDateParts(now);
  const hour = Number(parts.hour);
  if (hour < 9 || hour > 21 || (hour - 9) % 2 !== 0) return { notificationsCreated: 0 };

  const users = await User.find({ status: 'active' }).select('_id').lean();
  const date = getLocalDateKey(parts);
  let notificationsCreated = 0;
  for (const user of users) {
    const created = await createNotificationOnce({
      userId: user._id,
      type: 'water_reminder',
      dedupeKey: `water:${date}:${String(hour).padStart(2, '0')}`,
      title: 'Water reminder',
      message: 'Take a moment to drink some water.',
    });
    if (created) notificationsCreated++;
  }
  return { notificationsCreated };
}

function foodLogMatchesMealTime(log, mealType) {
  const [startHour, endHour] = foodLogHourWindows[mealType];
  const createdHour = Number(getLocalDateParts(log.createdAt).hour);
  return createdHour >= startHour && createdHour < endHour;
}

export async function runMealLogReminderSweep({ now = new Date() } = {}) {
  const parts = getLocalDateParts(now);
  const mealType = mealReminderByHour.get(Number(parts.hour));
  if (!mealType) return { notificationsCreated: 0 };

  const date = getLocalDateKey(parts);
  const users = await User.find({ status: 'active' }).select('_id').lean();
  let notificationsCreated = 0;
  for (const user of users) {
    const [dailyLog, foodLogs] = await Promise.all([
      DailyLog.findOne({ userId: user._id, date }).select('meals.mealType').lean(),
      FoodLog.find({ userId: user._id, date, createdAt: { $lte: now } }).select('createdAt').lean(),
    ]);
    const explicitlyLogged = dailyLog?.meals?.some((meal) => meal.mealType === mealType) ?? false;
    const loggedInMealWindow = foodLogs.some((log) => foodLogMatchesMealTime(log, mealType));
    if (explicitlyLogged || loggedInMealWindow) continue;

    const created = await createNotificationOnce({
      userId: user._id,
      type: 'meal_log_reminder',
      dedupeKey: `meal:${date}:${mealType}`,
      title: `${mealType[0].toUpperCase()}${mealType.slice(1)} log reminder`,
      message: `If you have eaten ${mealType}, add it to your food log when you have a moment.`,
    });
    if (created) notificationsCreated++;
  }
  return { notificationsCreated };
}

/** One-time compatibility migration for the old unique user/type/report index. */
export async function prepareNotificationIndexes() {
  const collection = Notification.collection;
  const indexes = await collection.indexes();
  const legacyUniqueIndex = indexes.find((index) => index.name === 'userId_1_type_1_reportId_1' && index.unique);
  if (legacyUniqueIndex) await collection.dropIndex(legacyUniqueIndex.name);

  await collection.updateMany(
    { isRead: { $exists: false } },
    [{ $set: { isRead: { $ne: [{ $ifNull: ['$readAt', null] }, null] } } }],
  );
  await collection.updateMany(
    { type: 'retest_reminder', reportId: { $type: 'objectId' }, dedupeKey: { $exists: false } },
    [{ $set: { dedupeKey: { $concat: ['retest:', { $toString: '$reportId' }] } } }],
  );

  await collection.createIndex(
    { userId: 1, dedupeKey: 1 },
    {
      name: 'userId_1_dedupeKey_1',
      unique: true,
      partialFilterExpression: { dedupeKey: { $type: 'string' } },
    },
  );
  return { migrated: true };
}

export default { runWaterReminderSweep, runMealLogReminderSweep, prepareNotificationIndexes };
