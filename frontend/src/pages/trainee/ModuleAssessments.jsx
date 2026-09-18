// part 1: shell + course picker + assessment list
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';
const authH = () => {
  const t = localStorage.getItem('token') || '';
  return t ? { Authorization: `Bearer ${t}` } : {};
};
export default function TraineeModuleAssessments() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [items, setItems] = useState([]);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [answers, setAnswers] = useState({});
  const [prac, setPrac] = useState({});
  const [files, setFiles] = useState({});
  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/subscriptions/my`, { headers: authH() })
      .then(({ data }) => {
        const c = data?.courses || [];
        setCourses(Array.isArray(c) ? c : []);
        if (c[0]?._id) setCourseId(String(c[0]._id));
      }).catch(() => {});
  }, []);
  const load = async (cid) => {
    if (!cid) return;
    setErr('');
    try {
      const res = await axios.get(`${API_BASE_URL}/api/lms-assessments/my`, { headers: authH(), params: { courseId: cid } });
      setItems(res.data.assessments || []);
      setDone(Boolean(res.data.courseCompleted));
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to load assessments');
    }
  };
  useEffect(() => { load(courseId); }, [courseId]);

  const answerTheory = async (aid, qid) => {
    setErr('');
    setOk('');
    const k = `${aid}:${qid}`;
    if (answers[k] == null || answers[k] === '') {
      setErr('Select an answer first.');
      return;
    }
    try {
      const res = await axios.post(`${API_BASE_URL}/api/lms-assessments/${aid}/theory`, { questionId: qid, selected: Number(answers[k]) }, { headers: authH() });
      setOk(res.data?.correct ? `Correct (+${res.data?.score ?? 0}).` : 'Recorded (incorrect).');
      await load(courseId);
    } catch (e) {
      setErr(e.response?.data?.message || 'Theory submit failed');
    }
  };

  const submitPractical = async (aid, qid) => {
    setErr('');
    setOk('');
    try {
      const fd = new FormData();
      fd.append('questionId', String(qid));
      if (prac[`${aid}:${qid}`]) fd.append('answer', prac[`${aid}:${qid}`]);
      if (files[`${aid}:${qid}`]) fd.append('file', files[`${aid}:${qid}`]);
      await axios.post(`${API_BASE_URL}/api/lms-assessments/${aid}/practical`, fd, { headers: authH() });
      setOk('Practical submitted for review.');
      await load(courseId);
    } catch (e) {
      setErr(e.response?.data?.message || 'Practical submit failed');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 4 }}>Module Assessments</h1>
      <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: 18 }}>Answer each theory MCQ and submit each practical of your enrolled course, in order.</p>
      {err ? <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '8px 12px', fontSize: '0.82rem', marginBottom: 12 }}>{err}</div> : null}
      {ok ? <div style={{ background: '#ecfdf5', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: 8, padding: '8px 12px', fontSize: '0.82rem', marginBottom: 12 }}>{ok}</div> : null}
      <select value={courseId} onChange={(e) => setCourseId(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', marginBottom: 14 }}>
        {courses.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
      </select>
      {done ? <div style={{ background: '#ecfdf5', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: 8, padding: '8px 12px', fontSize: '0.82rem', marginBottom: 12 }}>Course completed — final assignment visible below when assigned.</div> : null}
      {items.length === 0 ? <p style={{ color: '#6b7280' }}>No assessments for this course yet.</p> : items.map((a) => (
        <div key={a._id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18, marginBottom: 16 }}>
          <div style={{ fontWeight: 800 }}>{a.scope === 'final' ? 'Final Course Assignment' : (a.moduleName || a.moduleKey)}</div>
          <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: 10 }}>
            Status: {a.myStatus} · Theory {a.theoryScore ?? 0}/{a.maxTheory ?? 0} · Practical {a.practicalScore ?? 0}/{a.maxPractical ?? 0} · Total {a.moduleTotal ?? 0}/{a.maxTotal ?? 0}
          </div>
          {(a.questions || []).filter((q) => q.type !== 'practical').map((q, qi) => {
            const k = `${a._id}:${q._id}`;
            return (
              <div key={String(q._id)} style={{ borderTop: '1px solid #f1f5f9', padding: '10px 0' }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Q{qi + 1} · Theory ({q.score ?? 0} marks){q.selected != null ? (q.correct ? ' · Correct' : ' · Incorrect') : ''}</div>
                <div style={{ marginBottom: 8 }}>{q.question}</div>
                {(q.options || []).map((o, i) => (
                  <label key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.85rem', padding: '4px 0' }}>
                    <input type="radio" name={`t${a._id}${q._id}`} checked={Number(answers[k]) === i} onChange={() => setAnswers({ ...answers, [k]: i })} />
                    <span>{o}</span>
                  </label>
                ))}
                <button onClick={() => answerTheory(a._id, q._id)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#1e293b', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', marginTop: 8 }}>Submit Answer</button>
              </div>
            );
          })}
          {(a.questions || []).filter((q) => q.type === 'practical').map((q, qi) => {
            const k = `${a._id}:${q._id}`;
            return (
              <div key={String(q._id)} style={{ borderTop: '1px solid #f1f5f9', padding: '10px 0' }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>P{qi + 1} · Practical ({q.score ?? 0} marks){q.myStatus && q.myStatus !== 'PENDING' ? ` · ${q.myStatus}` : ''}</div>
                <div style={{ fontSize: '0.85rem', marginBottom: 6 }}>{q.task}</div>
                {q.instructions ? <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 8 }}>{q.instructions}</div> : null}
                <input value={prac[k] || ''} onChange={(e) => setPrac({ ...prac, [k]: e.target.value })} placeholder="Type answer (optional if file attached)" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', marginBottom: 8 }} />
                <input type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.zip" onChange={(e) => setFiles({ ...files, [k]: e.target.files?.[0] || null })} style={{ fontSize: '0.8rem', marginBottom: 8 }} />
                <div>
                  <button onClick={() => submitPractical(a._id, q._id)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>Submit Practical</button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
