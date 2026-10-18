import Notification from '../models/Notification.js';
import asyncHandler from '../utils/asyncHandler.js';

export const listUnread = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({
    userId: req.user._id,
    isRead: false,
  })
    .select('_id title message type isRead createdAt')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return res.json({ success: true, data: { notifications } });
});

export default { listUnread };
