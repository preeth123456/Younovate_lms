const DEFAULT_DEV_API_BASE = 'http://localhost:8080';

export const API_BASE_URL = (
  process.env.REACT_APP_API_BASE_URL || DEFAULT_DEV_API_BASE
).replace(/\/+$/, '');
