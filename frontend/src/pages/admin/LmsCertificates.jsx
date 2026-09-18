// LMS Certificates page (Admin) — part 1: shell + data loading.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { API_BASE_URL } from '../../config/api';
import { openLmsCertificatePrint } from '../../components/certificate/CourseCertificateTemplate';
import { fmtDateTime } from '../../utils/dateTime';
import AppIcon from '../../components/shared/AppIcon';

const API = API_BASE_URL;

const S = {
  page: { padding: '20px 28px', fontFamily: 'Public Sans, system-ui, sans-serif', background: '#F1F5F9', minHeight: '100vh' },
  card: { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 1px 3px rgba(15,23,42,.05),0 4px 16px rgba(30,58,95,.06)' },
  input: { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, fontFamily: 'inherit', color: '#0F172A', background: '#fff', outline: 'none' },
  th: { padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#94A3B8', background: '#F8FAFC', textAlign: 'left', whiteSpace: 'nowrap' },
  td: { padding: '11px 14px', fontSize: 13, color: '#334155', borderBottom: '1px solid #F1F5F9' },
  btnPri: { background: '#1E3A5F', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
  btnGhost: { background: '#fff', color: '#475569', border: '1px solid #E2E8F0', padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
};

const FLOW = { Eligible: '#1D4ED8', Issued: '#065F46', Pending: '#92400E' };

export default function LmsCertificates() {
  const token = useSelector((s) => s.auth?.token || '');
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [search, setSearch] = useState('');

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const loadCourses = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/api/courses`, { headers });
      const list = data?.data?.courses || data?.courses || data?.data || [];
      const arr = Array.isArray(list) ? list : [];
      setCourses(arr);
      if (!courseId && arr.length) setCourseId(String(arr[0]._id));
    } catch (_) {}
  }, [headers]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRows = useCallback(async (cid) => {
    if (!cid) return;
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/lms-certificates/admin/eligibility`, { headers, params: { courseId: cid } });
      setRows(data.rows || []);
    } catch (_) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { loadCourses(); }, [loadCourses]);
  useEffect(() => { if (courseId) loadRows(courseId); }, [courseId, loadRows]);

  const issue = async (row) => {
    const sid = row.student?._id || row.student;
    setBusyId(String(sid));
    try {
      const { data } = await axios.post(`${API}/api/lms-certificates/admin/issue`, { courseId, studentId: sid }, { headers });
      const record = data.certificate;
      setRows((prev) => prev.map((r) => (String(r.student?._id || r.student) === String(sid)
        ? { ...r, certificate: record, canIssue: false } : r)));
      openLmsCertificatePrint({
        traineeName: record.studentId?.name || row.student?.name || '',
        courseName: record.courseId?.name || '',
        completionDate: record.issuedDate || new Date().toISOString(),
        certificateNo: record.certificateNo || '',
      });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to issue certificate.');
    } finally {
      setBusyId('');
    }
  };

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const nm = (r.student?.name || '').toLowerCase();
    const em = (r.student?.email || '').toLowerCase();
    return nm.includes(q) || em.includes(q);
  });
  const eligible = rows.filter((r) => r.canIssue).length;
  const issued = rows.filter((r) => r.certificate?.status === 'Issued').length;
  const pending = Math.max(0, rows.length - eligible - issued);
  const flowOf = (r) => (r.certificate?.status === 'Issued' ? 'Issued' : r.completed ? 'Eligible' : 'Pending');
  const flowLabel = (r) => {
    if (r.certificate?.status === 'Issued') return r.certificate?.sentToTrainee ? 'Sent to Trainee' : 'Sent to Trainer';
    return r.completed ? 'Eligible for Certificate' : 'Course Not Completed';
  };

  const kpis = [
    ['Eligible', eligible, 'circle-check', '#1D4ED8'],
    ['Issued / Sent to Trainer', issued, 'certificate', '#16a34a'],
    ['Not Completed', pending, 'clock', '#d97706'],
  ];

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>LMS Certificates</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>Issue only after the ENTIRE course is completed.</p>
        </div>
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)} style={{ ...S.input, width: 260 }}>
          {courses.map((c) => <option key={c._id} value={c._id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 20 }}>
        {kpis.map(([t, v, icon, accent]) => (
          <div key={t} style={{ ...S.card, padding: 18 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <AppIcon name={icon} size={18} style={{ color: accent }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94A3B8' }}>{t}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', lineHeight: 1, marginTop: 6 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', display: 'flex', gap: 10, borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap' }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search trainee…" style={{ ...S.input, maxWidth: 260 }} />
          <button style={S.btnGhost} onClick={() => loadRows(courseId)}><AppIcon name="refresh" size={14} /> Refresh</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead><tr>{['Trainee', 'Batch', 'Completion', 'Status', 'Certificate No', 'Issued', 'Action'].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', padding: 40, color: '#94A3B8' }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', padding: 40, color: '#94A3B8' }}>No enrolled trainees.</td></tr>
              ) : filtered.map((r, i) => {
                const sid = String(r.student?._id || r.student);
                const flow = flowOf(r);
                const busy = busyId === sid;
                return (
                  <tr key={sid} style={{ background: i % 2 ? '#FAFAFA' : '#fff' }}>
                    <td style={S.td}>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{r.student?.name || '—'}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>{r.student?.email || ''}</div>
                    </td>
                    <td style={S.td}>{r.batch?.name || '—'}</td>
                    <td style={S.td}>{r.completed ? 'Complete course done' : 'Incomplete'}</td>
                    <td style={S.td}><span style={{ background: `${FLOW[flow]}18`, color: FLOW[flow], padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{flowLabel(r)}</span></td>
                    <td style={S.td}>{r.certificate?.certificateNo ? <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#F1F5F9', padding: '2px 8px', borderRadius: 6 }}>{r.certificate.certificateNo}</span> : '—'}</td>
                    <td style={S.td}>{r.certificate?.issuedDate ? fmtDateTime(r.certificate.issuedDate) : '—'}</td>
                    <td style={S.td}>
                      {r.certificate?.status === 'Issued' ? (
                        <button style={S.btnGhost} onClick={() => openLmsCertificatePrint({ traineeName: r.student?.name || '', courseName: r.course?.name || '', completionDate: r.certificate.issuedDate, certificateNo: r.certificate.certificateNo })}><AppIcon name="download" size={14} /> View / Download</button>
                      ) : (
                        <button style={{ ...S.btnPri, opacity: !r.canIssue || busy ? 0.5 : 1 }} disabled={!r.canIssue || busy} title={!r.completed ? 'Course not completed' : 'Issue certificate to trainer'} onClick={() => issue(r)}><AppIcon name="certificate" size={14} /> {busy ? 'Issuing…' : 'Issue to Trainer'}</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

