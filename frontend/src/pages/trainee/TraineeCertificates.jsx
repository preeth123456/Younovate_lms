import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { createRoot } from 'react-dom/client';
import { API_BASE_URL } from '../../config/api';
import CourseCertificateTemplate from '../../components/certificate/CourseCertificateTemplate';
import { fmtDateLong } from '../../utils/dateTime';

const API = API_BASE_URL;

const S = {
  page:    { padding: '20px 28px', fontFamily: 'Public Sans, system-ui, sans-serif', background: '#F1F5F9', minHeight: '100vh' },
  card:    { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 1px 3px rgba(15,23,42,.05),0 4px 16px rgba(30,58,95,.06)' },
  panelHd: { padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9' },
  th:      { padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#94A3B8', background: '#F8FAFC', textAlign: 'left', whiteSpace: 'nowrap' },
  td:      { padding: '11px 14px', fontSize: 13, color: '#334155', borderBottom: '1px solid #F1F5F9' },
  btnPri:  { background: '#1E3A5F', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 },
  btnGhost:{ background: '#fff', color: '#475569', border: '1px solid #E2E8F0', padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 },
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

export default function TraineeCertificates() {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const loadCertificates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const { data } = await axios.get(`${API}/api/trainee/workshop-certificates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCertificates(data.certificates || []);
    } catch (err) {
      const status = err.response?.status;
      if (status === 401) {
        setError('Your session has expired. Please log in again.');
      } else {
        setError(err.response?.data?.message || 'Failed to load certificates.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCertificates(); }, [loadCertificates]);

  const issued   = certificates.filter(c => c.status === 'Issued').length;
  const eligible = certificates.filter(c => c.status === 'Eligible').length;
  const pending  = certificates.filter(c => c.status === 'Pending').length;

  const viewAndDownload = async (cert) => {
    const certId = cert._id;
    setBusyId(certId);
    try {
      let record = cert;
      // If not yet issued, we cannot view/download - only eligible for admin to issue
      if (cert.status !== 'Issued') {
        alert('This certificate is not yet issued. It will be available after the admin generates it.');
        return;
      }
      openCertificatePrint({
        traineeName: record.studentId?.name || record.studentName || 'Trainee',
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

  if (loading) {
    return (
      <div style={S.page}>
        <div style={{ textAlign: 'center', padding: 60, color: '#64748B' }}>Loading certificates…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={S.page}>
        <div style={{ ...S.card, background: '#FEF2F2', borderColor: '#FECACA', color: '#B91C1C', textAlign: 'center', padding: 40 }}>
          {error}
          <button onClick={loadCertificates} style={{ display: 'block', marginTop: 12, padding: '8px 14px', borderRadius: 8, border: '1px solid #FECACA', background: '#fff', cursor: 'pointer', fontWeight: 700 }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>My Certificates</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>View and download your workshop completion certificates.</p>
        </div>
        <button type="button" style={S.btnGhost} onClick={loadCertificates}>
          <i className="ti ti-refresh" style={{ fontSize: 13 }} /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <KPICard title="Issued" value={issued} icon="certificate" accent="#10B981" sub="Certificates generated" />
        <KPICard title="Eligible" value={eligible} icon="circle-check" accent="#3B82F6" sub="Ready for issuance" />
        <KPICard title="Pending" value={pending} icon="clock" accent="#F59E0B" sub="Not yet eligible" />
      </div>

      {certificates.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📜</div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0F172A' }}>No certificates yet.</p>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#64748B' }}>Complete workshops with ≥ 60% attendance to become eligible for certificates.</p>
        </div>
      ) : (
        <div style={{ ...S.card, overflow: 'hidden' }}>
          <div style={S.panelHd}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>My Certificates</span>
            <span style={S.pill}>{certificates.length} certificate{certificates.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
              <thead>
                <tr>{['Workshop / Course', 'Certificate ID', 'Score', 'Status', 'Issued Date', 'Actions'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {certificates.map((c, i) => {
                  const pct = c.score ?? c.attendance?.attendancePct ?? 0;
                  const cfg = STATUS_CFG[c.status] || STATUS_CFG.Pending;
                  const isBusy = busyId === c._id;
                  const canDownload = c.status === 'Issued';

                  return (
                    <tr key={c._id} style={{ background: i % 2 ? '#FAFAFA' : '#fff' }}>
                      <td style={S.td}>
                        <div style={{ fontWeight: 700, color: '#0F172A' }}>{c.workshopId?.title || 'Workshop'}</div>
                        {c.workshopId?.date && (
                          <div style={{ fontSize: 11, color: '#94A3B8' }}>
                            {fmtDateLong(c.workshopId.date)}
                          </div>
                        )}
                      </td>
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
                      <td style={S.td}>{c.issuedDate ? fmtDateLong(c.issuedDate) : '—'}</td>
                      <td style={S.td}>
                        <button
                          title={canDownload ? 'View & Download Certificate' : 'Not available until issued'}
                          onClick={() => viewAndDownload(c)}
                          disabled={!canDownload || isBusy}
                          style={{
                            width: 28, height: 28, borderRadius: 7, border: '1px solid #E2E8F0',
                            background: canDownload ? '#F8FAFC' : '#F1F5F9', color: canDownload ? '#3B82F6' : '#CBD5E1',
                            cursor: canDownload ? 'pointer' : 'not-allowed',
                            opacity: isBusy ? 0.5 : (canDownload ? 1 : 0.5),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <i className="ti ti-download" style={{ fontSize: 12 }} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}