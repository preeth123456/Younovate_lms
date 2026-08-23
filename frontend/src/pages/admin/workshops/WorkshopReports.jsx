import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../../config/api';

const API = API_BASE_URL;

const S = {
  page:    { padding: '20px 28px', fontFamily: 'Public Sans, system-ui, sans-serif', background: '#F1F5F9', minHeight: '100vh' },
  card:    { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 1px 3px rgba(15,23,42,.05),0 4px 16px rgba(30,58,95,.06)' },
  panelHd: { padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9' },
  th:      { padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#94A3B8', background: '#F8FAFC', textAlign: 'left', whiteSpace: 'nowrap' },
  td:      { padding: '11px 14px', fontSize: 13, color: '#334155', borderBottom: '1px solid #F1F5F9' },
  btnPri:  { background: '#1E3A5F', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
  btnGhost:{ background: '#fff', color: '#475569', border: '1px solid #E2E8F0', padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
  pill:    { fontSize: 11, color: '#94A3B8', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 20, padding: '3px 10px', fontWeight: 600 },
};

const REPORT_SECTIONS = ['Workshop Performance', 'Revenue', 'Attendance', 'Registrations', 'Completion', 'Feedback', 'Trainer Performance', 'Top Workshops'];

function KPICard({ title, value, icon, accent, sub, delta }) {
  return (
    <div style={{ ...S.card, padding: 18 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <i className={`ti ti-${icon}`} style={{ fontSize: 18, color: accent }} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94A3B8' }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', lineHeight: 1, marginTop: 6 }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        {delta && <span style={{ fontSize: 12, fontWeight: 700, color: '#10B981' }}>{delta}</span>}
        {sub && <span style={{ fontSize: 12, color: '#64748B' }}>{sub}</span>}
      </div>
    </div>
  );
}

function BarChart({ data, labels, color, height = 100 }) {
  const max = Math.max(...data, 1);
  const w = 300, h = height;
  const barW = (w / data.length) * 0.6;
  const gap  = w / data.length;
  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${w} ${h + 20}`} style={{ display: 'block' }}>
        {data.map((v, i) => {
          const barH = (v / max) * h;
          const x = i * gap + (gap - barW) / 2;
          const y = h - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} rx={3} fill={color} opacity={0.85} />
              <text x={x + barW / 2} y={h + 14} textAnchor="middle" fontSize={9} fill="#94A3B8" fontFamily="inherit">{labels[i]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function WorkshopReports() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [workshops, setWorkshops] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    (async () => {
      try {
        const [statsRes, wsRes, fbRes] = await Promise.all([
          axios.get(`${API}/api/workshops/admin/stats`, { headers }),
          axios.get(`${API}/api/workshops/admin/all?limit=200`, { headers }),
          axios.get(`${API}/api/admin/workshops/feedback?limit=200`, { headers }),
        ]);
        if (cancelled) return;
        setStats(statsRes.data?.data || {});
        setWorkshops(wsRes.data?.data?.workshops || []);
        setFeedback(fbRes.data?.feedback || []);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Failed to load reports');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const total = stats?.total || workshops.length;
  const revenue = stats?.totalSeats ? workshops.reduce((a, w) => a + (w.feeType === 'Paid' ? (w.fee || 0) * (w.registrationCount || 0) : 0), 0) : 0;

  const avgRating = feedback.length ? Number((feedback.reduce((a, f) => a + (f.rating || 0), 0) / feedback.length).toFixed(1)) : 0;
  const ratingDist = [5, 4, 3, 2, 1].map(star => ({ star, count: feedback.filter(f => Math.round(f.rating || 0) === star).length }));

  const topWorkshops = useMemo(() => {
    return [...workshops]
      .sort((a, b) => (b.registrationCount || 0) - (a.registrationCount || 0))
      .slice(0, 10)
      .map(w => ({
        ...w,
        attPct: 0,
        revenue: w.feeType === 'Paid' ? (w.fee || 0) * (w.registrationCount || 0) : 0,
      }));
  }, [workshops]);

  if (loading) {
    return <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>Loading reports…</div>;
  }
  if (error) {
    return <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>{error}</div>;
  }

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>Reports</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>Workshop analytics, performance metrics, and export tools.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, fontFamily: 'inherit', color: '#0F172A', background: '#fff', cursor: 'pointer' }} disabled>
            <option value="6m">Last 6 Months</option>
          </select>
          {[
            { label: 'Excel', icon: 'file-spreadsheet' },
            { label: 'PDF',   icon: 'file-type-pdf' },
            { label: 'CSV',   icon: 'file-text' },
          ].map(btn => (
            <button key={btn.label} style={S.btnGhost} disabled>
              <i className={`ti ti-${btn.icon}`} style={{ fontSize: 13 }} /> {btn.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <KPICard title="Total Workshops"  value={total}          icon="writing"        accent="#6366F1" sub="All time" />
        <KPICard title="Total Revenue"    value={revenue > 0 ? `₹${(revenue/1000).toFixed(0)}K` : '₹0'} icon="currency-rupee" accent="#10B981" sub="Paid workshops" />
        <KPICard title="Feedback"         value={avgRating || '—'} icon="star"           accent="#F59E0B" sub={`${feedback.length} responses`} />
        <KPICard title="Certificates"     value={stats?.data?.certCount || 0} icon="certificate"    accent="#8B5CF6" sub="Eligible" />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {REPORT_SECTIONS.map(sec => (
          <button key={sec} style={{
            padding: '7px 14px', borderRadius: 9, cursor: 'pointer',
            fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
            background: '#1E3A5F', color: '#fff', border: 'none',
          }}>
            {sec}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={S.card}>
          <div style={S.panelHd}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Registrations</span>
            <span style={S.pill}>Total {stats?.data?.totalRegs || 0}</span>
          </div>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>
              {stats?.data?.totalRegs || 0}
              <span style={{ fontSize: 13, color: '#10B981', fontWeight: 700, marginLeft: 8 }}>▲ {stats?.data?.regPct || 0}%</span>
            </div>
            <BarChart data={ratingDist.map(r => r.count)} labels={ratingDist.map(r => r.star)} color="#3B82F6" />
          </div>
        </div>

        <div style={S.card}>
          <div style={S.panelHd}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Feedback Rating Distribution</span>
            <span style={S.pill}>{feedback.length} responses</span>
          </div>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>
              {avgRating || '—'}
              <span style={{ fontSize: 13, color: '#F59E0B', fontWeight: 700, marginLeft: 8 }}>avg rating</span>
            </div>
            <BarChart data={ratingDist.map(r => r.count)} labels={['5★','4★','3★','2★','1★']} color="#F59E0B" />
          </div>
        </div>
      </div>

      <div style={{ ...S.card, marginBottom: 16, overflow: 'hidden' }}>
        <div style={S.panelHd}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Top Workshops</span>
          <span style={S.pill}>By registrations</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
            <thead>
              <tr>{['#','Workshop','Mode','Registrations','Revenue','Status'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {topWorkshops.map((w, i) => (
                <tr key={w._id} style={{ background: i % 2 ? '#FAFAFA' : '#fff' }}>
                  <td style={{ ...S.td, fontWeight: 800, color: '#94A3B8' }}>#{i + 1}</td>
                  <td style={S.td}>
                    <div style={{ fontWeight: 700, color: '#0F172A' }}>{w.title}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{w.trainerName || '—'}</div>
                  </td>
                  <td style={S.td}>{w.mode || '—'}</td>
                  <td style={S.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700 }}>{w.registrationCount || 0}</span>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>/ {w.maxSeats || 0}</span>
                    </div>
                  </td>
                  <td style={S.td}>{w.feeType === 'Paid' ? `₹${(w.fee || 0).toLocaleString()}` : 'Free'}</td>
                  <td style={S.td}>
                    <span style={{
                      background: w.status === 'Completed' ? '#D1FAE5' : w.status === 'Published' ? '#DBEAFE' : '#F1F5F9',
                      color: w.status === 'Completed' ? '#065F46' : w.status === 'Published' ? '#1E40AF' : '#475569',
                      padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                    }}>
                      {w.status || 'Draft'}
                    </span>
                  </td>
                </tr>
              ))}
              {topWorkshops.length === 0 && (
                <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', padding: 40, color: '#94A3B8' }}>No workshop data available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
