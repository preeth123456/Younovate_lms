// Admin Workshop Feedback — loads real MongoDB data from WorkshopFeedback collection
import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { API_BASE_URL } from 'utils/apiConfig';

const API = API_BASE_URL;

const S = {
  page:    { padding: '20px 28px', fontFamily: 'Public Sans, system-ui, sans-serif', background: '#F1F5F9', minHeight: '100vh' },
  card:    { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 1px 3px rgba(15,23,42,.05),0 4px 16px rgba(30,58,95,.06)' },
  input:   { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, fontFamily: 'inherit', color: '#0F172A', background: '#fff', outline: 'none' },
  panelHd: { padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9' },
  th:      { padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#94A3B8', background: '#F8FAFC', textAlign: 'left', whiteSpace: 'nowrap' },
  td:      { padding: '11px 14px', fontSize: 13, color: '#334155', borderBottom: '1px solid #F1F5F9' },
  pill:    { fontSize: 11, color: '#94A3B8', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 20, padding: '3px 10px', fontWeight: 600 },
  btnGhost:{ background: '#fff', color: '#475569', border: '1px solid #E2E8F0', padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
};

function Stars({ rating, size = 14 }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(s => (
        <i key={s} className={`ti ti-star${s <= rating ? '-filled' : ''}`} style={{ fontSize: size, color: '#F59E0B' }} />
      ))}
    </div>
  );
}

function KPICard({ title, value, icon, accent, sub }) {
  return (
    <div style={{ ...S.card, padding: 18 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <i className={`ti ti-${icon}`} style={{ fontSize: 18, color: accent }} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94A3B8' }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', lineHeight: 1, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function RatingDistChart({ data }) {
  const max = Math.max(...data.map(d => d.count), 1);
  const total = data.reduce((a, d) => a + d.count, 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map(({ star, count }) => (
        <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, width: 60, flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{star}</span>
            <i className="ti ti-star-filled" style={{ fontSize: 11, color: '#F59E0B' }} />
          </div>
          <div style={{ flex: 1, height: 10, background: '#F1F5F9', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ width: `${(count / max) * 100}%`, height: '100%', background: '#F59E0B', borderRadius: 5, transition: 'width 0.4s ease' }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', width: 28, textAlign: 'right' }}>{count}</span>
          <span style={{ fontSize: 11, color: '#CBD5E1', width: 32, textAlign: 'right' }}>{Math.round((count / total) * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminWorkshopFeedback() {
  const token = useSelector(s => s.auth?.token || '');
  const [feedback, setFeedback] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [fWorkshop, setFWorkshop] = useState('all');
  const [fRating, setFRating] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        // Fetch all workshops for filter
        const wsRes = await axios.get(`${API}/api/workshops/admin/all`, { headers });
        const allWorkshops = wsRes.data?.data?.workshops || [];
        setWorkshops(allWorkshops);

        // Fetch all feedback from admin API
        const fbRes = await axios.get(`${API}/api/admin/workshops/feedback`, { headers });
        const allFeedback = fbRes.data?.feedback || [];
        setFeedback(allFeedback);
      } catch (err) {
        console.error('Failed to load feedback:', err);
        setError(err.response?.data?.message || 'Failed to load feedback data.');
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchData();
  }, [token]);

  // Total registrations for pending calculation (must be before stats useMemo)
  const allWorkshopsTotal = workshops.reduce((a, w) => a + (w.registrationCount || 0), 0);

  const stats = useMemo(() => {
    const total = feedback.length;
    const avgRating = total ? Number((feedback.reduce((a, f) => a + (f.rating || 0), 0) / total).toFixed(1)) : 0;
    const avgTrainer = total ? Number((feedback.filter(f => f.trainerRating).reduce((a, f) => a + (f.trainerRating || 0), 0) / total).toFixed(1)) : 0;
    const dist = [5, 4, 3, 2, 1].map(star => ({
      star,
      count: feedback.filter(f => Math.round(f.rating || 0) === star).length,
    }));
    const pending = allWorkshopsTotal - total;
    return { total, avgRating, avgTrainer, dist, pending: Math.max(0, pending) };
  }, [feedback, allWorkshopsTotal]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return feedback.filter(f => {
      const studentName = (f.studentId?.name || f.studentName || '').toLowerCase();
      const comment = (f.comment || '').toLowerCase();
      const wsName = (f.workshopId?.title || f.workshopName || '').toLowerCase();
      const matchQ = !q || studentName.includes(q) || comment.includes(q) || wsName.includes(q);
      const matchW = fWorkshop === 'all' || (f.workshopId?._id || f.workshopId) === fWorkshop;
      const matchR = fRating === 'all' || Math.round(f.rating || 0) === Number(fRating);
      return matchQ && matchW && matchR;
    });
  }, [feedback, search, fWorkshop, fRating]);

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  };

  if (loading) {
    return (
      <div style={S.page}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F', animation: 'spin .7s linear infinite' }} />
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>Feedback</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>Real feedback data from MongoDB WorkshopFeedback collection.</p>
        </div>
        <button style={S.btnGhost}>
          <i className="ti ti-download" style={{ fontSize: 13 }} /> Export
        </button>
      </div>

      {error && (
    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#B91C1C' }}>
      ⚠️ {error}
    </div>
  )}

  {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <KPICard title="Average Rating"  value={stats.avgRating}   icon="star"         accent="#F59E0B" sub="Out of 5.0" />
        <KPICard title="Responses"       value={stats.total}       icon="message"      accent="#3B82F6" sub="Total submitted" />
        <KPICard title="Pending Feedback"value={stats.pending}     icon="clock"        accent="#F97316" sub="Not yet submitted" />
        <KPICard title="Trainer Rating"  value={stats.avgTrainer}  icon="chalkboard"   accent="#8B5CF6" sub="Average trainer score" />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={S.card}>
          <div style={S.panelHd}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Rating Distribution</span>
            <span style={S.pill}>{stats.total} responses</span>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', gap: 24, alignItems: 'center' }}>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{stats.avgRating}</div>
              <Stars rating={Math.round(Number(stats.avgRating))} size={16} />
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>{stats.total} reviews</div>
            </div>
            <div style={{ flex: 1 }}>
              <RatingDistChart data={stats.dist} />
            </div>
          </div>
        </div>

        <div style={S.card}>
          <div style={S.panelHd}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Feedback Summary</span>
            <span style={S.pill}>Real data</span>
          </div>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: '#F8FAFC', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#F59E0B' }}>{stats.total}</div>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginTop: 4 }}>Total Responses</div>
              </div>
              <div style={{ background: '#F8FAFC', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#8B5CF6' }}>{stats.avgTrainer}</div>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginTop: 4 }}>Avg Trainer Rating</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div style={{ position: 'relative' }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 14 }} />
          <input style={{ ...S.input, paddingLeft: 32 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student or comment…" />
        </div>
        <select style={S.input} value={fWorkshop} onChange={e => setFWorkshop(e.target.value)}>
          <option value="all">Workshop: All</option>
          {workshops.map(w => <option key={w._id} value={w._id}>{w.title}</option>)}
        </select>
        <select style={S.input} value={fRating} onChange={e => setFRating(e.target.value)}>
          <option value="all">Rating: All</option>
          {[5,4,3,2,1].map(r => <option key={r} value={r}>{r} Stars</option>)}
        </select>
      </div>

      {/* Comments Table */}
      <div style={{ ...S.card, overflow: 'hidden' }}>
        <div style={S.panelHd}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Comments</span>
          <span style={S.pill}>{filtered.length} entries</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Student','Workshop','Trainer','Rating','Trainer Rating','Content','Comment','Date'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', padding: 40, color: '#94A3B8' }}>No feedback found in MongoDB.</td></tr>
              ) : filtered.map((f, i) => (
                <tr key={f._id || i} style={{ background: i % 2 ? '#FAFAFA' : '#fff' }}>
                  <td style={S.td}><span style={{ fontWeight: 700, color: '#0F172A' }}>{f.studentId?.name || f.studentName || '—'}</span></td>
                  <td style={S.td}>{f.workshopId?.title || f.workshopName || '—'}</td>
                  <td style={S.td}>{f.trainerId?.name || f.trainerName || '—'}</td>
                  <td style={S.td}><Stars rating={f.rating || 0} /></td>
                  <td style={S.td}><Stars rating={f.trainerRating || 0} /></td>
                  <td style={S.td}><Stars rating={f.contentRating || 0} /></td>
                  <td style={{ ...S.td, maxWidth: 300 }}>
                    <span style={{ color: '#475569', fontStyle: 'italic' }}>"{f.comment || ''}"</span>
                    {f.suggestions && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>💡 {f.suggestions}</div>}
                  </td>
                  <td style={S.td}>{formatDate(f.createdAt || f.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid #F1F5F9', fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>
          Showing {filtered.length} of {feedback.length} records (from MongoDB WorkshopFeedback collection)
        </div>
      </div>
    </div>
  );
}
