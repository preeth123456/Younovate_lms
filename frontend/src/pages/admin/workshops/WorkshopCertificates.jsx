import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { API_BASE_URL } from 'utils/apiConfig';
import CourseCertificateTemplate from '../../../components/certificate/CourseCertificateTemplate';
import { fmtDateTime } from '../../../utils/dateTime';
import toast from 'react-hot-toast';
import AppIcon from '../../../components/shared/AppIcon';

const API = API_BASE_URL;

const S = {
  page:    { padding: '20px 28px', fontFamily: 'Public Sans, system-ui, sans-serif', background: '#F1F5F9', minHeight: '100vh' },
  card:    { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 1px 3px rgba(15,23,42,.05),0 4px 16px rgba(30,58,95,.06)' },
  input:   { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, fontFamily: 'inherit', color: '#0F172A', background: '#fff', outline: 'none' },
  panelHd: { padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9' },
  th:      { padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#94A3B8', background: '#F8FAFC', textAlign: 'left', whiteSpace: 'nowrap' },
  td:      { padding: '11px 14px', fontSize: 13, color: '#334155', borderBottom: '1px solid #F1F5F9' },
  btnPri:  { background: '#1E3A5F', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
  btnGhost:{ background: '#fff', color: '#475569', border: '1px solid #E2E8F0', padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
  pill:    { fontSize: 11, color: '#94A3B8', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 20, padding: '3px 10px', fontWeight: 600 },
};

const STATUS_CFG = {
  Issued:   { bg: '#D1FAE5', color: '#065F46', label: 'Issued' },
  Eligible: { bg: '#DBEAFE', color: '#1D4ED8', label: 'Eligible' },
  Pending:  { bg: '#FEF3C7', color: '#92400E', label: 'Pending' },
  Rejected: { bg: '#FEE2E2', color: '#B91C1C', label: 'Rejected' },
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

function openCertificatePrint({ traineeName, courseName, score, completionDate, certificateNo }) {
  const win = window.open('', '_blank', 'width=1100,height=780');
  if (!win) {
    alert('Please allow pop-ups to download the certificate.');
    return;
  }
  win.document.write(`<!DOCTYPE html><html><head><title>Certificate - ${traineeName}</title>
    <style>
      @page { size: landscape; margin: 12mm; }
      @media print {
        body { margin: 0; padding: 0; background: #fff !important; }
        .course-certificate-template { box-shadow: none !important; }
      }
      body { margin: 0; padding: 16px; background: #e2e8f0; display: flex; justify-content: center; }
    </style></head><body></body></html>`);
  win.document.close();
  const mount = win.document.body;
  const root = createRoot(mount);
  root.render(
    <CourseCertificateTemplate
      traineeName={traineeName}
      courseName={courseName}
      score={score}
      completionDate={completionDate}
      certificateNo={certificateNo}
    />
  );
  setTimeout(() => {
    win.focus();
    win.print();
  }, 500);
}

export default function WorkshopCertificates() {
  const token = useSelector(s => s.auth?.token || '');
  const [certificates, setCertificates] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [fWorkshop, setFWorkshop] = useState('all');
  const [fStatus, setFStatus] = useState('all');
  const [busyId, setBusyId] = useState('');
  const [generatingAll, setGeneratingAll] = useState(false);
  const [assignModal, setAssignModal] = useState({ open: false, cert: null, trainers: [], selectedTrainerId: '' });

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [wsRes, certRes] = await Promise.all([
        axios.get(`${API}/api/workshops/admin/all`, { headers }),
        axios.get(`${API}/api/admin/workshops/certificates?limit=200`, { headers }),
      ]);
      setWorkshops(wsRes.data?.data?.workshops || wsRes.data?.workshops || []);
      setCertificates(certRes.data?.certificates || []);
    } catch (err) {
      console.error('Failed to load certificates:', err);
      setError(err.response?.data?.message || 'Failed to load certificate data.');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (token) loadData();
  }, [token, loadData]);

  const issued   = certificates.filter(c => c.status === 'Issued').length;
  const eligible = certificates.filter(c => c.status === 'Eligible').length;
  const pending  = certificates.filter(c => c.status === 'Pending').length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return certificates.filter(c => {
      const name = (c.studentId?.name || '').toLowerCase();
      const email = (c.studentId?.email || '').toLowerCase();
      const certNo = (c.certificateNo || '').toLowerCase();
      const wsName = (c.workshopId?.title || '').toLowerCase();
      const wId = String(c.workshopId?._id || c.workshopId || '');
      const matchQ = !q || name.includes(q) || email.includes(q) || certNo.includes(q) || wsName.includes(q);
      const matchW = fWorkshop === 'all' || wId === fWorkshop;
      const matchS = fStatus === 'all' || c.status === fStatus;
      return matchQ && matchW && matchS;
    });
  }, [certificates, search, fWorkshop, fStatus]);

  const issueAndPrint = async (cert, { skipIssue = false } = {}) => {
    const certId = cert._id;
    setBusyId(certId);
    try {
      let record = cert;
      if (!skipIssue && cert.status !== 'Issued') {
        const { data } = await axios.post(`${API}/api/admin/workshops/certificates/${certId}/issue`, {}, { headers });
        record = data.certificate;
        setCertificates(prev => prev.map(c => (String(c._id) === String(certId) ? { ...c, ...record } : c)));
      }

      openCertificatePrint({
        traineeName: record.studentId?.name || 'Trainee',
        courseName: record.workshopId?.title || 'Workshop',
        score: record.score ?? record.attendance?.attendancePct ?? 0,
        completionDate: record.issuedDate || new Date().toISOString(),
        certificateNo: record.certificateNo || '',
      });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to generate certificate.');
    } finally {
      setBusyId('');
    }
  };

  const openAssignTrainer = async (cert) => {
    try {
      const { data } = await axios.get(`${API}/api/workshops/trainer-list`, { headers });
      setAssignModal({ open: true, cert, trainers: data.data || [], selectedTrainerId: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load trainers');
    }
  };

  const handleAssignTrainer = async () => {
    const { cert, selectedTrainerId } = assignModal;
    if (!selectedTrainerId || !cert) return;
    setBusyId(cert._id);
    try {
      const { data } = await axios.post(
        `${API}/api/admin/workshops/certificates/${cert._id}/assign-trainer`,
        { trainerId: selectedTrainerId },
        { headers }
      );
      toast.success('Certificate assigned to trainer');
      setCertificates(prev => prev.map(c => (String(c._id) === String(cert._id) ? { ...c, ...data.certificate } : c)));
      setAssignModal({ open: false, cert: null, trainers: [], selectedTrainerId: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign trainer');
    } finally {
      setBusyId('');
    }
  };

  const handleGenerateAll = async () => {
    const toIssue = certificates.filter(c => c.status === 'Eligible');
    if (!toIssue.length) {
      alert('No eligible certificates to generate.');
      return;
    }
    if (!window.confirm(`Generate certificates for ${toIssue.length} eligible student(s)?`)) return;

    setGeneratingAll(true);
    try {
      for (const cert of toIssue) {
        await issueAndPrint(cert);
        await new Promise(r => setTimeout(r, 600));
      }
      await loadData();
    } finally {
      setGeneratingAll(false);
    }
  };

  const ActionBtn = ({ icon, title, color, onClick, disabled }) => (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 28, height: 28, borderRadius: 7, border: '1px solid #E2E8F0',
        background: '#F8FAFC', color: color || '#475569',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <i className={`ti ti-${icon}`} style={{ fontSize: 12 }} />
    </button>
  );

  if (loading) {
    return (
      <div style={S.page}>
        <div style={{ textAlign: 'center', padding: 60, color: '#64748B' }}>Loading certificates…</div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>Certificates</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>Generate, issue, and manage workshop completion certificates.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" style={S.btnGhost} onClick={loadData}>
            <i className="ti ti-refresh" style={{ fontSize: 13 }} /> Refresh
          </button>
          <button
            type="button"
            style={{ ...S.btnPri, opacity: generatingAll ? 0.6 : 1 }}
            onClick={handleGenerateAll}
            disabled={generatingAll || eligible === 0}
          >
            <i className="ti ti-certificate" style={{ fontSize: 13 }} />
            {generatingAll ? 'Generating…' : 'Generate All Eligible'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#B91C1C', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <KPICard title="Issued" value={issued} icon="certificate" accent="#10B981" sub="Certificates generated" />
        <KPICard title="Eligible" value={eligible} icon="circle-check" accent="#3B82F6" sub="Ready to issue" />
        <KPICard title="Pending" value={pending} icon="clock" accent="#F59E0B" sub="Not yet eligible" />
      </div>

      <div style={{ ...S.card, padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <i className="ti ti-info-circle" style={{ fontSize: 18, color: '#3B82F6', flexShrink: 0 }} />
        <div style={{ fontSize: 13, color: '#475569' }}>
          <strong>Certificate includes:</strong> student name, workshop/course title, and attendance score (%). Eligible students (≥ 60% attendance) can be issued from here.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div style={{ position: 'relative' }}>
          <AppIcon name="search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input style={{ ...S.input, paddingLeft: 32 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student, email or certificate ID…" />
        </div>
        <select style={S.input} value={fWorkshop} onChange={e => setFWorkshop(e.target.value)}>
          <option value="all">Workshop: All</option>
          {workshops.map(w => (
            <option key={w._id} value={w._id}>{w.title || w.name}</option>
          ))}
        </select>
        <select style={S.input} value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="all">Status: All</option>
          <option value="Issued">Issued</option>
          <option value="Eligible">Eligible</option>
          <option value="Pending">Pending</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      <div style={{ ...S.card, overflow: 'hidden' }}>
        <div style={S.panelHd}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Certificate Records</span>
          <span style={S.pill}>{filtered.length} records</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
            <thead>
              <tr>{['Student', 'Workshop / Course', 'Certificate ID', 'Score', 'Status', 'Issued Date', 'Actions'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', padding: 40, color: '#94A3B8' }}>No certificate records found.</td></tr>
              ) : filtered.map((c, i) => {
                const pct = c.score ?? c.attendance?.attendancePct ?? 0;
                const cfg = STATUS_CFG[c.status] || STATUS_CFG.Pending;
                const canGenerate = c.status === 'Eligible' || c.status === 'Issued';
                const isBusy = busyId === c._id;

                return (
                  <tr key={c._id} style={{ background: i % 2 ? '#FAFAFA' : '#fff' }}>
                    <td style={S.td}>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{c.studentId?.name || '—'}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>{c.studentId?.email || ''}</div>
                    </td>
                    <td style={S.td}>{c.workshopId?.title || '—'}</td>
                    <td style={S.td}>
                      {c.certificateNo
                        ? <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#F1F5F9', padding: '2px 8px', borderRadius: 6, color: '#334155' }}>{c.certificateNo}</span>
                        : <span style={{ color: '#94A3B8' }}>—</span>}
                    </td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 50, height: 5, background: '#F1F5F9', borderRadius: 3 }}>
                          <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: pct >= 60 ? '#10B981' : '#F59E0B', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{pct}%</span>
                      </div>
                    </td>
                    <td style={S.td}>
                      <span style={{ background: cfg.bg, color: cfg.color, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{cfg.label}</span>
                    </td>
                    <td style={S.td}>{c.issuedDate ? fmtDateTime(c.issuedDate) : '—'}</td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <ActionBtn
                          icon="download"
                          title={c.status === 'Issued' ? 'Download certificate' : 'Generate & download'}
                          color="#3B82F6"
                          disabled={!canGenerate || isBusy}
                          onClick={() => issueAndPrint(c, { skipIssue: c.status === 'Issued' })}
                        />
                        {c.status === 'Issued' && (
                          <ActionBtn
                            icon="refresh"
                            title="Regenerate certificate"
                            color="#F59E0B"
                            disabled={isBusy}
                            onClick={() => issueAndPrint(c, { skipIssue: true })}
                          />
                        )}
                        {c.status === 'Issued' && c.deliveryStatus === 'generated' && (
                          <ActionBtn
                            icon="send"
                            title="Send to Trainer"
                            color="#7C3AED"
                            disabled={isBusy}
                            onClick={() => openAssignTrainer(c)}
                          />
                        )}
                        {c.status === 'Issued' && c.deliveryStatus === 'assigned_to_trainer' && (
                          <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 11, color: '#3B82F6', background: '#DBEAFE', borderRadius: 4 }}>
                            <i className="ti ti-user-check" style={{ marginRight: 4 }} /> Assigned
                          </span>
                        )}
                        {c.status === 'Issued' && (c.deliveryStatus === 'sent_to_trainee' || c.deliveryStatus === 'delivered') && (
                          <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 11, color: '#10B981', background: '#D1FAE5', borderRadius: 4 }}>
                            <i className="ti ti-mail" style={{ marginRight: 4 }} /> Sent
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
</tbody>
            </table>
          </div>
          <div style={{ padding: '12px 16px', borderTop: '1px solid #F1F5F9', fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>
            Showing {filtered.length} of {certificates.length} records
          </div>
        </div>

        {/* Assign Trainer Modal */}
        {assignModal.open && assignModal.cert && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={() => setAssignModal({ ...assignModal, open: false })}>
            <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(15,23,42,0.3)' }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0F172A' }}>Send Certificate to Trainer</h3>
                  <div style={{ marginTop: 4, fontSize: 12.5, color: '#64748B', fontWeight: 700 }}>{assignModal.cert.studentId?.name} — {assignModal.cert.workshopId?.title}</div>
                </div>
                <button onClick={() => setAssignModal({ ...assignModal, open: false })} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748B' }}>×</button>
              </div>
              <div style={{ padding: 20 }}>
                {assignModal.trainers.length === 0 ? (
                  <div style={{ color: '#94A3B8', padding: 12 }}>No trainers available.</div>
                ) : (
                  <select style={S.input} value={assignModal.selectedTrainerId} onChange={e => setAssignModal({ ...assignModal, selectedTrainerId: e.target.value })}>
                    <option value="">-- Select a trainer --</option>
                    {assignModal.trainers.map(t => <option key={t._id} value={t._id}>{t.name} ({t.email})</option>)}
                  </select>
                )}
              </div>
              <div style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button style={S.btnGhost} onClick={() => setAssignModal({ ...assignModal, open: false })}>Cancel</button>
                <button style={{ ...S.btnPri, opacity: (!assignModal.selectedTrainerId || busyId === assignModal.cert._id) ? 0.6 : 1 }} disabled={!assignModal.selectedTrainerId || busyId === assignModal.cert._id} onClick={handleAssignTrainer}>
                  {busyId === assignModal.cert._id ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        )}

    </div>
  );
}
