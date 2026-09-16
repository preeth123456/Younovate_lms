import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from 'utils/apiConfig';

const API = API_BASE_URL;

const S = {
  page:  { padding: '20px 28px', fontFamily: 'Public Sans, system-ui, sans-serif', background: '#F1F5F9', minHeight: '100vh' },
  card:  { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 1px 3px rgba(15,23,42,.05),0 4px 16px rgba(30,58,95,.06)' },
  btnGhost: { background: '#fff', color: '#475569', border: '1px solid #E2E8F0', padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
};

export default function WorkshopManagementCompleted() {
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    axios.get(`${API}/api/workshops/admin/all?limit=200&status=Completed`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setWorkshops(res.data?.data?.workshops || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ ...S.page, color: '#64748B' }}>Loading completed workshops…</div>;

  return (
    <div style={S.page}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>Completed Workshops</h2>
      <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>{workshops.length} completed workshops found.</p>
      <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
        {workshops.map(w => (
          <div key={w._id} style={{ ...S.card, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, color: '#0F172A' }}>{w.title}</div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>{w.trainerName || '—'} · {w.mode || '—'}</div>
            </div>
            <span style={{ background: '#D1FAE5', color: '#065F46', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{w.status}</span>
          </div>
        ))}
        {workshops.length === 0 && <div style={{ color: '#94A3B8', padding: 20 }}>No completed workshops found.</div>}
      </div>
    </div>
  );
}
