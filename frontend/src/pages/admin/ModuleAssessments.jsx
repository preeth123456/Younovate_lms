// Admin monitor (read-only) for module + final assessments.
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';
const authH = () => {
  const t = localStorage.getItem('token') || '';
  return t ? { Authorization: `Bearer ${t}` } : {};
};
export default function AdminModuleAssessments() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/courses`, { headers: authH(), params: { limit: 100 } })
      .then(({ data }) => {
        const c = data?.data?.courses || data?.courses || [];
        setCourses(Array.isArray(c) ? c : []);
        if (c[0]?._id) setCourseId(String(c[0]._id));
      }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!courseId) return;
    axios.get(`${API_BASE_URL}/api/lms-assessments/admin`, { headers: authH(), params: { courseId } })
      .then(({ data }) => setRows(data.rows || []))
      .catch((e) => setErr(e.response?.data?.message || 'Failed to load'));
  }, [courseId]);
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 4 }}>Module Assessments (Monitor)</h1>
      <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: 18 }}>View-only: course, module, trainee, trainer, theory, practical and overall status.</p>
      {err ? <div style={{ color: '#b91c1c', marginBottom: 12 }}>{err}</div> : null}
      <select value={courseId} onChange={(e) => setCourseId(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', marginBottom: 14 }}>
        {courses.map((c) => <option key={c._id} value={c._id}>{c.name} ({c.code})</option>)}
      </select>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18 }}>
        {rows.length === 0 ? <p style={{ color: '#6b7280' }}>No assessment rows yet.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead><tr style={{ textAlign: 'left', color: '#9ca3af' }}>
              <th style={{ padding: '6px 8px' }}>Course</th><th style={{ padding: '6px 8px' }}>Module</th>
              <th style={{ padding: '6px 8px' }}>Questions</th><th style={{ padding: '6px 8px' }}>Trainee</th><th style={{ padding: '6px 8px' }}>Trainer</th>
              <th style={{ padding: '6px 8px' }}>Theory</th><th style={{ padding: '6px 8px' }}>Practical</th>
              <th style={{ padding: '6px 8px' }}>Overall</th><th style={{ padding: '6px 8px' }}>Total</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 8 }}>{r.course?.name || ''}</td>
                  <td style={{ padding: 8 }}>{r.scope === 'final' ? 'Final' : (r.moduleName || r.moduleKey)}</td>
                  <td style={{ padding: 8 }}>{r.questionCount ?? '—'}{r.mcqCount != null ? ` (${r.mcqCount} MCQ + ${r.pracCount} prac)` : ''}</td>
                  <td style={{ padding: 8 }}>{r.trainee?.name || '—'}</td>
                  <td style={{ padding: 8 }}>{r.trainer?.name || ''}</td>
                  <td style={{ padding: 8 }}>{r.theory} ({r.theoryScore}/{r.maxTheory ?? '—'})</td>
                  <td style={{ padding: 8 }}>{r.practical} ({r.practicalScore}/{r.maxPractical ?? '—'})</td>
                  <td style={{ padding: 8 }}>{r.overall}</td>
                  <td style={{ padding: 8 }}>{r.moduleTotal}/{r.maxTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
