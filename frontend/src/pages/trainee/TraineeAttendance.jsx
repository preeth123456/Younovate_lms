import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';

const API = API_BASE_URL;

const STATUS_CFG = {
  present: { label: 'Present', bg: '#dcfce7', color: '#15803d' },
  late:    { label: 'Late',    bg: '#fef3c7', color: '#b45309' },
  partial: { label: 'Partial', bg: '#dbeafe', color: '#1d4ed8' },
  absent:  { label: 'Absent',  bg: '#fee2e2', color: '#b91c1c' },
  excused: { label: 'Excused', bg: '#f1f5f9', color: '#475569' },
};

export default function TraineeAttendance() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const { data } = await axios.get(`${API}/api/trainee/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRecords(data.records || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter(r => {
      const title = (r.session?.title || '').toLowerCase();
      const st = (r.status || '').toLowerCase();
      const matchesSearch = !q || title.includes(q);
      const matchesStatus = !statusFilter || st === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [records, search, statusFilter]);

  const fmt = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '—';
    return dt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <div style={{ padding: '20px 28px', fontFamily: 'Public Sans, system-ui, sans-serif', background: '#F1F5F9', minHeight: '100vh' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>My Attendance</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>Your LMS session attendance history.</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, flex: '1 1 240px' }}
          placeholder="Search sessions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, background: '#fff' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {Object.keys(STATUS_CFG).map(k => <option key={k} value={k}>{STATUS_CFG[k].label}</option>)}
        </select>
        <button onClick={fetchRecords} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          Refresh
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 1px 3px rgba(15,23,42,.05),0 4px 16px rgba(30,58,95,.06)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Loading attendance…</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>No attendance records found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Session', 'Join Time', 'Leave Time', 'Duration', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#94A3B8', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const cfg = STATUS_CFG[r.status] || STATUS_CFG.absent;
                  const dur = r.attendedSeconds ? `${Math.round(r.attendedSeconds / 60)}m` : '—';
                  return (
                    <tr key={r._id || i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: '#334155', fontWeight: 600 }}>{r.session?.title || '—'}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: '#334155', whiteSpace: 'nowrap' }}>{fmt(r.joinedAt)}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: '#334155', whiteSpace: 'nowrap' }}>{fmt(r.leftAt)}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: '#334155' }}>{dur}</td>
                      <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '3px 10px', borderRadius: 999, textTransform: 'capitalize' }}>
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
