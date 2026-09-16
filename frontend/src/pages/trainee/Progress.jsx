import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';

const API = API_BASE_URL;

const card = {
  background: '#fff',
  border: '1px solid #E2E8F0',
  borderRadius: 16,
  padding: '20px 24px',
  boxShadow: '0 1px 3px rgba(15,23,42,.05)',
};

function ProgressBar({ value, color = '#4F46E5' }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div style={{ background: '#E2E8F0', borderRadius: 999, height: 8, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999, transition: 'width .3s' }} />
    </div>
  );
}

function StatCard({ label, value, sub, color = '#4F46E5' }) {
  return (
    <div style={{ ...card, borderTop: `4px solid ${color}` }}>
      <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color }}>{value}</p>
      <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{label}</p>
      {sub && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748B' }}>{sub}</p>}
    </div>
  );
}

export default function TraineeProgress() {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const { data } = await axios.get(`${API}/api/trainee/progress`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProgress(data.progress || null);
    } catch (err) {
      const status = err.response?.status;
      if (status === 401) {
        setError('Your session has expired. Please log in again.');
      } else {
        setError(err.response?.data?.message || 'Failed to load progress.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div style={{ padding: '20px 28px', fontFamily: 'Public Sans, system-ui, sans-serif', background: '#F1F5F9', minHeight: '100vh' }}>
        <p style={{ color: '#64748B' }}>Loading your progress…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px 28px', fontFamily: 'Public Sans, system-ui, sans-serif', background: '#F1F5F9', minHeight: '100vh' }}>
        <div style={{ ...card, background: '#FEF2F2', borderColor: '#FECACA', color: '#B91C1C' }}>
          {error}
          <button onClick={load} style={{ display: 'block', marginTop: 12, padding: '8px 14px', borderRadius: 8, border: '1px solid #FECACA', background: '#fff', cursor: 'pointer', fontWeight: 700 }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const o = progress?.overall || {};
  const hasData = (o.coursesEnrolled || 0) > 0
    || (o.sessionsTotal || 0) > 0
    || (o.assignmentsTotal || 0) > 0
    || (o.lessonsTotal || 0) > 0
    || (progress?.attendance?.lms?.total || 0) > 0
    || (progress?.attendance?.workshop?.total || 0) > 0;

  const courseProgressLabel = o.coursesEnrolled > 0 ? `${o.percent ?? 0}%` : '—';
  const courseProgressSub = o.coursesEnrolled > 0 ? `${o.coursesEnrolled} course(s)` : 'No active courses';
  const courseProgressColor = o.coursesEnrolled > 0 ? '#4F46E5' : '#94A3B8';

  return (
    <div style={{ padding: '20px 28px', fontFamily: 'Public Sans, system-ui, sans-serif', background: '#F1F5F9', minHeight: '100vh' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>My Progress</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>Your complete learning progress across courses, sessions, and assignments.</p>
      </div>

      {!hasData ? (
        <div style={{ ...card, textAlign: 'center', padding: 40 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0F172A' }}>No progress data available yet.</p>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#64748B' }}>Start a course or attend a session to see your progress here.</p>
        </div>
      ) : (
        <>
          <div style={{ ...card, marginBottom: 20 }}>
            <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#64748B' }}>Overall Completion</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: hasData ? '#4F46E5' : '#94A3B8' }}>{hasData ? (o.percent ?? 0) : '—'}{hasData ? '%' : ''}</span>
              <span style={{ fontSize: 13, color: '#64748B' }}>{hasData ? 'across your active learning activities' : 'No learning activity recorded yet'}</span>
            </div>
            <ProgressBar value={hasData ? o.percent : 0} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
            <StatCard label="Course Progress" value={courseProgressLabel} sub={courseProgressSub} color={courseProgressColor} />
            <StatCard label="Sessions" value={`${o.sessionsCompleted ?? 0}/${o.sessionsTotal ?? 0}`} sub={o.sessionsTotal > 0 ? `${progress?.sessions?.percent ?? 0}% completed` : 'No sessions'} color="#059669" />
            <StatCard label="Assignments" value={`${o.assignmentsSubmitted ?? 0}/${o.assignmentsTotal ?? 0}`} sub={o.assignmentsTotal > 0 ? `${progress?.assignments?.pending ?? 0} pending` : 'No assignments'} color="#D97706" />
            <StatCard label="LMS Attendance" value={progress?.attendance?.lms?.total > 0 ? `${progress?.attendance?.lms?.percent ?? 0}%` : '—'} sub={progress?.attendance?.lms?.total > 0 ? `${progress?.attendance?.lms?.present ?? 0} present` : 'No LMS attendance'} color="#0EA5E9" />
            <StatCard label="Workshop Attendance" value={progress?.attendance?.workshop?.total > 0 ? `${progress?.attendance?.workshop?.percent ?? 0}%` : '—'} sub={progress?.attendance?.workshop?.total > 0 ? `${progress?.attendance?.workshop?.present ?? 0} present` : 'No workshop attendance'} color="#7C3AED" />
            <StatCard label="Lessons" value={o.lessonsTotal > 0 ? `${o.lessonsCompleted ?? 0}/${o.lessonsTotal ?? 0}` : '—'} sub={o.lessonsTotal > 0 ? 'completed' : 'No lessons'} color="#DC2626" />
          </div>

          {progress?.courses?.length > 0 && (
            <div style={{ ...card, marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#0F172A' }}>Course Progress</h3>
              <div style={{ display: 'grid', gap: 14 }}>
                {progress.courses.map((c) => (
                  <div key={c.courseId}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 8, flexWrap: 'wrap' }}>
                      <div>
                        <span style={{ fontWeight: 700, color: '#0F172A' }}>{c.name}</span>
                        {c.code && <span style={{ marginLeft: 8, fontSize: 12, color: '#64748B' }}>{c.code}</span>}
                        {c.batchName && <span style={{ marginLeft: 8, fontSize: 11, color: '#94A3B8' }}>({c.batchName})</span>}
                      </div>
                      <span style={{ fontWeight: 700, color: '#4F46E5' }}>{c.progressPercent}%</span>
                    </div>
                    <ProgressBar value={c.progressPercent} />
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748B' }}>
                      {c.completedLessons} lessons completed · Status: {c.status || 'active'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {progress?.sessions?.recent?.length > 0 && (
            <div style={{ ...card }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800, color: '#0F172A' }}>Completed Sessions</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', textAlign: 'left' }}>
                    <th style={{ padding: '8px 0' }}>Session</th>
                    <th style={{ padding: '8px 0' }}>Date</th>
                    <th style={{ padding: '8px 0' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {progress.sessions.recent.map((s) => (
                    <tr key={s._id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 0', fontWeight: 600, color: '#0F172A' }}>{s.title}</td>
                      <td style={{ padding: '10px 0', color: '#64748B' }}>
                        {s.scheduledAt ? new Date(s.scheduledAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ padding: '10px 0' }}>
                        <span style={{ background: '#DCFCE7', color: '#065F46', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{s.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
