import UserSupplement from '../models/UserSupplement.js';
import SupplementLog from '../models/SupplementLog.js';
import httpError from '../utils/httpError.js';
import { getTodayDateKey } from './dailyLogService.js';

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

export function buildConsumedComponents(components = [], servingsConsumed) {
  return components.map(({ nutrient, amount, unit }) => ({
    nutrient,
    labelAmountPerServing: amount,
    consumedAmount: round(amount * servingsConsumed),
    unit,
  }));
}

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

export async function logUserSupplement(userId, supplementId, servingsConsumed) {
  const product = await UserSupplement.findOne({ _id: supplementId, userId }).lean();
  if (!product) throw httpError(404, 'SUPPLEMENT_NOT_FOUND', 'Saved supplement was not found.');

  return SupplementLog.create({
    userId,
    date: getTodayDateKey(),
    supplementName: product.name,
    userSupplementId: product._id,
    servingsConsumed,
    components: buildConsumedComponents(product.components, servingsConsumed),
  });
}

export async function updateLoggedSupplement(userId, logId, servingsConsumed) {
  const entry = await SupplementLog.findOne({ _id: logId, userId, userSupplementId: { $ne: null } });
  if (!entry) return null;
  entry.servingsConsumed = servingsConsumed;
  entry.components = (entry.components ?? []).map((component) => ({
    nutrient: component.nutrient,
    labelAmountPerServing: component.labelAmountPerServing,
    consumedAmount: round(component.labelAmountPerServing * servingsConsumed),
    unit: component.unit,
  }));
  await entry.save();
  return entry;
}

export function deleteLoggedSupplement(userId, logId) {
  return SupplementLog.findOneAndDelete({ _id: logId, userId, userSupplementId: { $ne: null } });
}

export async function duplicateLoggedSupplement(userId, logId) {
  const original = await SupplementLog.findOne({ _id: logId, userId, userSupplementId: { $ne: null } });
  if (!original) return null;
  return SupplementLog.create({
    userId,
    date: getTodayDateKey(),
    loggedAt: new Date(),
    supplementName: original.supplementName,
    userSupplementId: original.userSupplementId,
    servingsConsumed: original.servingsConsumed,
    components: original.components,
  });
}
