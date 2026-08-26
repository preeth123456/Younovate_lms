import React from 'react';
import { fmtDateLong } from '../../utils/dateTime';

/**
 * Reusable course certificate layout with dynamic placeholders.
 * traineeName, courseName, completionDate are supplied from API/enrollment data.
 */
export default function CourseCertificateTemplate({
  traineeName = '',
  courseName = '',
  completionDate = null,
}) {
  const dateLabel = completionDate
    ? fmtDateLong(completionDate)
    : fmtDateLong(new Date().toISOString());

  return (
    <div
      className="course-certificate-template"
      style={{
        background: '#fff',
        border: '3px solid #4F46E5',
        borderRadius: 16,
        padding: '40px 36px',
        maxWidth: 720,
        margin: '0 auto',
        textAlign: 'center',
        fontFamily: "'Inter', 'Public Sans', system-ui, sans-serif",
        color: '#0F172A',
        boxShadow: '0 8px 30px rgba(15,23,42,.08)',
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#6366F1', fontWeight: 700, marginBottom: 8 }}>
        Younovate LMS
      </div>
      <h1 style={{ margin: '0 0 24px', fontSize: 28, fontWeight: 800, color: '#1E1B4B' }}>
        Certificate of Completion
      </h1>
      <p style={{ margin: '0 0 12px', fontSize: 15, color: '#64748B' }}>
        This certificate is proudly presented to
      </p>
      <p
        style={{
          margin: '0 0 20px',
          fontSize: 26,
          fontWeight: 800,
          color: '#4F46E5',
          lineHeight: 1.3,
        }}
      >
        {traineeName || 'Trainee'}
      </p>
      <p style={{ margin: '0 0 12px', fontSize: 15, color: '#64748B' }}>
        for successfully completing
      </p>
      <p
        style={{
          margin: '0 0 28px',
          fontSize: 22,
          fontWeight: 700,
          color: '#0F172A',
          lineHeight: 1.35,
        }}
      >
        {courseName || 'Course'}
      </p>
      <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 20 }}>
        <p style={{ margin: 0, fontSize: 14, color: '#64748B' }}>
          Date: <strong style={{ color: '#0F172A' }}>{dateLabel}</strong>
        </p>
      </div>
    </div>
  );
}
