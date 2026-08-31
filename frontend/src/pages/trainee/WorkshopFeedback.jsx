// Trainee Feedback Page — supports BOTH LMS (Teaching) and Workshop sessions
// Shows feedback form only after session completion
// One submission only per trainee per session
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { API_BASE_URL } from '../../config/api';

const API = API_BASE_URL;

const S = {
  page: { padding: '24px 28px', fontFamily: 'Inter, system-ui, sans-serif', background: '#F8FAFC', minHeight: '100vh' },
  card: { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 1px 3px rgba(15,23,42,.05)' },
  input: { width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, fontFamily: 'inherit', color: '#0F172A', background: '#fff', outline: 'none', transition: 'border-color .15s' },
  btnPri: { background: '#1E3A5F', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
};

function StarInput({ rating, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <button key={s} type="button" onClick={() => onChange(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 28, color: s <= rating ? '#F59E0B' : '#D1D5DB', padding: 0, lineHeight: 1, transition: 'color .15s' }}>
          ★
        </button>
      ))}
    </div>
  );
}

function getWorkshopIdForSession(session, fallbackBatches) {
  if (session?.workshopBatchId?.workshopId?._id) {
    return session.workshopBatchId.workshopId._id;
  }
  if (session?.workshopBatchId && fallbackBatches?.length) {
    const batch = fallbackBatches.find(b => String(b._id) === String(session.workshopBatchId));
    if (batch?.workshopId?._id) return batch.workshopId._id;
  }
  const first = fallbackBatches?.find(b => b.workshopId?._id);
  return first?.workshopId?._id || '';
}

function buildFeedbackMap(allFeedback) {
  const map = {};
  allFeedback.forEach(f => {
    const sid = String(f.sessionId?._id || f.sessionId);
    if (sid) map[sid] = f;
  });
  return map;
}

const EMPTY_FORM = {
  overallRating: 0,
  trainerRating: 0,
  contentRating: 0,
  audioRating: 0,
  videoRating: 0,
  comment: '',
  suggestions: '',
};

