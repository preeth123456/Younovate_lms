import axios from 'axios';
import { store } from '../app/store';
import { setToken } from '../features/auth/authSlice';
import { API_BASE_URL } from '../config/api';

const API = API_BASE_URL;

// Required so httpOnly refreshToken cookie is sent/stored on Vercel → Render
axios.defaults.withCredentials = true;

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Login failures are credential errors, not expired sessions — never
    // attempt a silent refresh for them; reject immediately so the login
    // thunk's rejected case runs (loading stops, error shows).
    if (originalRequest?._skipRefreshRetry) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axios(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const resp = await axios.post(
          `${API}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newToken = resp.data.accessToken;
        store.dispatch(setToken(newToken));
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        return axios(originalRequest);
      } catch (err) {
        processQueue(err, null);
        store.dispatch(setToken(null));
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axios;
