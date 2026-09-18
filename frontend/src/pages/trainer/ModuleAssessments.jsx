// part 1
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';
const authH = () => {
  const t = localStorage.getItem('token') || '';
  return t ? { Authorization: `Bearer ${t}` } : {};
};
const stPill = (s) => {
  const m = { NOT_ASSIGNED: ['#475569', '#f1f5f9'], PENDING: ['#92400e', '#fef3c7'], SUBMITTED: ['#1d4ed8', '#dbeafe'], COMPLETED: ['#15803d', '#dcfce7'] };
  const v = m[s] || m.PENDING;
  return { background: v[1], color: v[0], padding: '2px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700 };
};
export default function TrainerModuleAssessments() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [modules, setModules] = useState([]);
  const [moduleKey, setModuleKey] = useState('');
  const [scope, setScope] = useState('module');
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [sel, setSel] = useState(null);
  const [subs, setSubs] = useState([]);
  const [scores, setScores] = useState({});
  // Multiple questions in trainer creation order. Each: { type:'mcq'|'practical', ... }
  const blankMcq = () => ({ type: 'mcq', question: '', o0: '', o1: '', o2: '', o3: '', correctAnswer: 1, score: 2 });
  const blankPractical = () => ({ type: 'practical', task: '', instructions: '', score: 5 });
  const [questions, setQuestions] = useState([blankMcq()]);
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
    axios.get(`${API_BASE_URL}/api/lms-assessments/trainer/courses/${courseId}/modules`, { headers: authH() })
      .then(({ data }) => {
        setModules(data.modules || []);
        if ((data.modules || [])[0]) setModuleKey(data.modules[0].key);
      }).catch(() => setModules([]));
    axios.get(`${API_BASE_URL}/api/lms-assessments/trainer`, { headers: authH(), params: { courseId } })
      .then(({ data }) => setList(data.assessments || [])).catch(() => setList([]));
  }, [courseId]);

  const save = async () => {
    setMsg('');
    setErr('');
    try {
      const payload = questions.map((q) => (q.type === 'practical'
        ? { type: 'practical', task: q.task, instructions: q.instructions, score: Number(q.score) }
        : {
            type: 'mcq', question: q.question, options: [q.o0, q.o1, q.o2, q.o3],
            correctAnswer: Number(q.correctAnswer), score: Number(q.score),
          }));
      const res = await axios.post(`${API_BASE_URL}/api/lms-assessments`, {
        courseId,
        moduleKey: scope === 'final' ? 'FINAL' : moduleKey,
        moduleName: (modules.find((m) => m.key === moduleKey) || {}).name || '',
        scope,
        questions: payload,
      }, { headers: authH() });
      setMsg(`Assessment saved (${(res.data.assessment?.questions || []).length} questions).`);
      setList((p) => [res.data.assessment, ...p.filter((a) => String(a._id) !== String(res.data.assessment._id))]);
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to save assessment');
    }
  };

  const setQ = (i, patch) => setQuestions((p) => p.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const addQ = (type) => setQuestions((p) => [...p, type === 'practical' ? blankPractical() : blankMcq()]);
  const delQ = (i) => setQuestions((p) => p.filter((_, j) => j !== i));

  const openSubs = async (a) => {
    setSel(a._id);
    setErr('');
    try {
      const res = await axios.get(`${API_BASE_URL}/api/lms-assessments/${a._id}/submissions`, { headers: authH() });
      setSubs(res.data.assessment?.submissions || []);
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to load submissions');
    }
  };

  const review = async (qid, traineeId, complete) => {
    setErr('');
    try {
      await axios.put(`${API_BASE_URL}/api/lms-assessments/${sel}/review`, {
        questionId: qid,
        traineeId,
        practicalScore: scores[`${traineeId}:${qid}`] !== undefined && scores[`${traineeId}:${qid}`] !== '' ? Number(scores[`${traineeId}:${qid}`]) : undefined,
        complete: Boolean(complete),
      }, { headers: authH() });
      const a = list.find((x) => String(x._id) === String(sel)) || { _id: sel };
      await openSubs(a);
    } catch (e) {
      setErr(e.response?.data?.message || 'Review failed');
    }
  };

  const inp = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', marginBottom: 8 };
  const btnP = { padding: '9px 18px', borderRadius: 9, border: 'none', background: '#15803d', color: '#fff', fontWeight: 700, cursor: 'pointer' };
  const btnG = { padding: '6px 12px', borderRadius: 8, border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 4 }}>Module Assessments</h1>
      <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: 18 }}>Add any number of MCQ + practical questions per module, in order. Final unlocks for trainees after full course completion.</p>
      {err ? <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '8px 12px', fontSize: '0.82rem', marginBottom: 12 }}>{err}</div> : null}
      {msg ? <div style={{ background: '#ecfdf5', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: 8, padding: '8px 12px', fontSize: '0.82rem', marginBottom: 12 }}>{msg}</div> : null}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}>
          {courses.map((c) => <option key={c._id} value={c._id}>{c.name} ({c.code})</option>)}
        </select>
        <select value={scope} onChange={(e) => setScope(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}>
          <option value="module">Module assessment</option>
          <option value="final">Final course assignment</option>
        </select>
        {scope === 'module' ? (
          <select value={moduleKey} onChange={(e) => setModuleKey(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}>
            {modules.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}
          </select>
        ) : null}
      </div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 800 }}>Questions ({questions.length})</div>
          <button onClick={() => addQ('mcq')} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>+ Add MCQ</button>
          <button onClick={() => addQ('practical')} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#15803d', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>+ Add Practical</button>
        </div>
        {questions.map((q, i) => (
          <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <strong>Q{i + 1}</strong>
              <select value={q.type} onChange={(e) => setQ(i, e.target.value === 'practical' ? { ...blankPractical(), type: 'practical' } : { ...blankMcq(), type: 'mcq' })} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db' }}>
                <option value="mcq">Multiple Choice</option>
                <option value="practical">Practical</option>
              </select>
              <label style={{ fontSize: '0.78rem', color: '#6b7280' }}>Marks <input type="number" min="1" value={q.score} onChange={(e) => setQ(i, { score: e.target.value })} style={{ width: 70, padding: '6px 8px', borderRadius: 8, border: '1px solid #d1d5db' }} /></label>
              <button onClick={() => delQ(i)} disabled={questions.length <= 1} style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', fontWeight: 700, fontSize: '0.78rem', cursor: questions.length <= 1 ? 'not-allowed' : 'pointer', opacity: questions.length <= 1 ? 0.5 : 1 }}>Delete</button>
            </div>
            {q.type === 'practical' ? (
              <div>
                <input value={q.task} onChange={(e) => setQ(i, { task: e.target.value })} placeholder="Practical task/question" style={inp} />
                <input value={q.instructions} onChange={(e) => setQ(i, { instructions: e.target.value })} placeholder="Instructions (optional)" style={inp} />
              </div>
            ) : (
              <div>
                <input value={q.question} onChange={(e) => setQ(i, { question: e.target.value })} placeholder="MCQ question" style={inp} />
                {['o0', 'o1', 'o2', 'o3'].map((k, oi) => (
                  <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <input type="radio" name={`correct-${i}`} checked={Number(q.correctAnswer) === oi} onChange={() => setQ(i, { correctAnswer: oi })} title="Correct answer" />
                    <input value={q[k]} onChange={(e) => setQ(i, { [k]: e.target.value })} placeholder={'Option ' + 'ABCD'[oi]} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db' }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <div style={{ marginTop: 4 }}>
          <button onClick={save} style={btnP}>Save Assessment ({questions.length} questions)</button>
        </div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Assessments and submissions</div>
        {list.length === 0 ? <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>No assessments yet.</p> : list.map((a) => (
          <div key={a._id} style={{ borderTop: '1px solid #f1f5f9', padding: '10px 0' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>{a.scope === 'final' ? 'Final' : (a.moduleName || a.moduleKey)}</strong>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{a.courseId?.name || ''}</span>
              <button onClick={() => openSubs(a)} style={btnG}>View submissions</button>
            </div>
            {String(sel) === String(a._id) ? (
              <div style={{ marginTop: 10 }}>
                {(subs || []).length === 0 ? <p style={{ color: '#6b7280', fontSize: '0.82rem' }}>No submissions yet.</p> : subs.map((s, i) => {
                  const tid = String(s.trainee?._id || s.trainee);
                  const byQ = {};
                  (s.answers || []).forEach((x) => { byQ[String(x.questionId)] = x; });
                  const qs = a.questions?.length ? a.questions : [];
                  return (
                    <div key={tid || i} style={{ padding: '8px 0', borderTop: '1px solid #f8fafc', fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                        <span style={{ fontWeight: 700 }}>{s.trainee?.name || 'Trainee'}</span>
                        <span style={stPill(s.status)}>{s.status}</span>
                        <span>Theory {s.theoryScore ?? 0}</span>
                        <span>Practical {s.practicalScore ?? 0}</span>
                        <span>Total {s.moduleTotal ?? 0}</span>
                        <button onClick={() => review(null, tid, true)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#15803d', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Mark Completed</button>
                      </div>
                      {qs.filter((q) => q.type === 'practical').map((q, qi) => {
                        const x = byQ[String(q._id)] || {};
                        const has = x.practicalAnswer || x.practicalFileUrl;
                        const k = `${tid}:${String(q._id)}`;
                        return (
                          <div key={String(q._id)} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '6px 0 6px 12px', borderTop: '1px dashed #e5e7eb' }}>
                            <span style={{ fontWeight: 700 }}>P{qi + 1}</span>
                            <span style={{ color: has ? '#111827' : '#9ca3af' }}>{has ? (x.practicalReviewed ? `Reviewed ${x.practicalScore ?? 0}/${q.score}` : 'Submitted — pending review') : 'Not submitted'}</span>
                            {x.practicalFileUrl ? <a href={`${API_BASE_URL}${x.practicalFileUrl}`} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', fontWeight: 700 }}>Download</a> : null}
                            <input type="number" placeholder={`Score /${q.score}`} value={scores[k] ?? ''} onChange={(e) => setScores({ ...scores, [k]: e.target.value })} style={{ width: 110, padding: '6px 8px', borderRadius: 8, border: '1px solid #d1d5db' }} />
                            <button onClick={() => review(String(q._id), tid, false)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>Save score</button>
                          </div>
                        );
                      })}
                      {qs.filter((q) => q.type !== 'practical').map((q, qi) => {
                        const x = byQ[String(q._id)] || {};
                        return (
                          <div key={String(q._id)} style={{ padding: '4px 0 4px 12px', color: '#374151' }}>
                            Q{qi + 1} → {x.selected == null ? 'Not answered' : (x.correct ? `Correct ${x.score ?? 0}/${q.score}` : `Wrong 0/${q.score}`)}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
