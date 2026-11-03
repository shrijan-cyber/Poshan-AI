import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['water_reminder', 'meal_log_reminder', 'retest_reminder'], required: true },
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', default: null },
    dedupeKey: { type: String, maxlength: 120 },
    title: { type: String, required: true, maxlength: 120 },
    message: { type: String, required: true, maxlength: 500 },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    emailSentAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

notificationSchema.index(
  { userId: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } },
);
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, reportId: 1 });

const Notification = mongoose.models.Notification ?? mongoose.model('Notification', notificationSchema);
export default Notification;
