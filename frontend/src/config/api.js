const DEFAULT_DEV_API_BASE = 'http://localhost:8080';
const PRODUCTION_API_BASE = 'https://younovate-lms.onrender.com';

export const API_BASE_URL = (
  process.env.REACT_APP_API_BASE_URL ||
  (process.env.NODE_ENV === 'production' ? PRODUCTION_API_BASE : DEFAULT_DEV_API_BASE)
).replace(/\/+$/, '');
