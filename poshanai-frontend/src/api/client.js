import axios from 'axios';

const configuredBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const normalizedBaseUrl = configuredBaseUrl.replace(/\/$/, '');

export const apiClient = axios.create({
  baseURL: normalizedBaseUrl,
  timeout: 15000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

const refreshClient = axios.create({ baseURL: normalizedBaseUrl, timeout: 15000, withCredentials: true });
let getAccessToken = () => null;
let updateAccessToken = () => {};
let onAuthenticationFailure = () => {};
let refreshPromise = null;

export const setAuthTokenHandlers = ({ getToken, setToken, onUnauthorized } = {}) => {
  getAccessToken = getToken || (() => null);
  updateAccessToken = setToken || (() => {});
  onAuthenticationFailure = onUnauthorized || (() => {});
};

const isAuthEndpoint = (url = '') => /\/auth\/(login|register|refresh|logout)(\?|$)/.test(url);

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config;
    if (error.response?.status !== 401 || !request || request._retry || isAuthEndpoint(request.url)) {
      return Promise.reject(error);
    }

    request._retry = true;
    try {
      if (!refreshPromise) {
        refreshPromise = (async () => {
          try {
            const { data } = await refreshClient.post('/auth/refresh', {});
            if (!data?.success || !data?.data?.accessToken) throw new Error('Session refresh failed.');
            updateAccessToken(data.data.accessToken);
            return data.data.accessToken;
          } finally {
            refreshPromise = null;
          }
        })();
      }
      const accessToken = await refreshPromise;
      request.headers = request.headers || {};
      request.headers.Authorization = `Bearer ${accessToken}`;
      return await apiClient(request);
    } catch (refreshError) {
      updateAccessToken(null);
      onAuthenticationFailure();
      return Promise.reject(refreshError);
    }
  },
);

export default apiClient;