export default function TraineeFeedbackPage() {
  const token = useSelector(s => s.auth?.token || '');
  const [workshops, setWorkshops] = useState([]);
  const [completedSessions, setCompletedSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [feedbackBySessionId, setFeedbackBySessionId] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        const headers = { Authorization: `Bearer ${token}` };

        let lmsSessions = [];
        let workshopSessions = [];

        try {
          const wsRes = await axios.get(`${API}/api/trainee/workshop-batches`, { headers });
          const batches = wsRes.data?.batches || [];
          setWorkshops(batches);

          const sessRes = await axios.get(`${API}/api/trainee/workshop-sessions?forFeedback=1`, { headers });
          workshopSessions = sessRes.data?.sessions || [];
        } catch (e) {
          console.warn('Workshop data load:', e.message);
        }

        try {
          const lmsRes = await axios.get(`${API}/api/trainee/sessions?forFeedback=1`, { headers });
          lmsSessions = lmsRes.data?.sessions || [];
        } catch (e) {
          console.warn('LMS data load:', e.message);
        }

        const merged = [
          ...lmsSessions.map(s => ({ ...s, feedbackType: 'lms' })),
          ...workshopSessions.map(s => ({ ...s, feedbackType: 'workshop' })),
        ].sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt));

        setCompletedSessions(merged);

        const [lmsFb, wsFb] = await Promise.all([
          axios.get(`${API}/api/trainee/lms-feedback`, { headers }).catch(() => ({ data: { feedback: [] } })),
          axios.get(`${API}/api/trainee/workshop-feedback`, { headers }).catch(() => ({ data: { feedback: [] } })),
        ]);
        const feedbackMap = buildFeedbackMap([
          ...(lmsFb.data?.feedback || []),
          ...(wsFb.data?.feedback || []),
        ]);
        setFeedbackBySessionId(feedbackMap);

        if (merged.length > 0) {
          const firstPending = merged.find(s => !feedbackMap[String(s._id)]);
          setSelectedSession(String((firstPending || merged[0])._id));
        }
      } catch (err) {
        console.error('Failed to load feedback data:', err);
        setError(err.response?.data?.message || 'Failed to load sessions. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchData();
  }, [token]);

  useEffect(() => {
    if (!selectedSession) return;
    setForm(EMPTY_FORM);
    setError('');
  }, [selectedSession]);

  const selectedSessionObj = completedSessions.find(s => String(s._id) === String(selectedSession));
  const selectedType = selectedSessionObj?.feedbackType || 'lms';
  const selectedFeedback = feedbackBySessionId[String(selectedSession)] || null;
  const isSelectedSubmitted = !!selectedFeedback;

  const handleSessionChange = (e) => {
    setSelectedSession(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.overallRating === 0) {
      setError('Please provide an overall rating');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const sessionId = selectedSession;
      const session = completedSessions.find(s => String(s._id) === String(sessionId));

      const payload = {
        sessionId,
        overallRating: form.overallRating,
        trainerRating: form.trainerRating,
        contentRating: form.contentRating,
        audioRating: form.audioRating,
        videoRating: form.videoRating,
        comment: form.comment,
        suggestions: form.suggestions,
      };

      let res;
      if (session?.feedbackType === 'workshop') {
        payload.workshopId = getWorkshopIdForSession(session, workshops);
        res = await axios.post(`${API}/api/trainee/workshop-feedback`, payload, { headers });
      } else {
        res = await axios.post(`${API}/api/trainee/lms-feedback`, payload, { headers });
      }

      const saved = res.data?.feedback || { ...form, _id: 'temp', sessionId };
      setFeedbackBySessionId(prev => ({ ...prev, [String(sessionId)]: saved }));
    } catch (err) {
      if (err.response?.status === 409) {
        setError('You have already submitted feedback for this session.');
      } else {
        setError(err.response?.data?.message || 'Failed to submit feedback. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const pendingSessions = completedSessions.filter(s => !feedbackBySessionId[String(s._id)]);

  if (loading) {
    return (
      <div style={S.page}>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 14, color: '#64748B' }}>Loading your sessions…</div>
        </div>
      </div>
    );
  }

  if (error && completedSessions.length === 0) {
    return (
      <div style={S.page}>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ color: '#0F172A', fontWeight: 700 }}>Unable to Load Sessions</h2>
          <p style={{ color: '#64748B', marginTop: 8 }}>{error}</p>
        </div>
      </div>
    );
  }

  const typeLabel = selectedType === 'workshop' ? 'Workshop' : 'LMS';

  if (completedSessions.length === 0) {
    return (
      <div style={S.page}>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
          <h2 style={{ color: '#0F172A', fontWeight: 700 }}>No Completed Sessions Yet</h2>
          <p style={{ color: '#64748B', marginTop: 8 }}>
            Feedback will be available here after you attend a session and it is completed.
          </p>
        </div>
      </div>
    );
  }

  if (isSelectedSubmitted && selectedFeedback) {
    const overallRating = selectedFeedback.overallRating || selectedFeedback.rating || 0;
    const trainerRating = selectedFeedback.trainerRating || 0;
    const contentRating = selectedFeedback.contentRating || 0;
    const audioRating = selectedFeedback.audioRating || 0;
    const videoRating = selectedFeedback.videoRating || 0;

    return (
      <div style={S.page}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          {completedSessions.length > 1 && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#64748B', marginBottom: 6 }}>Session</label>
              <select value={selectedSession} onChange={handleSessionChange} style={{ ...S.input, width: '100%' }}>
                {completedSessions.map(s => {
                  const submitted = !!feedbackBySessionId[String(s._id)];
                  return (
                    <option key={s._id} value={s._id}>
                      [{s.feedbackType === 'workshop' ? 'Workshop' : 'LMS'}] {s.title} - {new Date(s.scheduledAt).toLocaleDateString()}{submitted ? ' (submitted)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div style={{ ...S.card, padding: 32, maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ color: '#0F172A', fontWeight: 700, marginBottom: 8 }}>Feedback Submitted</h2>
            <p style={{ color: '#64748B', marginBottom: 20 }}>
              Thank you for your feedback on <strong>{selectedSessionObj?.title || 'this session'}</strong>.
            </p>
            <div style={{ background: '#F0FDF4', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, color: '#065F46', marginBottom: 8 }}>Your Ratings</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 14 }}>
                <div>Overall: {'★'.repeat(overallRating)}{'☆'.repeat(5 - overallRating)}</div>
                <div>Trainer: {'★'.repeat(trainerRating)}{'☆'.repeat(5 - trainerRating)}</div>
                <div>Content: {'★'.repeat(contentRating)}{'☆'.repeat(5 - contentRating)}</div>
                <div>Audio: {'★'.repeat(audioRating)}{'☆'.repeat(5 - audioRating)}</div>
                <div>Video: {'★'.repeat(videoRating)}{'☆'.repeat(5 - videoRating)}</div>
              </div>
            </div>
            {selectedFeedback.comment && (
              <div style={{ fontStyle: 'italic', color: '#475569', fontSize: 14, padding: 12, background: '#F8FAFC', borderRadius: 8 }}>
                "{selectedFeedback.comment}"
              </div>
            )}
            {pendingSessions.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedSession(String(pendingSessions[0]._id))}
                style={{ ...S.btnPri, background: '#fff', color: '#6366f1', border: '1px solid #e0e7ff', marginTop: 20 }}
              >
                Submit feedback for another session ({pendingSessions.length} remaining)
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', margin: 0 }}>Feedback</h1>
          <p style={{ color: '#64748B', margin: '4px 0 0', fontSize: 14 }}>
            Help us improve by sharing your experience. Your feedback is anonymous.
          </p>
        </div>

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px', fontSize: 14, color: '#B91C1C', marginBottom: 16 }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ ...S.card, padding: 28 }}>
          {completedSessions.length > 1 && (
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#64748B', marginBottom: 6 }}>Session ({typeLabel})</label>
              <select value={selectedSession} onChange={handleSessionChange} style={{ ...S.input, width: '100%' }}>
                {completedSessions.map(s => {
                  const submitted = !!feedbackBySessionId[String(s._id)];
                  return (
                    <option key={s._id} value={s._id} disabled={submitted}>
                      [{s.feedbackType === 'workshop' ? 'Workshop' : 'LMS'}] {s.title} - {new Date(s.scheduledAt).toLocaleDateString()}{submitted ? ' (submitted)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {completedSessions.length === 1 && selectedSessionObj && (
            <div style={{ marginBottom: 24, padding: '12px 16px', background: '#F8FAFC', borderRadius: 10, fontSize: 14, color: '#475569' }}>
              <strong style={{ color: '#0F172A' }}>[{typeLabel}]</strong> {selectedSessionObj.title} — {new Date(selectedSessionObj.scheduledAt).toLocaleDateString()}
            </div>
          )}

          <div style={{ display: 'grid', gap: 20, marginBottom: 24 }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 8 }}>Overall Rating</label>
              <StarInput rating={form.overallRating} onChange={v => setForm(f => ({ ...f, overallRating: v }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 8 }}>Trainer Rating</label>
              <StarInput rating={form.trainerRating} onChange={v => setForm(f => ({ ...f, trainerRating: v }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 8 }}>Content Rating</label>
              <StarInput rating={form.contentRating} onChange={v => setForm(f => ({ ...f, contentRating: v }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 8 }}>Audio Quality</label>
              <StarInput rating={form.audioRating} onChange={v => setForm(f => ({ ...f, audioRating: v }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 8 }}>Video Quality</label>
              <StarInput rating={form.videoRating} onChange={v => setForm(f => ({ ...f, videoRating: v }))} />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 8 }}>Comments (optional)</label>
            <textarea
              value={form.comment}
              onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
              placeholder="Share your thoughts about the session..."
              rows={3}
              style={{ ...S.input, resize: 'vertical', minHeight: 80 }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 8 }}>Suggestions (optional)</label>
            <textarea
              value={form.suggestions}
              onChange={e => setForm(f => ({ ...f, suggestions: e.target.value }))}
              placeholder="What could we improve?"
              rows={2}
              style={{ ...S.input, resize: 'vertical', minHeight: 60 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" disabled={submitting} style={{ ...S.btnPri, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Submitting…' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
