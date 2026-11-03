import Notification from '../models/Notification.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

export const RETEST_REMINDER_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function runRetestReminderSweep({ now = new Date() } = {}) {
  const cutoff = new Date(now.getTime() - RETEST_REMINDER_DAYS * DAY_MS);
  const reports = await Report.find({
    ocrStatus: 'completed',
    uploadedAt: { $lte: cutoff },
    retestReminderSentAt: null,
  })
    .select('_id userId')
    .lean();

  let remindersCreated = 0;
  for (const report of reports) {
    const user = await User.findOne({ _id: report.userId, status: 'active' }).select('email').lean();
    if (!user?.email) continue;

    await Notification.findOneAndUpdate(
      { userId: report.userId, dedupeKey: `retest:${report._id}` },
      {
        $setOnInsert: {
          type: 'retest_reminder',
          reportId: report._id,
          dedupeKey: `retest:${report._id}`,
          title: 'Retest reminder',
          message: 'This report is over 90 days old. Consider discussing whether follow-up testing is appropriate with your doctor.',
          isRead: false,
          readAt: null,
        },
      },
      { upsert: true, new: true, runValidators: true },
    );
    const updated = await Report.updateOne(
      { _id: report._id, userId: report.userId, retestReminderSentAt: null },
      { $set: { retestReminderSentAt: now } },
    );
    if (updated.modifiedCount > 0) remindersCreated++;
  }

  if (remindersCreated > 0) logger.info(`Created ${remindersCreated} report retest reminder notification(s).`);
  return { remindersCreated };
}
