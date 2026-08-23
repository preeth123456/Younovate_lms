// Admin LMS Feedback — shows all LMS feedback from MongoDB
import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { API_BASE_URL } from '../../config/api';

const API = API_BASE_URL;

const S = {
  page:  { padding: '20px 28px', fontFamily: 'Public Sans, system-ui, sans-serif', background: '#F1F5F9', minHeight: '100vh' },
  card:  { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 1px 3px rgba(15,23,42,.05),0 4px 16px rgba(30,58,95,.06)' },
  input: { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, fontFamily: 'inherit', color: '#0F172A', background: '#fff', outline: 'none' },
  th:    { padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#94A3B8', background: '#F8FAFC', textAlign: 'left', whiteSpace: 'nowrap' },
  td:    { padding: '11px 14px', fontSize: 13, color: '#334155', borderBottom: '1px solid #F1F5F9' },
  btnGhost:{ background: '#fff', color: '#475569', border: '1px solid #E2E8F0', padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
};

function Stars({ rating, size = 14 }) {
  return (
    <div style={{ display: 'inline-flex', gap: 2 }}>
      {[1,2,3,4,5].map(s => (
        <i key={s} className={`ti ti-star${s <= rating ? '-filled' : ''}`} style={{ fontSize: size, color: '#F59E0B' }} />
      ))}
    </div>
  );
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminFeedback() {
  const token = useSelector(s => s.auth?.token || '');
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [fRating, setFRating] = useState('all');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError('');
    const headers = { Authorization: `Bearer ${token}` };
    axios.get(`${API}/api/admin/lms-feedback`, { headers })
      .then(res => setFeedback(res.data?.feedback || []))
      .catch(e => setError(e.response?.data?.message || 'Failed to load feedback'))
      .finally(() => setLoading(false));
  }, [token]);

  const stats = useMemo(() => {
    const total = feedback.length;
    const avgRating = total ? Number((feedback.reduce((a, f) => a + (f.rating || 0), 0) / total).toFixed(1)) : 0;
    const dist = [5,4,3,2,1].map(star => ({ star, count: feedback.filter(f => Math.round(f.rating || 0) === star).length }));
    return { total, avgRating, dist };
  }, [feedback]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return feedback.filter(f => {
      const session = (f.sessionId?.title || '').toLowerCase();
      const trainee = (f.studentId?.name || '').toLowerCase();
      const trainer = (f.trainerId?.name || '').toLowerCase();
      const comment = (f.comment || '').toLowerCase();
      const matchQ = !q || session.includes(q) || trainee.includes(q) || trainer.includes(q) || comment.includes(q);
      const matchR = fRating === 'all' || Math.round(f.rating || 0) === Number(fRating);
      return matchQ && matchR;
    });
  }, [feedback, search, fRating]);

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>LMS Feedback</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>Trainee feedback for LMS sessions across all trainers.</p>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#B91C1C' }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ ...S.card, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94A3B8' }}>Avg Rating</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', lineHeight: 1, marginTop: 6 }}>{stats.avgRating || '—'}</div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Out of 5.0</div>
        </div>
        <div style={{ ...S.card, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94A3B8' }}>Responses</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', lineHeight: 1, marginTop: 6 }}>{stats.total}</div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Total submitted</div>
        </div>
        <div style={{ ...S.card, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94A3B8' }}>5 Star</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', lineHeight: 1, marginTop: 6 }}>{stats.dist.find(d => d.star === 5)?.count ?? 0}</div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Top ratings</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div style={{ position: 'relative' }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 14 }} />
          <input style={{ ...S.input, paddingLeft: 32 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search session, trainee or trainer…" />
        </div>
        <select style={S.input} value={fRating} onChange={e => setFRating(e.target.value)}>
          <option value="all">All Ratings</option>
          {[5,4,3,2,1].map(r => <option key={r} value={r}>{r} Stars</option>)}
        </select>
      </div>

      <div style={{ ...S.card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
            <thead>
              <tr>{['Session','Trainer','Trainee','Rating','Feedback','Date'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', padding: 40, color: '#94A3B8' }}>Loading feedback…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', padding: 40, color: '#94A3B8' }}>
                  {feedback.length === 0 ? 'No feedback submitted yet.' : 'No feedback matches your filters.'}
                </td></tr>
              ) : filtered.map((f, i) => (
                <tr key={f._id || i} style={{ background: i % 2 ? '#FAFAFA' : '#fff' }}>
                  <td style={S.td}>
                    <div style={{ fontWeight: 700, color: '#0F172A' }}>{f.sessionId?.title || '—'}</div>
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{fmtDate(f.sessionId?.scheduledAt)}</div>
                  </td>
                  <td style={S.td}>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{f.trainerId?.name || '—'}</div>
                  </td>
                  <td style={S.td}>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{f.studentId?.name || '—'}</div>
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{f.studentId?.email}</div>
                  </td>
                  <td style={S.td}><Stars rating={f.rating || 0} /></td>
                  <td style={{ ...S.td, maxWidth: 300 }}>
                    <span style={{ color: '#374151', fontStyle: 'italic' }}>"{f.comment || '—'}"</span>
                    {f.suggestions && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>💡 {f.suggestions}</div>}
                  </td>
                  <td style={S.td}>{fmtDate(f.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
