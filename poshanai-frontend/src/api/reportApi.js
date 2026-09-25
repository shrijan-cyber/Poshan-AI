import client, { payloadFrom } from './client.js';

export async function getReports() {
  const data = payloadFrom(await client.get('/reports'));
  return Array.isArray(data) ? data : (data?.reports ?? []);
}

export async function uploadReport(fileOrFormData) {
  let body = fileOrFormData;
  if (!(typeof FormData !== 'undefined' && fileOrFormData instanceof FormData)) {
    body = new FormData();
    body.append('file', fileOrFormData);
  }
  return payloadFrom(await client.post('/reports', body));
}

export async function deleteReport(id) {
  await client.delete(`/reports/${encodeURIComponent(id)}`);
  return id;
}

const reportApi = { getReports, uploadReport, deleteReport };
export default reportApi;
