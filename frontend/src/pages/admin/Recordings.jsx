// Admin Recorded Videos — lists all recordings from MongoDB
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';
import AppIcon from '../../components/shared/AppIcon';

const API = API_BASE_URL;

const S = {
  page:  { padding: '20px 28px', fontFamily: 'Public Sans, system-ui, sans-serif', background: '#F1F5F9', minHeight: '100vh' },
  card:  { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 1px 3px rgba(15,23,42,.05),0 4px 16px rgba(30,58,95,.06)' },
  input: { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, fontFamily: 'inherit', color: '#0F172A', background: '#fff', outline: 'none' },
  th:    { padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#94A3B8', background: '#F8FAFC', textAlign: 'left', whiteSpace: 'nowrap' },
  td:    { padding: '11px 14px', fontSize: 13, color: '#334155', borderBottom: '1px solid #F1F5F9' },
  btnGhost:{ background: '#fff', color: '#475569', border: '1px solid #E2E8F0', padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
};

function StatusBadge({ status }) {
  const map = {
    none:       ['#F1F5F9', '#475569'],
    starting:   ['#FEF3C7', '#92400E'],
    active:     ['#FEE2E2', '#991B1B'],
    recording:  ['#FEE2E2', '#991B1B'],
    processing: ['#DBEAFE', '#1E40AF'],
    completed:  ['#D1FAE5', '#065F46'],
    available:  ['#D1FAE5', '#065F46'],
    failed:     ['#FEE2E2', '#991B1B'],
    aborted:    ['#FEF3C7', '#92400E'],
  };
  const display = status === 'active' ? 'recording' : status === 'completed' ? 'available' : status;
  const [bg, fg] = map[display] || map.none;
  return (
    <span style={{ background: bg, color: fg, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>
      {display || 'none'}
    </span>
  );
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function AdminRecordings() {
  const token = useSelector(s => s.auth?.token || '');
  const navigate = useNavigate();
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState('');

  const loadData = () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    setLoading(true);
    setError('');
    axios.get(`${API}/api/admin/workshops/recordings?limit=200`, { headers })
      .then(res => setRecordings(res.data?.recordings || []))
      .catch(e => setError('Failed to load recordings: ' + (e.response?.data?.message || e.message)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recordings.filter(r => {
      const session = r.sessionId?.title || '';
      const trainer = r.trainerId?.name || '';
      return (
        (!q || session.toLowerCase().includes(q) || trainer.toLowerCase().includes(q)) &&
        (!fStatus || r.status === fStatus)
      );
    });
  }, [recordings, search, fStatus]);

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>Recorded Videos</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>
            {recordings.length} recording{recordings.length !== 1 ? 's' : ''} from MongoDB.
          </p>
        </div>
        <button style={S.btnGhost} onClick={loadData}>
          <i className="ti ti-refresh" style={{ fontSize: 13 }} /> Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#B91C1C' }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div style={{ position: 'relative' }}>
          <AppIcon name="search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input style={{ ...S.input, paddingLeft: 32 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search session or trainer…" />
        </div>
        <select style={S.input} value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">Status: All</option>
          {['none','starting','recording','processing','available','failed','aborted'].map(st => <option key={st} value={st}>{st}</option>)}
        </select>
      </div>

      <div style={{ ...S.card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>{['Session','Type','Trainer','Date','Duration','Status','Recording'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', padding: 40, color: '#94A3B8' }}>Loading recordings…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', padding: 40, color: '#94A3B8' }}>
                  {recordings.length === 0 ? 'No recordings found.' : 'No recordings match your filters.'}
                </td></tr>
              ) : filtered.map((r, i) => (
                <tr key={r._id || i} style={{ background: i % 2 ? '#FAFAFA' : '#fff' }}>
                  <td style={S.td}><span style={{ fontWeight: 700, color: '#0F172A' }}>{r.sessionId?.title || '—'}</span></td>
                  <td style={S.td}>{r.sessionId?.sessionType || '—'}</td>
                  <td style={S.td}>{r.trainerId?.name || '—'}</td>
                  <td style={S.td}>{fmtDate(r.startedAt)}</td>
                  <td style={S.td}>{fmtDuration(r.durationSeconds)}</td>
                  <td style={S.td}><StatusBadge status={r.status} /></td>
                  <td style={S.td}>
                    {r.playable ? (
                      <button onClick={() => navigate(`/admin/recordings/${r._id}`)} style={{ background: 'none', border: 'none', color: '#2f6f9b', fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>▶ Watch</button>
                    ) : r.url ? (
                      <span style={{ fontSize: 13, color: '#94A3B8', cursor: 'not-allowed' }} title="Recording file unavailable">▶ Unavailable</span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
