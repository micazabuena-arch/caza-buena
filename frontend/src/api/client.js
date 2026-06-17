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
  if (data?.errors?.length) {
    const e = data.errors[0];
    return formatValidatorError(e.param || e.path, e.msg);
  }
  return err.message || 'Something went wrong';
}

function formatValidatorError(field, msg) {
  const friendly = {
    guest_email: 'Please enter a valid email address.',
    guest_phone: 'Please enter a valid phone number.',
    guest_name: 'Guest name is required.',
    room_id: 'Please select a room.',
    check_in: 'Check-in date is required (YYYY-MM-DD).',
    check_out: 'Check-out date is required (YYYY-MM-DD).',
    valid_id: 'Valid ID is required.',
    payment_method_id: 'Please select a payment method.',
    custom_payment_amount: 'Please enter a valid custom payment amount.',
  };
  if (field && friendly[field]) return friendly[field];
  if (msg && msg !== 'Invalid value') return msg;
  if (field) return `Please check the ${String(field).replace(/_/g, ' ')} field.`;
  return 'Please check your input and try again.';
}

export default api;
