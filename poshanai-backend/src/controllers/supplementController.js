import asyncHandler from '../utils/asyncHandler.js';
import { getSupplementList } from '../services/supplementCatalogService.js';
import httpError from '../utils/httpError.js';
import {
  createUserSupplement,
  deleteLoggedSupplement,
  duplicateLoggedSupplement,
  deleteUserSupplement,
  listSupplementHistory,
  logUserSupplement,
  listUserSupplements,
  updateUserSupplement,
  updateLoggedSupplement,
} from '../services/userSupplementService.js';

export const list = asyncHandler(async (_req, res) => res.json({
  success: true,
  data: {
    supplements: getSupplementList(),
    dosageNote: 'Default dosages are editable catalog examples, not personalized recommendations. Follow the product label and qualified professional guidance.',
  },
}));

export const listMine = asyncHandler(async (req, res) => res.json({
  success: true,
  data: { supplements: await listUserSupplements(req.user.id) },
}));

export const createMine = asyncHandler(async (req, res) => {
  const supplement = await createUserSupplement(req.user.id, req.body);
  return res.status(201).json({ success: true, data: { supplement } });
});

export const updateMine = asyncHandler(async (req, res) => {
  const supplement = await updateUserSupplement(req.user.id, req.params.id, req.body);
  if (!supplement) throw httpError(404, 'SUPPLEMENT_NOT_FOUND', 'Saved supplement was not found.');
  return res.json({ success: true, data: { supplement } });
});

export const deleteMine = asyncHandler(async (req, res) => {
  const deleted = await deleteUserSupplement(req.user.id, req.params.id);
  if (!deleted) throw httpError(404, 'SUPPLEMENT_NOT_FOUND', 'Saved supplement was not found.');
  return res.json({ success: true, data: { deleted: true, id: req.params.id } });
});

export const history = asyncHandler(async (req, res) => res.json({
  success: true,
  data: { entries: await listSupplementHistory(req.user.id, req.query) },
}));

export const logMine = asyncHandler(async (req, res) => {
  const entry = await logUserSupplement(req.user.id, req.params.id, req.body.servingsConsumed);
  return res.status(201).json({ success: true, data: { entry } });
});

export const updateLog = asyncHandler(async (req, res) => {
  const entry = await updateLoggedSupplement(req.user.id, req.params.logId, req.body.servingsConsumed);
  if (!entry) throw httpError(404, 'SUPPLEMENT_LOG_NOT_FOUND', 'Supplement log entry was not found.');
  return res.json({ success: true, data: { entry } });
});

export const deleteLog = asyncHandler(async (req, res) => {
  const entry = await deleteLoggedSupplement(req.user.id, req.params.logId);
  if (!entry) throw httpError(404, 'SUPPLEMENT_LOG_NOT_FOUND', 'Supplement log entry was not found.');
  return res.json({ success: true, data: { deleted: true, id: req.params.logId } });
});

export const duplicateLog = asyncHandler(async (req, res) => {
  const entry = await duplicateLoggedSupplement(req.user.id, req.params.logId);
  if (!entry) throw httpError(404, 'SUPPLEMENT_LOG_NOT_FOUND', 'Supplement log entry was not found.');
  return res.status(201).json({ success: true, data: { entry } });
});

export default { list, listMine, createMine, updateMine, deleteMine, history, logMine, updateLog, deleteLog, duplicateLog };
