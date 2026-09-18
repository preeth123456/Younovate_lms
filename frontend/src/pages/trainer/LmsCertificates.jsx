// Trainer LMS certificates — receive from Admin, send to trainee.
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { API_BASE_URL } from '../../config/api';
import { openLmsCertificatePrint } from '../../components/certificate/CourseCertificateTemplate';
import AppIcon from '../../components/shared/AppIcon';

const API = API_BASE_URL;
const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '22px 24px' };
const th = { padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', background: '#F8FAFC', textAlign: 'left' };
const td = { padding: '11px 14px', fontSize: 13, color: '#334155', borderBottom: '1px solid #F1F5F9' };

export default function TrainerLmsCertificates() {
  const token = useSelector((s) => s.auth?.token || '');
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/lms-certificates/trainer`, { headers: { Authorization: `Bearer ${token}` } });
      setCerts(data.certificates || []);
    } catch (_) {
      setCerts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (c) => {
    setBusyId(String(c._id));
    try {
      const { data } = await axios.post(`${API}/api/lms-certificates/trainer/${c._id}/send`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setCerts((prev) => prev.map((x) => (String(x._id) === String(c._id) ? { ...x, ...data.certificate } : x)));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send certificate.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '32px 24px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.55rem', fontWeight: 800, color: '#111827', marginBottom: 5 }}>LMS Certificates</h1>
        <p style={{ fontSize: '0.84rem', color: '#6b7280', marginBottom: 20 }}>Certificates issued by Admin. Send them to completed trainees.</p>
        <div style={card}>
          {loading ? <p style={{ color: '#9ca3af' }}>Loading…</p> : certs.length === 0 ? (
            <p style={{ color: '#9ca3af' }}>No LMS certificates received yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead><tr>{['Course', 'Trainee', 'Status', 'Certificate No', 'Action'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {certs.map((c) => (
                    <tr key={c._id}>
                      <td style={td}><strong>{c.courseId?.name || '—'}</strong><div style={{ fontSize: 11, color: '#94A3B8' }}>{c.courseId?.code || ''}</div></td>
                      <td style={td}><div style={{ fontWeight: 600 }}>{c.studentId?.name || '—'}</div><div style={{ fontSize: 11, color: '#94A3B8' }}>{c.studentId?.email || ''}</div></td>
                      <td style={td}>{c.sentToTrainee ? 'Sent to Trainee' : 'Received from Admin'}</td>
                      <td style={td}>{c.certificateNo || '—'}</td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => openLmsCertificatePrint({ traineeName: c.studentId?.name || '', courseName: c.courseId?.name || '', completionDate: c.issuedDate, certificateNo: c.certificateNo })} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center' }}><AppIcon name="download" size={13} /> View</button>
                          {!c.sentToTrainee && (
                            <button onClick={() => send(c)} disabled={busyId === String(c._id)} style={{ background: '#1e293b', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 700, opacity: busyId === String(c._id) ? 0.6 : 1 }}><AppIcon name="send" size={13} /> {busyId === String(c._id) ? 'Sending…' : 'Send to Trainee'}</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
