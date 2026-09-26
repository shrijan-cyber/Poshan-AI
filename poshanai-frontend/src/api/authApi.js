import apiClient from './client.js';

let pendingRefresh = null;

const unwrapResponse = (response) => {
  const payload = response.data;
  if (!payload?.success) {
    const error = new Error(payload?.error?.message || 'The authentication request failed.');
    error.code = payload?.error?.code;
    throw error;
  }
  return payload.data;
};

export const login = async (email, password) => unwrapResponse(await apiClient.post('/auth/login', { email, password }));

export const register = async (registrationData) => unwrapResponse(await apiClient.post('/auth/register', registrationData));

export const logout = async () => unwrapResponse(await apiClient.post('/auth/logout', {}));

export const refresh = async () => {
  if (!pendingRefresh) {
    pendingRefresh = (async () => unwrapResponse(await apiClient.post('/auth/refresh', {})))();
  }
  try {
    return await pendingRefresh;
  } finally {
    pendingRefresh = null;
  }
};

export const getCurrentUser = async () => unwrapResponse(await apiClient.get('/users/me'));
