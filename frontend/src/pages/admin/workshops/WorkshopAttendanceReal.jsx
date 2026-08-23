// Admin Workshop Attendance — uses real MongoDB data from WorkshopAttendance collection
import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { API_BASE_URL } from '../../../config/api';

const API = API_BASE_URL;

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

export default function WorkshopAttendanceReal() {
  const token = useSelector(s => s.auth?.token || '');
  const [attendance, setAttendance] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fSession, setFSession] = useState('all');
  const [fStatus, setFStatus] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        // Fetch all workshop sessions
        const sessRes = await axios.get(`${API}/api/workshop-sessions`, { headers });
        const allSessions = sessRes.data?.sessions || [];
        setSessions(allSessions);

        // Fetch attendance for each session
        const attPromises = allSessions.map(s =>
          axios.get(`${API}/api/workshop-sessions/${s._id}/attendance`, { headers })
            .then(r => ({ sessionId: s._id, sessionTitle: s.title, session: s, records: r.data?.records || [] }))
            .catch(() => ({ sessionId: s._id, sessionTitle: s.title, session: s, records: [] }))
        );
        const attResults = await Promise.all(attPromises);
        const allRecords = attResults.flatMap(r =>
          r.records.map(rec => ({ ...rec, sessionTitle: r.sessionTitle, session: r.session }))
        );
        setAttendance(allRecords);
      } catch (err) {
        console.error('Failed to load attendance:', err);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchData();
  }, [token]);

  const stats = useMemo(() => {
    const total = attendance.length;
    const present = attendance.filter(r => r.attendanceStatus === 'Present' || r.attendanceStatus === 'Late').length;
    const absent = attendance.filter(r => r.attendanceStatus === 'Absent').length;
    const late = attendance.filter(r => r.attendanceStatus === 'Late').length;
    const avgPct = total > 0 ? Math.round(attendance.reduce((a, r) => a + (r.attendancePct || 0), 0) / total) : 0;
    const totalDuration = attendance.reduce((a, r) => a + (r.duration || 0), 0);
    return { total, present, absent, late, avgPct, totalDuration };
  }, [attendance]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return attendance.filter(r => {
      const p = r.participant || {};
      const name = (p.name || '').toLowerCase();
      const email = (p.email || '').toLowerCase();
      const sessTitle = (r.sessionTitle || '').toLowerCase();
      const matchQ = !q || name.includes(q) || email.includes(q) || sessTitle.includes(q);
      const matchS = fSession === 'all' || r.sessionId === fSession;
      const matchSt = fStatus === 'all' ||
        (fStatus === 'present' && (r.attendanceStatus === 'Present' || r.attendanceStatus === 'Late')) ||
        (fStatus === 'absent' && r.attendanceStatus === 'Absent') ||
        (fStatus === 'late' && r.attendanceStatus === 'Late');
      return matchQ && matchS && matchSt;
    });
  }, [attendance, search, fSession, fStatus]);

  const getAttBadge = (rec) => {
    const s = rec.attendanceStatus;
    if (s === 'Present' || s === 'Late') return ['#D1FAE5', '#065F46', s === 'Late' ? 'Late' : 'Present'];
    if (s === 'Partial') return ['#FEF3C7', '#92400E', 'Partial'];
    return ['#FEE2E2', '#991B1B', 'Absent'];
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
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>Attendance</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>Real attendance data from MongoDB workshopAttendance collection.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={S.btnGhost}><i className="ti ti-file-spreadsheet" style={{ fontSize: 13 }} /> Export CSV</button>
          <button style={S.btnGhost}><i className="ti ti-file-type-pdf" style={{ fontSize: 13 }} /> Export PDF</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <KPICard title="Total Records" value={stats.total} icon="clipboard-list" accent="#3B82F6" />
        <KPICard title="Present" value={stats.present} icon="circle-check" accent="#10B981" sub={`${stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0}%`} />
        <KPICard title="Absent" value={stats.absent} icon="circle-x" accent="#EF4444" />
        <KPICard title="Avg Attendance" value={`${stats.avgPct}%`} icon="chart-bar" accent="#F59E0B" sub={`${stats.totalDuration} min total`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div style={{ position: 'relative' }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 14 }} />
          <input style={{ ...S.input, paddingLeft: 32 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student, email or workshop…" />
        </div>
        <select style={S.input} value={fSession} onChange={e => setFSession(e.target.value)}>
          <option value="all">Session: All</option>
          {sessions.map(s => <option key={s._id} value={s._id}>{s.title}</option>)}
        </select>
        <select style={S.input} value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="all">Status: All</option>
          <option value="present">Present</option>
          <option value="absent">Absent</option>
          <option value="late">Late</option>
        </select>
      </div>

      <div style={{ ...S.card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>
                {['Student','Email','Workshop/Session','Join Time','Leave Time','Duration (min)','Attendance %','Status'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', padding: 40, color: '#94A3B8' }}>No records found.</td></tr>
              ) : filtered.map((r, i) => {
                const p = r.participant || {};
                const [bg, fg, label] = getAttBadge(r);
                return (
                  <tr key={r._id || i} style={{ background: i % 2 ? '#FAFAFA' : '#fff' }}>
                    <td style={S.td}><span style={{ fontWeight: 700, color: '#0F172A' }}>{p.name || '—'}</span></td>
                    <td style={S.td}>{p.email || '—'}</td>
                    <td style={S.td}>{r.sessionTitle || '—'}</td>
                    <td style={S.td}>{r.joinTime ? new Date(r.joinTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}</td>
                    <td style={S.td}>{r.leaveTime ? new Date(r.leaveTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}</td>
                    <td style={S.td}>{r.duration || 0}</td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 60, height: 6, background: '#F1F5F9', borderRadius: 3 }}>
                          <div style={{ width: `${r.attendancePct || 0}%`, height: '100%', background: r.attendancePct >= 60 ? '#10B981' : r.attendancePct > 0 ? '#F59E0B' : '#EF4444', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{r.attendancePct || 0}%</span>
                      </div>
                    </td>
                    <td style={S.td}>
                      <span style={{ background: bg, color: fg, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid #F1F5F9', fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>
          Showing {filtered.length} of {attendance.length} records (from MongoDB workshopAttendance collection)
        </div>
      </div>
    </div>
  );
}
