// Trainer dashboard helper: authenticated blob download for LMS PDFs.
// Reuses the existing /api/assignments/:id/download + /submission routes.
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';

const lmsDashAuthH = () => {
  const t = localStorage.getItem('token') || '';
  return t ? { Authorization: `Bearer ${t}` } : {};
};

export const downloadLmsDashboardBlob = async (url, name) => {
  const r = await axios.get(`${API_BASE_URL}${url}`, { headers: lmsDashAuthH(), responseType: 'blob' });
  const u = URL.createObjectURL(new Blob([r.data]));
  const a = document.createElement('a');
  a.href = u;
  a.download = name || 'file';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(u);
};
