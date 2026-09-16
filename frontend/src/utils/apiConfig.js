const DEFAULT_DEV_API_BASE = 'http://localhost:8080';
const PRODUCTION_API_BASE = 'https://younovate-lms.onrender.com';

const isBrowserLocalhost = () => {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
};

export const API_BASE_URL = (
  process.env.REACT_APP_API_BASE_URL ||
  (isBrowserLocalhost()
    ? DEFAULT_DEV_API_BASE
    : (process.env.NODE_ENV === 'production' ? PRODUCTION_API_BASE : DEFAULT_DEV_API_BASE))
).replace(/\/+$/, '');