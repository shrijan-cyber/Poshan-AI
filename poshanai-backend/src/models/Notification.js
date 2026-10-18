import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true, maxlength: 120 },
    message: { type: String, required: true, maxlength: 500 },
    type: { type: String, required: true, enum: ['retest_reminder'] },
    isRead: { type: Boolean, default: false, required: true },
    // Internal idempotency key; never returned by the notifications API.
    dedupeKey: { type: String, unique: true, sparse: true, select: false },
    createdAt: { type: Date, default: Date.now, required: true },
  },
  { versionKey: false },
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

const Notification =
  mongoose.models.Notification ?? mongoose.model('Notification', notificationSchema);
export default Notification;
