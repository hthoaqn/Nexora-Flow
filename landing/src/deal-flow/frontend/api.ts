/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import axios from 'axios';
import { useAuthStore } from './store/useAuthStore';
import { toast } from 'sonner';

export const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Inject Auth Token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Error parsing & notifications
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle token expiration / refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = useAuthStore.getState().refreshToken;

      if (refreshToken) {
        try {
          const res = await axios.post('/api/v1/auth/refresh', { refreshToken });
          if (res.data && res.data.success) {
            const { accessToken, refreshToken: newRefresh } = res.data.data;
            const user = useAuthStore.getState().user;

            if (user) {
              useAuthStore.getState().setAuth(user, accessToken, newRefresh);
            }

            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return api(originalRequest);
          }
        } catch (refreshErr) {
          useAuthStore.getState().clearAuth();
          window.location.href = '/login';
          return Promise.reject(refreshErr);
        }
      }
    }

    // Capture response errors and display as friendly toast
    const errMsg = error.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại sau.';
    const errCode = error.response?.data?.error?.code || 'UNKNOWN_ERROR';

    // Do not toast on normal me check failures on login
    if (originalRequest.url !== '/auth/me') {
      toast.error(`${errMsg} (Mã: ${errCode})`);
    }

    return Promise.reject(error);
  }
);
