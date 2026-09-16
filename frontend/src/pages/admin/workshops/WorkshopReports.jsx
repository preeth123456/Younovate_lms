import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from 'utils/apiConfig';

const API = API_BASE_URL;

const S = {
  page:    { padding: '20px 28px', fontFamily: 'Public Sans, system-ui, sans-serif', background: '#F1F5F9', minHeight: '100vh' },
  card:    { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 1px 3px rgba(15,23,42,.05),0 4px 16px rgba(30,58,95,.06)' },
  panelHd: { padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9' },
  th:      { padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#94A3B8', background: '#F8FAFC', textAlign: 'left', whiteSpace: 'nowrap' },
  td:      { padding: '11px 14px', fontSize: 13, color: '#334155', borderBottom: '1px solid #F1F5F9' },
  btnPri:  { background: '#1E3A5F', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
  btnGhost:{ background: '#fff', color: '#475569', border: '1px solid #E2E8F0', padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
  btnDanger:{ background: '#DC2626', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
  pill:    { fontSize: 11, color: '#94A3B8', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 20, padding: '3px 10px', fontWeight: 600 },
  input:   { padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, fontFamily: 'inherit', color: '#0F172A', background: '#fff', cursor: 'pointer' },
};

const REPORT_SECTIONS = [
  { key: 'performance', label: 'Workshop Performance' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'registrations', label: 'Registrations' },
  { key: 'completion', label: 'Completion' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'trainer', label: 'Trainer Performance' },
  { key: 'top', label: 'Top Workshops' },
];

const DATE_RANGES = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '3m', label: 'Last 3 Months' },
  { value: '6m', label: 'Last 6 Months' },
  { value: '12m', label: 'Last 12 Months' },
  { value: 'all', label: 'All Time' },
];

function KPICard({ title, value, icon, accent, sub, delta, loading = false }) {
  return (
    <div style={{ ...S.card, padding: 18 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <i className={`ti ti-${icon}`} style={{ fontSize: 18, color: accent }} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94A3B8' }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', lineHeight: 1, marginTop: 6 }}>
        {loading ? <span style={{ display: 'inline-block', width: 80, height: 28, background: '#E2E8F0', borderRadius: 4, animation: 'pulse 1.5s infinite' }} /> : value}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        {delta && <span style={{ fontSize: 12, fontWeight: 700, color: '#10B981' }}>{delta}</span>}
        {sub && <span style={{ fontSize: 12, color: '#64748B' }}>{sub}</span>}
      </div>
      <style jsx>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
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
          <span style={{ fontSize: 11, color: '#CBD5E1', width: 32, textAlign: 'right' }}>{total > 0 ? Math.round((count / total) * 100) : 0}%</span>
        </div>
      ))}
    </div>
  );
}

export default function WorkshopReports() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [activeTab, setActiveTab] = useState('performance');
  const [dateRange, setDateRange] = useState('6m');
  const [exportLoading, setExportLoading] = useState(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/api/workshops/admin/reports`, {
        headers,
        params: { dateRange, tab: activeTab },
      });
      setReportData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [dateRange, activeTab]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = async (format) => {
    setExportLoading(format);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/api/workshops/admin/reports`, {
        headers,
        params: { dateRange, tab: activeTab, format },
        responseType: 'blob',
      });
      const mimeTypes = {
        excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        pdf: 'application/pdf',
        csv: 'text/csv',
      };
      const extensions = { excel: 'xlsx', pdf: 'pdf', csv: 'csv' };
      const filename = res.headers['content-disposition']?.split('filename=')[1]?.replace(/"/g, '') || `youvaos-workshop-report-${activeTab}-${dateRange}.${extensions[format]}`;
      const url = window.URL.createObjectURL(new Blob([res.data], { type: mimeTypes[format] }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert(`Failed to export ${format.toUpperCase()}: ${err.response?.data?.message || err.message}`);
    } finally {
      setExportLoading(null);
    }
  };

  const summary = reportData?.summary || {};
  const tabData = reportData?.tabData || [];
  const tabHeaders = reportData?.tabHeaders || [];
  const topWorkshops = reportData?.topWorkshops || [];
  const ratingDist = summary.ratingDist || [];

  const total = summary.totalWorkshops ?? 0;
  const revenue = summary.revenue ?? 0;
  const avgRating = summary.avgRating ?? 0;
  const feedbackCount = summary.feedbackCount ?? 0;
  const certCount = summary.totalCertificates ?? 0;
  const eligibleCerts = summary.eligibleCertificates ?? 0;
  const issuedCerts = summary.issuedCertificates ?? 0;
  const totalRegs = summary.totalRegistrations ?? 0;
  const approvedRegs = summary.approvedRegistrations ?? 0;

  if (loading) {
    return (
      <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F', animation: 'spin .7s linear infinite', margin: '0 auto 16px' }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Loading reports…</div>
          <style jsx>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 32, marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Failed to load report</div>
          <div style={{ fontSize: 13, color: '#64748B' }}>{error}</div>
          <button style={{ ...S.btnPri, marginTop: 16 }} onClick={fetchReport}>
            <i className="ti ti-refresh" style={{ fontSize: 13, marginRight: 6 }} /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>Workshop Reports</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>Analytics, performance metrics, and export tools.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select style={S.input} value={dateRange} onChange={e => setDateRange(e.target.value)} disabled={loading}>
            {DATE_RANGES.map(dr => <option key={dr.value} value={dr.value}>{dr.label}</option>)}
          </select>
          <button style={S.btnGhost} onClick={fetchReport} disabled={loading}>
            <i className="ti ti-refresh" style={{ fontSize: 13 }} /> Refresh
          </button>
          <button style={{ ...S.btnPri, opacity: exportLoading === 'excel' ? 0.6 : 1 }} onClick={() => handleExport('excel')} disabled={loading || exportLoading}>
            <i className="ti ti-file-spreadsheet" style={{ fontSize: 13 }} /> {exportLoading === 'excel' ? 'Exporting…' : 'Excel'}
          </button>
          <button style={{ ...S.btnGhost, opacity: exportLoading === 'pdf' ? 0.6 : 1 }} onClick={() => handleExport('pdf')} disabled={loading || exportLoading}>
            <i className="ti ti-file-type-pdf" style={{ fontSize: 13 }} /> {exportLoading === 'pdf' ? 'Exporting…' : 'PDF'}
          </button>
          <button style={{ ...S.btnGhost, opacity: exportLoading === 'csv' ? 0.6 : 1 }} onClick={() => handleExport('csv')} disabled={loading || exportLoading}>
            <i className="ti ti-file-text" style={{ fontSize: 13 }} /> {exportLoading === 'csv' ? 'Exporting…' : 'CSV'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <KPICard title="Total Workshops" value={total} icon="writing" accent="#6366F1" sub="In selected range" />
        <KPICard title="Total Revenue" value={revenue > 0 ? `₹${(revenue/1000).toFixed(1)}K` : '₹0'} icon="currency-rupee" accent="#10B981" sub="Paid workshops" />
        <KPICard title="Feedback" value={avgRating || '—'} icon="star" accent="#F59E0B" sub={`${feedbackCount} responses`} />
        <KPICard title="Certificates" value={certCount} icon="certificate" accent="#8B5CF6" sub={`${issuedCerts} issued, ${eligibleCerts} eligible`} />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {REPORT_SECTIONS.map(sec => (
          <button
            key={sec.key}
            style={{
              padding: '7px 14px', borderRadius: 9, cursor: 'pointer',
              fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
              background: activeTab === sec.key ? '#1E3A5F' : '#fff',
              color: activeTab === sec.key ? '#fff' : '#475569',
              border: activeTab === sec.key ? 'none' : '1px solid #E2E8F0',
              boxShadow: activeTab === sec.key ? '0 2px 8px rgba(30,58,95,.15)' : 'none',
            }}
            onClick={() => setActiveTab(sec.key)}
            disabled={loading}
          >
            {sec.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={S.card}>
          <div style={S.panelHd}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Registrations</span>
            <span style={S.pill}>Total {totalRegs} · Approved {approvedRegs}</span>
          </div>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>
              {totalRegs}
              <span style={{ fontSize: 13, color: '#10B981', fontWeight: 700, marginLeft: 8 }}>▲</span>
            </div>
            <BarChart data={ratingDist.map(r => r.count)} labels={ratingDist.map(r => r.star + '★')} color="#3B82F6" />
          </div>
        </div>

        <div style={S.card}>
          <div style={S.panelHd}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Feedback Rating Distribution</span>
            <span style={S.pill}>{feedbackCount} responses</span>
          </div>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>
              {avgRating || '—'}
              <span style={{ fontSize: 13, color: '#F59E0B', fontWeight: 700, marginLeft: 8 }}>avg rating</span>
            </div>
            <RatingDistChart data={ratingDist} />
          </div>
        </div>
      </div>

      <div style={{ ...S.card, marginBottom: 16, overflow: 'hidden' }}>
        <div style={S.panelHd}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{REPORT_SECTIONS.find(s => s.key === activeTab)?.label || activeTab}</span>
          <span style={S.pill}>{tabData.length} records</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>{tabHeaders.map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {tabData.length === 0 ? (
                <tr><td colSpan={tabHeaders.length} style={{ ...S.td, textAlign: 'center', padding: 40, color: '#94A3B8' }}>No data available for this report.</td></tr>
              ) : tabData.map((row, i) => (
                <tr key={i} style={{ background: i % 2 ? '#FAFAFA' : '#fff' }}>
                  {row.map((cell, j) => (
                    <td key={j} style={S.td}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {activeTab === 'top' && topWorkshops.length > 0 && (
        <div style={{ ...S.card, overflow: 'hidden' }}>
          <div style={S.panelHd}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Top Workshops (by Registrations)</span>
            <span style={S.pill}>Top {topWorkshops.length}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
              <thead>
                <tr>{['#','Workshop','Trainer','Mode','Registrations','Capacity','Revenue','Status'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
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
                    <td style={S.td}>{w.maxSeats || 0}</td>
                    <td style={S.td}>{w.feeType === 'Paid' ? `₹${(w.revenue || 0).toLocaleString()}` : 'Free'}</td>
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
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}