// Trainee LMS certificates — visible only after Trainer sends.
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { API_BASE_URL } from '../../config/api';
import { openLmsCertificatePrint } from '../../components/certificate/CourseCertificateTemplate';
import AppIcon from '../../components/shared/AppIcon';

const API = API_BASE_URL;

export default function TraineeLmsCertificates() {
  const token = useSelector((s) => s.auth?.token || '');
  const traineeName = useSelector((s) => s.auth?.user?.name || s.auth?.user?.fullName || '');
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API}/api/lms-certificates/my`, { headers: { Authorization: `Bearer ${token}` } });
        setCerts(data.certificates || []);
      } catch (_) {
        setCerts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  return (
    <div style={{ padding: '20px 28px', fontFamily: 'Public Sans, system-ui, sans-serif', background: '#F1F5F9', minHeight: '100vh' }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>My LMS Certificates</h2>
      <p style={{ margin: '4px 0 20px', fontSize: 13, color: '#64748B' }}>Available after your trainer sends your completed-course certificate.</p>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 20 }}>
        {loading ? <p style={{ color: '#94A3B8' }}>Loading…</p> : certs.length === 0 ? (
          <p style={{ color: '#94A3B8', fontSize: 13 }}>No certificates yet. Complete your full course to become eligible.</p>
        ) : certs.map((c) => (
          <div key={c._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F1F5F9', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: '#0F172A' }}>{c.courseId?.name || 'Course'}</p>
              <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>{c.certificateNo || ''}</p>
            </div>
            <button onClick={() => openLmsCertificatePrint({ traineeName: traineeName || 'Trainee', courseName: c.courseId?.name || '', completionDate: c.issuedDate, certificateNo: c.certificateNo })} style={{ background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
              <AppIcon name="download" size={13} /> View / Download
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
