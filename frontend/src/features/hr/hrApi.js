// src/features/hr/hrApi.js — shared HR API helper (additive, reuses existing auth pattern)
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';
const API = API_BASE_URL;
const hdr = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token') || ''}` } });
export const hrGet = (path, params) => axios.get(`${API}/api/hr${path}`, { ...hdr(), params }).then((r) => r.data);
export const hrPost = (path, body) => axios.post(`${API}/api/hr${path}`, body, hdr()).then((r) => r.data);
export const hrPut = (path, body) => axios.put(`${API}/api/hr${path}`, body, hdr()).then((r) => r.data);
export const hrPatch = (path, body) => axios.patch(`${API}/api/hr${path}`, body, hdr()).then((r) => r.data);
export const hrDel = (path) => axios.delete(`${API}/api/hr${path}`, hdr()).then((r) => r.data);
export const fmtDT = (v) => { try { const d = new Date(v); if (Number.isNaN(d.getTime())) return '—'; return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return '—'; } };
export const fmtD = (v) => { try { const d = new Date(v); if (Number.isNaN(d.getTime())) return '—'; return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return '—'; } };
export const hrExport = async (kind, params) => {
  const t = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  const qs = new URLSearchParams({ kind, ...(params || {}) }).toString();
  const res = await fetch(`${API}/api/hr/reports/export?${qs}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `hr-${kind}.csv`; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
};
