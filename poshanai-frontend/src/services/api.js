import client, { normalizeApiError, payloadFrom, setAccessToken } from '../api/client.js';

export const unwrapData = payloadFrom;
export { setAccessToken };

export function getApiError(error) {
  return error.apiError?.message ?? normalizeApiError(error).message;
}

export default client;
