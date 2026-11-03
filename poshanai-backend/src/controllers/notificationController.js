import Notification from '../models/Notification.js';
import asyncHandler from '../utils/asyncHandler.js';
import httpError from '../utils/httpError.js';

export const listNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ userId: req.user._id })
    .select('_id type title message isRead readAt createdAt')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return res.json({
    success: true,
    data: {
      notifications: notifications.map((notification) => ({
        ...notification,
        isRead: notification.isRead ?? Boolean(notification.readAt),
      })),
    },
  });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true, runValidators: true },
  ).select('_id type title message isRead readAt createdAt');

  if (!notification) throw httpError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
  return res.json({ success: true, data: { notification } });
});

export default { listNotifications, markNotificationRead };
