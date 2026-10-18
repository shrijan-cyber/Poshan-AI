import Report from '../models/Report.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

export async function sendRetestReminders({ now = new Date(), ageDays = 90 } = {}) {
  const cutoff = new Date(now.getTime() - ageDays * 24 * 60 * 60 * 1000);
  const reports = await Report.find({
    ocrStatus: 'completed',
    uploadedAt: { $lte: cutoff },
    retestReminderSentAt: null,
  })
    .select('_id userId uploadedAt')
    .lean();

  let created = 0;
  for (const report of reports) {
    const user = await User.findOne({ _id: report.userId, status: 'active' }).select('_id').lean();
    if (!user) continue;

    const dedupeKey = `retest:${report._id}`;
    let wasCreated = false;
    try {
      const notification = await Notification.updateOne(
        { dedupeKey },
        {
          $setOnInsert: {
            userId: report.userId,
            title: 'Retest reminder',
            message:
              'Your report is over 90 days old. Consider discussing whether a retest is appropriate with your doctor.',
            type: 'retest_reminder',
            isRead: false,
            createdAt: now,
            dedupeKey,
          },
        },
        { upsert: true },
      );
      wasCreated = Boolean(notification.upsertedCount);
    } catch (error) {
      // Another worker may win the unique-key upsert race for this report.
      if (error?.code !== 11000) throw error;
    }
    if (wasCreated) created += 1;
    await Report.updateOne(
      { _id: report._id, retestReminderSentAt: null },
      { $set: { retestReminderSentAt: now } },
    );
  }
  return { scanned: reports.length, created };
}

export default { sendRetestReminders };
