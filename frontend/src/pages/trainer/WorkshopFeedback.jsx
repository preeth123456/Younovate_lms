import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';
import {
  fetchTrainerWorkshops,
  setSelectedWorkshop,
  selectTrainerWorkshops,
  selectSelectedWorkshopId,
} from '../../features/Trainer/trainerWorkshopSlice';
import { S, Empty, PageHeader, KPICard, fmtDateTime, WorkshopSelector } from './workshopShared';

const API = API_BASE_URL;

const CSS = `@keyframes spin{to{transform:rotate(360deg)}} .ws-row:hover{background:#f9fafb!important}`;

function Stars({ rating, size = 13 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1,2,3,4,5].map(s => (
        <i key={s} className={`ti ti-star${s <= rating ? '-filled' : ''}`} style={{ fontSize: size, color: '#d97706' }} />
      ))}
    </span>
  );
}

function RatingBar({ star, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', width: 10 }}>{star}</span>
      <i className="ti ti-star-filled" style={{ fontSize: 11, color: '#d97706' }} />
      <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#d97706', borderRadius: 4, transition: 'width .4s ease' }} />
      </div>
      <span style={{ fontSize: '0.75rem', color: '#9ca3af', width: 28, textAlign: 'right' }}>{count}</span>
    </div>
  );
}

export default function WorkshopFeedback() {
  const dispatch   = useDispatch();
  const token      = useSelector(s => s.auth?.token || '');
  const workshops  = useSelector(selectTrainerWorkshops);
  const selectedId = useSelector(selectSelectedWorkshopId);
  const selected   = workshops.find(w => w._id === selectedId) || workshops[0] || null;
  const [feedback, setFeedback] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search,  setSearch]  = useState('');
  const [fRating, setFRating] = useState('all');

  useEffect(() => { dispatch(fetchTrainerWorkshops()); }, [dispatch]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError('');
    axios.get(`${API}/api/trainer/workshop-feedback`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        setFeedback(res.data?.feedback || []);
        setStats(res.data?.stats || {});
      })
      .catch(e => setError(e.response?.data?.message || 'Failed to load feedback'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (selected?._id && !selectedId) dispatch(setSelectedWorkshop(selected._id));
  }, [selected?._id, selectedId, dispatch]);

  const handleSelect = (id) => {
    dispatch(setSelectedWorkshop(id));
  };

  const scopedFeedback = selected?._id
    ? feedback.filter(f => String(f.workshopId?._id || f.workshopId) === String(selected._id))
    : feedback;

  const filtered = scopedFeedback.filter(f => {
    const q = search.trim().toLowerCase();
    const matchQ = !q || (f.studentId?.name || '').toLowerCase().includes(q) || (f.comment || '').toLowerCase().includes(q);
    const matchR = fRating === 'all' || f.rating === Number(fRating);
    return matchQ && matchR;
  });

  const dist = stats.dist || [5,4,3,2,1].map(star => ({ star, count: scopedFeedback.filter(f => f.rating === star).length }));
  const total = scopedFeedback.length;
  const avgRating = total
    ? Number((scopedFeedback.reduce((a, f) => a + (f.rating || 0), 0) / total).toFixed(1))
    : (stats.avgRating || 0);

  return (
    <div style={S.page}>
      <style>{CSS}</style>
      <PageHeader title="Feedback" subtitle="Review participant feedback for your workshops.">
        <WorkshopSelector workshops={workshops} selectedId={selected?._id} onSelect={handleSelect} />
      </PageHeader>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 16px', marginBottom: 16, color: '#b91c1c', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 24 }}>
        <KPICard title="Avg Rating"     value={avgRating ? `${avgRating} ★` : '—'} icon="star"        accent="#d97706" sub="Out of 5.0" />
        <KPICard title="Responses"      value={total}                                            icon="message"     accent="#6366f1" sub={selected ? 'This workshop' : 'All workshops'} />
        <KPICard title="Trainer Rating" value={stats.avgTrainer ? `${stats.avgTrainer} ★` : '—'} icon="chalkboard" accent="#7c3aed" sub="Your score" />
        <KPICard title="5 Star"         value={dist.find(d => d.star === 5)?.count ?? 0}         icon="star-filled" accent="#16a34a" />
      </div>

      {!selected ? <Empty icon="⭐" msg="Select a workshop to view feedback." /> : loading ? (
        <Empty icon="⏳" msg="Loading feedback…" />
      ) : (
        <>
          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            {/* Rating Distribution */}
            <div style={S.card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#111827' }}>Rating Distribution</span>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{total} responses</span>
              </div>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{stats.avgRating || '—'}</div>
                  <Stars rating={Math.round(stats.avgRating || 0)} size={14} />
                  <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 4 }}>{total} reviews</div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {dist.map(d => <RatingBar key={d.star} star={d.star} count={d.count} total={total} />)}
                </div>
              </div>
            </div>

            {/* Suggestions summary */}
            <div style={S.card}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#111827', marginBottom: 14 }}>Recent Suggestions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 200, overflowY: 'auto' }}>
                {feedback.filter(f => f.suggestions?.trim()).length === 0 ? (
                  <Empty icon="💬" msg="No suggestions yet" />
                ) : feedback.filter(f => f.suggestions?.trim()).slice(0, 5).map((f, i) => (
                  <div key={i} style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px', fontSize: '0.82rem', color: '#374151', fontStyle: 'italic' }}>
                    "{f.suggestions}"
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 4, fontStyle: 'normal' }}>{f.studentId?.name || 'Anonymous'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 220px' }}>
              <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 14 }} />
              <input style={{ ...S.input, paddingLeft: 32 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student or comment…" />
            </div>
            <select style={{ ...S.input, flex: '0 0 140px' }} value={fRating} onChange={e => setFRating(e.target.value)}>
              <option value="all">All Ratings</option>
              {[5,4,3,2,1].map(r => <option key={r} value={r}>{r} Stars</option>)}
            </select>
          </div>

          {/* Comments Table */}
          <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Student','Rating','Trainer Rating','Comment','Date'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                      {scopedFeedback.length === 0 ? 'No feedback submitted yet for this workshop.' : 'No feedback matches your filters.'}
                    </td></tr>
                  ) : filtered.map((f, i) => (
                    <tr key={f._id} className="ws-row" style={{ background: i % 2 ? '#fafafa' : '#fff' }}>
                      <td style={S.td}>
                        <div style={{ fontWeight: 600, color: '#111827' }}>{f.studentId?.name || '—'}</div>
                        <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{f.studentId?.email}</div>
                      </td>
                      <td style={S.td}><Stars rating={f.rating} /></td>
                      <td style={S.td}>{f.trainerRating ? <Stars rating={f.trainerRating} /> : <span style={{ color: '#9ca3af' }}>—</span>}</td>
                      <td style={{ ...S.td, maxWidth: 300 }}>
                        <span style={{ color: '#374151', fontStyle: 'italic' }}>"{f.comment || '—'}"</span>
                      </td>
                      <td style={S.td}>{fmtDateTime(f.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
