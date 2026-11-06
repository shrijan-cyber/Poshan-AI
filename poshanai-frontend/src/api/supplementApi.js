import client, { payloadFrom } from './client.js';

export async function getMySupplements({ signal } = {}) {
  return payloadFrom(await client.get('/supplements/mine', { signal }));
}

export async function createUserSupplement(data) {
  return payloadFrom(await client.post('/supplements/mine', data));
}

export async function updateUserSupplement(id, data) {
  return payloadFrom(await client.patch(`/supplements/mine/${id}`, data));
}

export async function deleteUserSupplement(id) {
  return payloadFrom(await client.delete(`/supplements/mine/${id}`));
}

export async function getSupplementHistory({ from, to, limit = 50, signal } = {}) {
  return payloadFrom(await client.get('/supplements/history', {
    params: { ...(from ? { from } : {}), ...(to ? { to } : {}), limit },
    signal,
  }));
}

export async function logSavedSupplement(id, servingsConsumed) {
  return payloadFrom(await client.post(`/supplements/mine/${encodeURIComponent(id)}/log`, { servingsConsumed }));
}

export async function updateSupplementLog(id, servingsConsumed) {
  return payloadFrom(await client.patch(`/supplements/history/${encodeURIComponent(id)}`, { servingsConsumed }));
}

export async function deleteSupplementLog(id) {
  return payloadFrom(await client.delete(`/supplements/history/${encodeURIComponent(id)}`));
}

export async function duplicateSupplementLog(id) {
  return payloadFrom(await client.post(`/supplements/history/${encodeURIComponent(id)}/duplicate`));
}

export default {
  getMySupplements, createUserSupplement, updateUserSupplement, deleteUserSupplement, getSupplementHistory,
  logSavedSupplement, updateSupplementLog, deleteSupplementLog, duplicateSupplementLog,
};
