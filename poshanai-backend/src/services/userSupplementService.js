import UserSupplement from '../models/UserSupplement.js';
import SupplementLog from '../models/SupplementLog.js';

export function listUserSupplements(userId) {
  return UserSupplement.find({ userId }).sort({ updatedAt: -1 }).lean();
}

export function createUserSupplement(userId, data) {
  return UserSupplement.create({ ...data, userId });
}

export function updateUserSupplement(userId, id, data) {
  return UserSupplement.findOneAndUpdate({ _id: id, userId }, { $set: data }, {
    new: true, runValidators: true,
  }).lean();
}

export function deleteUserSupplement(userId, id) {
  return UserSupplement.findOneAndDelete({ _id: id, userId });
}

export function listSupplementHistory(userId, { from, to, limit = 50 }) {
  const filter = { userId };
  if (from || to) filter.date = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  return SupplementLog.find(filter).sort({ date: -1, createdAt: -1 }).limit(limit).lean();
}
