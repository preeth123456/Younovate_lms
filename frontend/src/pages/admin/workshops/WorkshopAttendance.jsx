import React, { useState, useMemo } from 'react';
import {
  WORKSHOPS_MOCK,
  WORKSHOP_REGISTRATIONS_MOCK,
} from './workshopMockData';
import AppIcon from '../../../components/shared/AppIcon';

const S = {
  page:    { padding: '20px 28px', fontFamily: 'Public Sans, system-ui, sans-serif', background: '#F1F5F9', minHeight: '100vh' },
  card:    { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 1px 3px rgba(15,23,42,.05),0 4px 16px rgba(30,58,95,.06)' },
  input:   { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, fontFamily: 'inherit', color: '#0F172A', background: '#fff', outline: 'none' },
  th:      { padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#94A3B8', background: '#F8FAFC', textAlign: 'left', whiteSpace: 'nowrap' },
  td:      { padding: '11px 14px', fontSize: 13, color: '#334155', borderBottom: '1px solid #F1F5F9' },
  btnPri:  { background: '#1E3A5F', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
  btnGhost:{ background: '#fff', color: '#475569', border: '1px solid #E2E8F0', padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
};

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

// Enrich registrations with workshop name and mock times
const ENRICHED = WORKSHOP_REGISTRATIONS_MOCK.map(r => {
  const ws = WORKSHOPS_MOCK.find(w => w.id === r.workshopId);
  return {
    ...r,
    workshopName: ws?.name || '—',
    joinTime:  r.attendanceStatus === 'Joined' || r.attendanceStatus === 'Completed' ? '10:05 AM' : '—',
    leaveTime: r.attendanceStatus === 'Completed' ? '11:45 AM' : r.attendanceStatus === 'Joined' ? 'Active' : '—',
    duration:  r.attendancePct > 0 ? `${Math.round(r.attendancePct * 0.9)} min` : '—',
  };
});

export default function WorkshopAttendance() {
  const [search,     setSearch]     = useState('');
  const [fWorkshop,  setFWorkshop]  = useState('all');
  const [fStatus,    setFStatus]    = useState('all');

  const present = ENRICHED.filter(r => r.attendancePct >= 60).length;
  const absent  = ENRICHED.filter(r => r.attendancePct === 0).length;
  const late    = ENRICHED.filter(r => r.attendancePct > 0 && r.attendancePct < 60).length;
  const attAvg  = ENRICHED.filter(r => r.attendancePct > 0).length
    ? Math.round(ENRICHED.filter(r => r.attendancePct > 0).reduce((a, r) => a + r.attendancePct, 0) / ENRICHED.filter(r => r.attendancePct > 0).length)
    : 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ENRICHED.filter(r =>
      (!q || r.fullName.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.workshopName.toLowerCase().includes(q)) &&
      (fWorkshop === 'all' || r.workshopId === fWorkshop) &&
      (fStatus === 'all' ||
        (fStatus === 'present' && r.attendancePct >= 60) ||
        (fStatus === 'absent'  && r.attendancePct === 0) ||
        (fStatus === 'late'    && r.attendancePct > 0 && r.attendancePct < 60))
    );
  }, [search, fWorkshop, fStatus]);

  const getAttBadge = (pct) => {
    if (pct >= 60) return ['#D1FAE5', '#065F46', 'Present'];
    if (pct > 0)   return ['#FEF3C7', '#92400E', 'Late'];
    return ['#FEE2E2', '#991B1B', 'Absent'];
  };

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>Attendance</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>Track participant attendance across all workshops.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={S.btnGhost}>
            <i className="ti ti-file-spreadsheet" style={{ fontSize: 13 }} /> Export Excel
          </button>
          <button style={S.btnGhost}>
            <i className="ti ti-file-type-pdf" style={{ fontSize: 13 }} /> Export PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <KPICard title="Attendance %" value={`${attAvg}%`} icon="chart-bar"     accent="#3B82F6" sub="Average across all" />
        <KPICard title="Present"      value={present}      icon="circle-check"  accent="#10B981" sub="≥ 60% attendance" />
        <KPICard title="Absent"       value={absent}       icon="circle-x"      accent="#EF4444" sub="0% attendance" />
        <KPICard title="Late"         value={late}         icon="clock"         accent="#F59E0B" sub="< 60% attendance" />
      </div>

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div style={{ position: 'relative' }}>
          <AppIcon name="search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input style={{ ...S.input, paddingLeft: 32 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student, email or workshop…" />
        </div>
        <select style={S.input} value={fWorkshop} onChange={e => setFWorkshop(e.target.value)}>
          <option value="all">Workshop: All</option>
          {WORKSHOPS_MOCK.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select style={S.input} value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="all">Status: All</option>
          <option value="present">Present</option>
          <option value="absent">Absent</option>
          <option value="late">Late</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ ...S.card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>
                {['Student','Email','Workshop','Join Time','Leave Time','Duration','Attendance %','Status','Actions'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ ...S.td, textAlign: 'center', padding: 40, color: '#94A3B8' }}>No records found.</td></tr>
              ) : filtered.map((r, i) => {
                const [bg, fg, label] = getAttBadge(r.attendancePct);
                return (
                  <tr key={r.id} style={{ background: i % 2 ? '#FAFAFA' : '#fff' }}>
                    <td style={S.td}><span style={{ fontWeight: 700, color: '#0F172A' }}>{r.fullName}</span></td>
                    <td style={S.td}>{r.email}</td>
                    <td style={S.td}>{r.workshopName}</td>
                    <td style={S.td}>{r.joinTime}</td>
                    <td style={S.td}>{r.leaveTime}</td>
                    <td style={S.td}>{r.duration}</td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 60, height: 6, background: '#F1F5F9', borderRadius: 3 }}>
                          <div style={{ width: `${r.attendancePct}%`, height: '100%', background: r.attendancePct >= 60 ? '#10B981' : r.attendancePct > 0 ? '#F59E0B' : '#EF4444', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{r.attendancePct}%</span>
                      </div>
                    </td>
                    <td style={S.td}>
                      <span style={{ background: bg, color: fg, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{label}</span>
                    </td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button title="View" style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="ti ti-eye" style={{ fontSize: 12 }} />
                        </button>
                        <button title="Edit" style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="ti ti-pencil" style={{ fontSize: 12 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>Showing {filtered.length} of {ENRICHED.length} records</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={{ ...S.btnGhost, padding: '6px 12px', fontSize: 12 }}>‹ Prev</button>
            <button style={{ ...S.btnPri, padding: '6px 12px', fontSize: 12 }}>1</button>
            <button style={{ ...S.btnGhost, padding: '6px 12px', fontSize: 12 }}>Next ›</button>
          </div>
        </div>
      </div>
    </div>
  );
}
