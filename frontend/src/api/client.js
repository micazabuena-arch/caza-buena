import axios from 'axios';
import { getAdminToken, clearAdminToken } from '../utils/adminAuth';
import { hasIslandHoppingPrintPrefetch } from '../utils/islandHoppingPrintCache';

function isPrintIslandWithPrefetch() {
  const match = window.location.pathname.match(/\/admin\/bookings\/(\d+)\/print-island$/);
  if (!match) return false;
  return hasIslandHoppingPrintPrefetch(match[1]);
}

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Let browser set multipart boundary for file uploads
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  } else if (!config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && getAdminToken()) {
      clearAdminToken();
      const skipLoginRedirect = isPrintIslandWithPrefetch();
      if (
        !skipLoginRedirect &&
        window.location.pathname.startsWith('/admin') &&
        !window.location.pathname.includes('/login')
      ) {
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(err);
  }
);

/** Extract readable error message from API response */
export function getApiError(err) {
  const data = err.response?.data;
  if (data?.message) return data.message;
  if (data?.errors?.[0]?.msg) return data.errors[0].msg;
  return err.message || 'Something went wrong';
}

export default api;
