// src/components/hr/hrUi.jsx — shared HR primitives (additive, reuses YouVA card/table language)
import React from 'react';
export const BRAND = '#3f7da0';
export const page = { padding: 24, fontFamily: 'Public Sans, system-ui, sans-serif', background: '#F1F5F9', minHeight: '100vh' };
export const card = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 18, boxShadow: '0 1px 2px rgba(15,23,42,.05)' };
export const h2 = { margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' };
export const sub = { margin: '4px 0 0', fontSize: 13, color: '#64748B' };
export const inp = { border: '1px solid #CBD5E1', borderRadius: 9, padding: '9px 12px', fontSize: 13, background: '#fff', minWidth: 0 };
export const btnP = { background: BRAND, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 16px', fontWeight: 800, fontSize: 13, cursor: 'pointer' };
export const btnG = { background: '#fff', color: '#0F172A', border: '1px solid #CBD5E1', borderRadius: 9, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' };
export const th = { textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.4px', padding: '10px 12px', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' };
export const td = { padding: '11px 12px', fontSize: 13, color: '#0F172A', borderBottom: '1px solid #F1F5F9', verticalAlign: 'top' };
const badgeC = { placed: ['#DCFCE7', '#166534'], joined: ['#DCFCE7', '#166534'], accepted: ['#DCFCE7', '#166534'], selected: ['#DCFCE7', '#166534'], released: ['#DBEAFE', '#1E40AF'], open: ['#DBEAFE', '#1E40AF'], confirmed: ['#DBEAFE', '#1E40AF'], completed: ['#E0E7FF', '#3730A3'], scheduled: ['#FEF3C7', '#92400E'], pending: ['#FEF3C7', '#92400E'], draft: ['#F1F5F9', '#475569'], cancelled: ['#FEE2E2', '#991B1B'], rejected: ['#FEE2E2', '#991B1B'], declined: ['#FEE2E2', '#991B1B'], expired: ['#F1F5F9', '#64748B'], rescheduled: ['#FFEDD5', '#9A3412'], on_hold: ['#FFEDD5', '#9A3412'], inactive: ['#F1F5F9', '#64748B'], closed: ['#F1F5F9', '#64748B'] };
export function Badge({ v }) {
  const k = String(v || '').toLowerCase();
  const c = badgeC[k] || ['#F1F5F9', '#475569'];
  return <span style={{ background: c[0], color: c[1], fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 99, whiteSpace: 'nowrap' }}>{String(v || '—').replace(/_/g, ' ')}</span>;
}
export function Kpi({ label, value, onClick }) {
  return <button type="button" onClick={onClick} style={{ ...card, textAlign: 'left', cursor: onClick ? 'pointer' : 'default', minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>{label}</div><div style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>{value ?? 0}</div></button>;
}
export function Empty({ text }) {
  return <div style={{ ...card, textAlign: 'center', color: '#64748B', padding: 32 }}>{text || 'No records found.'}</div>;
}
export function Loading({ text }) {
  return <div style={{ ...card, textAlign: 'center', color: '#64748B', padding: 32 }}>{text || 'Loading…'}</div>;
}
export function Err({ text, onRetry }) {
  return <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '14px 16px', color: '#B91C1C', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><span>{text || 'Unable to load data.'}</span>{onRetry && <button type="button" onClick={onRetry} style={btnG}>Retry</button>}</div>;
}
export const fmtDT = (v) => { try { const d = new Date(v); if (Number.isNaN(d.getTime())) return '—'; return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return '—'; } };
export const fmtD = (v) => { try { const d = new Date(v); if (Number.isNaN(d.getTime())) return '—'; return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return '—'; } };
