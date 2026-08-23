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

export default function TraineeFeedbackPage() {
  const token = useSelector(s => s.auth?.token || '');
  const [workshops, setWorkshops] = useState([]);
  const [completedSessions, setCompletedSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    overallRating: 0,
    trainerRating: 0,
    contentRating: 0,
    audioRating: 0,
    videoRating: 0,
    comment: '',
    suggestions: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        const headers = { Authorization: `Bearer ${token}` };

        // Fetch workshop batches and completed workshop sessions
        let lmsSessions = [];
        let workshopSessions = [];
        let allFeedback = [];

        try {
          const wsRes = await axios.get(`${API}/api/trainee/workshop-batches`, { headers });
          const batches = wsRes.data?.batches || [];
          setWorkshops(batches);

          const sessRes = await axios.get(`${API}/api/trainee/workshop-sessions?status=completed`, { headers });
          workshopSessions = (sessRes.data?.sessions || []).filter(s => String(s.status).toLowerCase() === 'completed');
        } catch (e) {
          console.warn('Workshop data load:', e.message);
        }

        // Fetch LMS completed sessions
        try {
          const lmsRes = await axios.get(`${API}/api/trainee/sessions?status=completed`, { headers });
          lmsSessions = (lmsRes.data?.sessions || []).filter(s => String(s.status).toLowerCase() === 'completed');
        } catch (e) {
          console.warn('LMS data load:', e.message);
        }

        const merged = [
          ...lmsSessions.map(s => ({ ...s, feedbackType: 'lms' })),
          ...workshopSessions.map(s => ({ ...s, feedbackType: 'workshop' })),
        ];
        setCompletedSessions(merged);

        if (merged.length > 0 && !selectedSession) {
          setSelectedSession(merged[0]._id);
        }

        // Fetch existing feedback (both LMS and Workshop)
        try {
          const [lmsFb, wsFb] = await Promise.all([
            axios.get(`${API}/api/trainee/lms-feedback`, { headers }).catch(() => ({ data: { feedback: [] } })),
            axios.get(`${API}/api/trainee/workshop-feedback`, { headers }).catch(() => ({ data: { feedback: [] } })),
          ]);
          allFeedback = [...(lmsFb.data?.feedback || []), ...(wsFb.data?.feedback || [])];
        } catch (e) {
          console.warn('Feedback fetch:', e.message);
        }

        if (merged.length > 0 && allFeedback.length > 0) {
          const firstSessionId = merged[0]._id;
          const existing = allFeedback.find(f => String(f.sessionId?._id || f.sessionId) === String(firstSessionId));
          if (existing) {
            setFeedback(existing);
            setSubmitted(true);
          }
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

  const selectedSessionObj = completedSessions.find(s => String(s._id) === String(selectedSession));
  const selectedType = selectedSessionObj?.feedbackType || 'lms';

  const handleSessionChange = (e) => {
    const newId = e.target.value;
    setSelectedSession(newId);
    const newObj = completedSessions.find(s => String(s._id) === String(newId));
    const newType = newObj?.feedbackType || 'lms';

    // Check if feedback already exists for this session
    const checkExisting = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        if (newType === 'workshop') {
          const res = await axios.get(`${API}/api/trainee/workshop-feedback`, { headers });
          const existing = (res.data?.feedback || []).find(f => String(f.sessionId?._id || f.sessionId) === String(newId));
          if (existing) { setFeedback(existing); setSubmitted(true); }
          else { setFeedback(null); setSubmitted(false); }
        } else {
          const res = await axios.get(`${API}/api/trainee/lms-feedback`, { headers });
          const existing = (res.data?.feedback || []).find(f => String(f.sessionId?._id || f.sessionId) === String(newId));
          if (existing) { setFeedback(existing); setSubmitted(true); }
          else { setFeedback(null); setSubmitted(false); }
        }
      } catch (e) {
        setFeedback(null); setSubmitted(false);
      }
    };
    checkExisting();
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

      setSubmitted(true);
      setFeedback(res.data?.feedback || { ...form, _id: 'temp' });
    } catch (err) {
      if (err.response?.status === 409) {
        setError('You have already submitted feedback for this session.');
        setSubmitted(true);
      } else {
        setError(err.response?.data?.message || 'Failed to submit feedback. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewFeedback = () => {
    setForm({ overallRating: 0, trainerRating: 0, contentRating: 0, audioRating: 0, videoRating: 0, comment: '', suggestions: '' });
    setSubmitted(false);
    setFeedback(null);
    setError('');
  };

  if (loading) {
    return (
      <div style={S.page}>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 14, color: '#64748B' }}>Loading your sessions…</div>
        </div>
      </div>
    );
  }

  if (error && completedSessions.length === 0 && !submitted) {
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

  if (submitted && feedback) {
    const overallRating = feedback.overallRating || feedback.rating || 0;
    const trainerRating = feedback.trainerRating || 0;
    const contentRating = feedback.contentRating || 0;
    const audioRating = feedback.audioRating || 0;
    const videoRating = feedback.videoRating || 0;

    return (
      <div style={S.page}>
        <div style={{ ...S.card, padding: 32, maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ color: '#0F172A', fontWeight: 700, marginBottom: 8 }}>Feedback Submitted</h2>
          <p style={{ color: '#64748B', marginBottom: 20 }}>
            Thank you for your feedback! Your responses help us improve the {typeLabel} experience.
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
          {feedback.comment && (
            <div style={{ fontStyle: 'italic', color: '#475569', fontSize: 14, padding: 12, background: '#F8FAFC', borderRadius: 8 }}>
              "{feedback.comment}"
            </div>
          )}
          {completedSessions.length > 1 && (
            <button onClick={handleNewFeedback} style={{ ...S.btnPri, background: '#fff', color: '#6366f1', border: '1px solid #e0e7ff', marginTop: 20 }}>
              Submit Another
            </button>
          )}
        </div>
      </div>
    );
  }

  if (completedSessions.length === 0 && !submitted) {
    return (
      <div style={S.page}>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
          <h2 style={{ color: '#0F172A', fontWeight: 700 }}>No Completed Sessions Yet</h2>
          <p style={{ color: '#64748B', marginTop: 8 }}>
            Feedback will be available here after your sessions are completed.
          </p>
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
          {/* Session selector with type indicator */}
          {completedSessions.length > 1 && (
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#64748B', marginBottom: 6 }}>Session ({typeLabel})</label>
              <select value={selectedSession} onChange={handleSessionChange} style={{ ...S.input, width: '100%' }}>
                {completedSessions.map(s => (
                  <option key={s._id} value={s._id}>
                    [{s.feedbackType === 'workshop' ? 'Workshop' : 'LMS'}] {s.title} - {new Date(s.scheduledAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Ratings */}
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

          {/* Comments */}
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
