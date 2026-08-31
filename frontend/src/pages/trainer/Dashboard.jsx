import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';
import WatchRecordingButton from '../../components/recording/WatchRecordingButton';

// ── LiveKit (third-party real-time video) ─────────────────────────────────────
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';

import {
  fetchTrainerDashboard,
  fetchTrainerSessions,
  fetchTrainerAssignments,
  fetchTrainerStudents,
  gradeSubmission,
  fetchSessionAttendance,
  setActiveTab,
  openGradingModal,
  closeGradingModal,
  selectTrainerDashboard,
  selectTrainerStatus,
  selectTrainerError,
  selectTrainerSessions,
  selectSessionsStatus,
  selectTrainerAssignments,
  selectAssignmentsStatus,
  selectTrainerStudents,
  selectStudentsStatus,
  selectGradingStatus,
  selectGradingError,
  selectAttendance,
  selectAttendanceStatus,
  selectActiveTab,
  selectGradingModal,
} from '../../features/Trainer/trainerSlice';

import {
  fetchSessionAttendanceWS,
  selectWSAttendance,
} from '../../features/workshops/workshopSessionsSlice';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const LIVEKIT_URL = process.env.REACT_APP_LIVEKIT_URL || '';


// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const fmtTime = (iso) => {
  if (!iso) return '—';
  const d     = new Date(iso);
  const today = new Date();
  const time  = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toDateString() === today.toDateString()
    ? time
    : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`;
};

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const scoreCol = (n) => n >= 75 ? '#16a34a' : n >= 55 ? '#d97706' : '#dc2626';

const sessionStartMs = (s) => {
  const ms = new Date(s.scheduledAt || s.date || s.startTime || 0).getTime();
  return Number.isNaN(ms) ? 0 : ms;
};

/** Match backend sessionStatusUtils — persisted end state wins over time-based rules. */
const effectiveSessionStatus = (s) => {
  const status = String(s?.status || '').toLowerCase();
  if (status === 'completed' || status === 'cancelled') return status;
  if (s?.endedAt) return 'completed';
  const start = sessionStartMs(s);
  const durMs = (s?.durationMinutes || 60) * 60 * 1000;
  const endMs = start ? start + durMs : 0;
  if (endMs && Date.now() > endMs) return 'completed';
  if (status === 'live' || status === 'ongoing') return 'live';
  if (start && Date.now() >= start) return 'live';
  return 'scheduled';
};

const isPastSession = (s) => {
  const st = effectiveSessionStatus(s);
  return st === 'completed' || st === 'cancelled';
};

const clampPct = (n) => Math.min(100, Math.max(0, Math.round(Number(n) || 0)));

const buildBatches = (explicitBatches = [], sessions = [], batchStats = {}) => {
  const map = {};
  const keyOf = (b) => b._id || b.id || b.batchId || b.code || b.name;
  explicitBatches.forEach((b) => {
    const id   = keyOf(b) || 'unknown';
    const name = b.name || b.batchName || b.code || 'Batch';
    map[id] = {
      sessions: [],
      ...(batchStats[id] || {}),
      ...b,
      id,
      name,
      phase: b.phase || b.currentModule || b.module || (batchStats[id] || {}).phase,
    };
  });
  sessions.forEach((s) => {
    const id   = s.batchId?._id || s.batchId || 'unknown';
    const name = s.batchId?.name || map[id]?.name || 'Unknown Batch';
    if (!map[id]) map[id] = { id, name, sessions: [], ...(batchStats[id] || {}) };
    map[id].sessions.push(s);
  });
  return Object.values(map);
};

// Stable LiveKit identity per (room,user) so a refresh rejoins instead of spawning a ghost.
const livekitIdentity = (room, base) => {
  const safe = String(base || 'trainer').replace(/\s+/g, '-');
  const key  = `lk:${room}:${safe}`;
  let id = sessionStorage.getItem(key);
  if (!id) { id = `${safe}-${Date.now()}`; sessionStorage.setItem(key, id); }
  return id;
};

const COLORS = ['#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626'];
const LIGHTS = ['#ede9fe', '#ecfeff', '#dcfce7', '#fef9c3', '#fee2e2'];

const PAGE_SIZE = 8;

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL CSS
// ═══════════════════════════════════════════════════════════════════════════════

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; }
  @keyframes spin  { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.25} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .td-card:hover  { box-shadow: 0 4px 18px rgba(0,0,0,.10) !important; }
  .td-tab:hover   { color: #6366f1 !important; background: #f5f3ff !important; }
  .td-sub:hover   { background: #fefce8 !important; }
  .td-btn:hover   { opacity: .88; }
  .td-row:hover   { background: #f9fafb !important; }
  input:focus, textarea:focus {
    outline: none !important;
    border-color: #6366f1 !important;
    box-shadow: 0 0 0 3px rgba(99,102,241,.15) !important;
  }
  .td-tabs { -ms-overflow-style: none; scrollbar-width: none; }
  .td-tabs::-webkit-scrollbar { display: none; }
  .td-tabs button { flex: 0 0 auto; white-space: nowrap; }
  .td-trainees { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
  .td-pager { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 22px; flex-wrap: wrap; }

  /* LiveKit room overlay */
  .lk-overlay { position: fixed; inset: 0; z-index: 2000; background: #0b0d12; display: flex; flex-direction: column; }
  .lk-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; background: #111827; color: #fff; flex-shrink: 0; }
  .lk-stage { flex: 1; min-height: 0; }
  .lk-leave { background: #dc2626; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-size: 0.82rem; font-weight: 700; cursor: pointer; }
  .lk-overlay .lk-chat, .lk-overlay .lk-chat-entry, .lk-overlay .lk-message-body, .lk-overlay .lk-chat-form {
    background: #fff !important; color: #111827 !important; color-scheme: light !important;
  }
  .lk-overlay .lk-chat-form input, .lk-overlay .lk-chat-form textarea {
    background: #fff !important; color: #111827 !important;
  }

  @media (max-width: 1024px) { .td-g3 { grid-template-columns: 1fr 1fr !important; } }
  @media (max-width:  680px) { .td-g3 { grid-template-columns: 1fr       !important; } }
  @media (max-width: 768px) {
    .td-wrap     { padding: 20px 14px !important; }
    .td-h1       { font-size: 1.35rem !important; }
    .td-tabs     { overflow-x: auto; }
    .td-modal    { padding: 20px 18px !important; }
    .td-trainees { grid-template-columns: 1fr 1fr !important; }
  }
  @media (max-width: 480px) {
    .td-trainees { grid-template-columns: 1fr !important; }
    .td-pager button { min-width: 30px; padding: 6px 8px !important; font-size: 0.74rem !important; }
    .td-detail-head { flex-direction: column !important; align-items: flex-start !important; }
    .td-detail-head .td-detail-pills { margin-left: 0 !important; }
  }
`;

// ═══════════════════════════════════════════════════════════════════════════════
// ATOMS
// ═══════════════════════════════════════════════════════════════════════════════

const Pill = ({ children, bg = '#dcfce7', color = '#15803d', dot = false }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: bg, color, fontSize: '0.71rem', fontWeight: 600,
    padding: '2px 9px', borderRadius: 99, whiteSpace: 'nowrap', lineHeight: 1.7,
  }}>
    {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />}
    {children}
  </span>
);

const Spinner = ({ pad = 40, color = '#6366f1' }) => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: pad }}>
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      border: '3px solid #e5e7eb', borderTopColor: color,
      animation: 'spin .7s linear infinite',
    }} />
  </div>
);

const Empty = ({ icon, msg }) => (
  <div style={{ textAlign: 'center', padding: '28px 0', color: '#9ca3af' }}>
    <div style={{ fontSize: '2rem', marginBottom: 8 }}>{icon}</div>
    <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>{msg}</div>
  </div>
);

const H2 = ({ children }) => (
  <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', marginBottom: 16, letterSpacing: '-0.2px' }}>
    {children}
  </h2>
);

const GrpLbl = ({ children }) => (
  <div style={{ fontSize: '0.67rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 8, marginTop: 20 }}>
    {children}
  </div>
);

const FieldLbl = ({ children }) => (
  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
    {children}
  </div>
);

const pgBtn = (disabled) => ({
  padding: '7px 12px', borderRadius: 8, border: '1px solid #e5e7eb',
  background: disabled ? '#f9fafb' : '#fff',
  color: disabled ? '#d1d5db' : '#6b7280',
  fontWeight: 600, fontSize: '0.8rem',
  cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
});

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE ROOM  (LiveKit) — fetches a token for the session room, renders the call
//   isHost      → shows the red "End session" button (stops the recording)
//   onEndSession → called when the host ends the meeting for everyone
//   onClose     → "Leave" — just closes the overlay; recording keeps running
// ═══════════════════════════════════════════════════════════════════════════════

const LiveRoom = ({ session, isHost = false, onClose, onEndSession, initialToken = null, initialUrl = null }) => {
  const dashboard   = useSelector(selectTrainerDashboard);
  const authToken   = useSelector((s) => s?.auth?.token);
  const trainerName = dashboard?.trainer?.name ?? dashboard?.trainerName ?? 'Trainer';

  // IMPORTANT: room MUST equal session._id — the backend starts egress on this exact
  // room name, so the token, the room everyone joins, and the recording all line up.
  const room = `session_${session._id || session.id}`;

  const [token, setToken] = useState(null);
  const [url,   setUrl]   = useState(LIVEKIT_URL);
  const [err,   setErr]   = useState(null);
  const [recordingState, setRecordingState] = useState('none');
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [recordingError, setRecordingError] = useState('');

  // Sync recording status from backend
  useEffect(() => {
    if (!session._id || !authToken) return;
    axios.get(`${API_BASE_URL}/api/trainer/sessions/${session._id}`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then(res => {
        const recStatus = res.data?.session?.recordingStatus;
        if (recStatus === 'recording') setRecordingState('recording');
        else if (recStatus === 'processing') setRecordingState('processing');
        else setRecordingState('none');
      })
      .catch(() => {});
  }, [session._id, authToken]);

  // Clear processing badge once backend finishes reconciling
  useEffect(() => {
    if (recordingState !== 'processing' || !session._id || !authToken) return undefined;
    const poll = setInterval(() => {
      axios.get(`${API_BASE_URL}/api/trainer/sessions/${session._id}`, { headers: { Authorization: `Bearer ${authToken}` } })
        .then(res => {
          const recStatus = res.data?.session?.recordingStatus;
          if (recStatus === 'available' || recStatus === 'failed') setRecordingState('none');
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(poll);
  }, [recordingState, session._id, authToken]);

  const toggleRecording = async () => {
    if (!session._id || recordingLoading) return;
    setRecordingError('');
    setRecordingLoading(true);
    try {
      if (recordingState === 'recording') {
        const res = await axios.post(`${API_BASE_URL}/api/trainer/sessions/${session._id}/recording/stop`, {}, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.data?.success) {
          const status = res.data.recordingStatus || res.data.session?.recordingStatus;
          const rec = res.data.recording;
          if (status === 'available' || rec?.status === 'completed') setRecordingState('none');
          else if (status === 'failed') setRecordingState('none');
          else setRecordingState('processing');
        } else setRecordingError(res.data?.message || 'Failed to stop recording');
      } else if (recordingState === 'none') {
        const res = await axios.post(`${API_BASE_URL}/api/trainer/sessions/${session._id}/recording/start`, {}, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.data?.success) setRecordingState('recording');
        else setRecordingError(res.data?.message || 'Failed to start recording');
      }
    } catch (e) {
      setRecordingError(e.response?.data?.message || e.message || 'Recording action failed');
    } finally {
      setRecordingLoading(false);
    }
  };

  useEffect(() => {
    if (initialToken) {
      setToken(initialToken);
      setUrl(initialUrl || LIVEKIT_URL);
      setErr(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const identity = livekitIdentity(room, trainerName);
        const sessionId = session._id || session.id;
        const { data } = await axios.post(
          `${API_BASE_URL}/api/livekit/token`,
          { room, sessionId, identity, name: trainerName },
          authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : undefined
        );
        if (cancelled) return;
        const payload = data?.data ?? data;
        setToken(payload.token);
        setUrl(payload.url || payload.serverUrl || LIVEKIT_URL);
      } catch (e) {
        if (!cancelled) setErr(e?.response?.data?.message || e.message || 'Failed to start the live session.');
      }
    })();
    return () => { cancelled = true; };
  }, [room, trainerName, authToken, initialToken, initialUrl, session._id, session.id]);

  return (
    <div className="lk-overlay">
      <div className="lk-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite', flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {session.title || 'Live Session'}
          </span>
          {session.batchId?.name && (
            <span style={{ fontSize: '0.76rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>· {session.batchId.name}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
          {isHost && recordingState === 'recording' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fee2e2', color: '#991b1b', fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', animation: 'pulse 1s infinite' }} /> REC
            </span>
          )}
          {isHost && recordingState === 'processing' && (
            <span style={{ fontSize: '0.72rem', color: '#1e40af', fontWeight: 700 }}>Processing…</span>
          )}
          {isHost && recordingError && (
            <span style={{ fontSize: '0.7rem', color: '#dc2626' }} title={recordingError}>⚠️</span>
          )}
          {isHost && (
            <button
              onClick={toggleRecording}
              disabled={recordingLoading || recordingState === 'processing'}
              className="lk-leave"
              style={{
                background: recordingState === 'recording' ? '#7f1d1d' : '#1f2937',
                color: recordingState === 'recording' ? '#fecaca' : '#fff',
                fontSize: '0.7rem',
                padding: '4px 10px',
                opacity: recordingLoading ? 0.6 : 1,
              }}
              title={recordingState === 'recording' ? 'Stop Recording' : 'Start Recording'}
            >
              {recordingLoading ? '…' : (recordingState === 'recording' ? 'Stop Rec' : 'Start Rec')}
            </button>
          )}
          {isHost && onEndSession && (
            <button className="lk-leave" style={{ background: '#b91c1c' }} onClick={onEndSession}>
              End session
            </button>
          )}
          <button className="lk-leave" style={{ background: '#374151' }} onClick={onClose}>
            Leave
          </button>
        </div>
      </div>

      <div className="lk-stage">
        {err ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fca5a5', gap: 10, padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: '2rem' }}>⚠️</div>
            <div style={{ fontWeight: 600 }}>{err}</div>
            <button className="lk-leave" style={{ background: '#374151', marginTop: 8 }} onClick={onClose}>Close</button>
          </div>
        ) : !token ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', gap: 12 }}>
            <Spinner color="#fff" pad={0} />
            <div style={{ fontSize: '0.85rem' }}>Connecting to the live room…</div>
          </div>
        ) : (
          <LiveKitRoom
            token={token}
            serverUrl={url}
            connect={true}
            video={true}
            audio={true}
            onDisconnected={onClose}
            data-lk-theme="default"
            style={{ height: '100%' }}
          >
            <VideoConference />
          </LiveKitRoom>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH CARD
// ═══════════════════════════════════════════════════════════════════════════════

const BatchCard = ({ batch, idx }) => {
  const c = COLORS[idx % COLORS.length];
  const l = LIGHTS[idx % LIGHTS.length];
  const pct = batch.progress != null || batch.completion != null
    ? clampPct(batch.progress ?? batch.completion)
    : Math.min(100, Math.round((batch.sessions.length / 12) * 100));

  const meta = [];
  if (batch.totalTrainees != null) meta.push(`${batch.totalTrainees} trainees`);
  else if (batch.studentCount != null) meta.push(`${batch.studentCount} trainees`);
  if (batch.avgScore != null) meta.push(`Avg ${batch.avgScore}`);
  meta.push(batch.activeCount != null ? `${batch.activeCount} active` : 'Mentor active');

  return (
    <div className="td-card" style={{
      border: '1px solid #e5e7eb', borderLeft: `4px solid ${c}`,
      borderRadius: 10, padding: '14px 16px', marginBottom: 10,
      background: '#fff', cursor: 'pointer', transition: 'box-shadow .15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: '0.93rem', color: '#111827' }}>{batch.name}</span>
        {batch.phase && <Pill bg={l} color={c}>{batch.phase}</Pill>}
      </div>
      <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: 10 }}>
        {meta.join(' · ')}
      </div>
      <div style={{ height: 5, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: c, borderRadius: 4, transition: 'width .5s ease' }} />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION CARD  — Start calls the API (creates room + recording), then opens the room
// ═══════════════════════════════════════════════════════════════════════════════

const SessionCard = ({ session, isLive }) => {
  const dispatch    = useDispatch();
  const authToken   = useSelector((s) => s?.auth?.token);
  const [open, setOpen]         = useState(false);
  const [live, setLive]         = useState(false);   // ← LiveKit room overlay open?
  const [liveConn, setLiveConn] = useState(null);    // { token, url } from start/join API
  const [starting, setStarting] = useState(false);
  const [actErr, setActErr]     = useState(null);

  const allAtt     = useSelector(selectAttendance);
  const allAttSt   = useSelector(selectAttendanceStatus);
  const att        = allAtt[session._id];
  const attLoading = allAttSt[session._id] === 'loading';

  const records   = att?.records || att?.data?.records || [];
  const st        = effectiveSessionStatus(session);
  const liveNow   = isLive || st === 'live';
  const past      = isPastSession(session);
  const completed = st === 'completed';
  const cancelled = st === 'cancelled';

  const authCfg = authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : undefined;

  // ── Start: tell the SERVER to create the room + start egress, THEN open the call ──
  const handleStart = async () => {
    setStarting(true);
    setActErr(null);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/sessions/${session._id}/start`, {}, authCfg);
      if (data?.token) {
        setLiveConn({ token: data.token, url: data.url });
        setLive(true);
      }
      dispatch(fetchTrainerSessions());
    } catch (e) {
      setActErr(e?.response?.data?.message || e.message || 'Could not start the session.');
    } finally {
      setStarting(false);
    }
  };

  // ── End (host only): stop egress → webhook fills recordingUrl ──
  const handleEnd = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/sessions/${session._id}/end`, {}, authCfg);
    } catch (e) {
      setActErr(e?.response?.data?.message || e.message || 'Could not end the session.');
    } finally {
      setLive(false);
      dispatch(fetchTrainerSessions());
    }
  };

  const toggleAttendance = () => {
    if (!open && !att) dispatch(fetchSessionAttendance(session._id));
    setOpen(v => !v);
  };

  const meta = [
    fmtTime(session.scheduledAt),
    session.batchId?.name,
    session.sessionType || session.type || session.topics?.[0],
  ].filter(Boolean).join(' · ');

  return (
    <div className="td-card" style={{
      border: `1px solid ${liveNow ? '#fca5a5' : '#e5e7eb'}`,
      background: liveNow ? '#fef2f2' : past ? '#f9fafb' : '#fff',
      borderRadius: 10, padding: '14px 16px', marginBottom: 10,
      transition: 'box-shadow .15s', opacity: past ? 0.92 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: '0.93rem', color: '#111827' }}>
          {session.title || 'Untitled Session'}
        </span>
        {past && (completed || cancelled) && <Pill bg="#f1f5f9" color="#64748b">🔒 Read-only</Pill>}
      </div>

      <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: 10 }}>{meta}</div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {liveNow ? (
          <button
            onClick={handleStart}
            disabled={starting}
            style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '7px 16px', borderRadius: 7, fontSize: '0.78rem', fontWeight: 600, cursor: starting ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', animation: 'pulse 1s infinite' }} />
            {starting ? 'Joining…' : 'Join Live'}
          </button>
        ) : past ? (
          <>
            <span style={{ background: '#f1f5f9', color: completed ? '#15803d' : '#b91c1c', border: '1px solid #e5e7eb', padding: '6px 14px', borderRadius: 7, fontSize: '0.78rem', fontWeight: 600 }}>
              {completed ? 'Completed' : 'Cancelled'}
            </span>
            {completed && session.recordingUrl && (
              <WatchRecordingButton
                sessionId={session._id}
                token={authToken}
                workshop={session.sessionType === 'WORKSHOP'}
              />
            )}
          </>
        ) : (
          <button style={{ background: '#fff', color: '#6b7280', border: '1px solid #e5e7eb', padding: '6px 14px', borderRadius: 7, fontSize: '0.78rem', fontWeight: 500, cursor: 'default' }}>
            Upcoming
          </button>
        )}

        <button
          onClick={toggleAttendance}
          style={{ background: '#fff', color: '#6366f1', border: '1px solid #e0e7ff', padding: '6px 12px', borderRadius: 7, fontSize: '0.73rem', fontWeight: 600, cursor: 'pointer' }}
        >
          {open ? 'Hide' : (past ? 'View Attendance' : 'Attendance')}
        </button>
      </div>

      {actErr && (
        <div style={{ marginTop: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', fontSize: '0.74rem', color: '#b91c1c' }}>
          ⚠️ {actErr}
        </div>
      )}

      {open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
          {attLoading ? (
            <Spinner pad={16} />
          ) : records.length === 0 ? (
            <p style={{ fontSize: '0.74rem', color: '#9ca3af' }}>No attendance records for this session.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {records.map((r, i) => {
                const present = r.status === 'present';
                return (
                  <span key={i} style={{
                    fontSize: '0.71rem', fontWeight: 600,
                    padding: '3px 9px', borderRadius: 6,
                    background: present ? '#dcfce7' : '#fee2e2',
                    color:      present ? '#15803d' : '#b91c1c',
                  }}>
                    {r.trainee?.name || `Student ${i + 1}`} {present ? '✓' : '✗'}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* LiveKit room overlay — host gets the End button that stops recording */}
      {live && (
        <LiveRoom
          session={session}
          isHost
          initialToken={liveConn?.token}
          initialUrl={liveConn?.url}
          onClose={() => { setLive(false); setLiveConn(null); }}
          onEndSession={handleEnd}
        />
      )}
    </div>
  );
};

// Workshop session card — attendance toggle mirrors LMS SessionCard
const WorkshopSessionCard = ({ session }) => {
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const records = useSelector(selectWSAttendance(session._id));

  const toggleAttendance = async () => {
    if (!open && !fetched) {
      setLoading(true);
      await dispatch(fetchSessionAttendanceWS(session._id));
      setFetched(true);
      setLoading(false);
    }
    setOpen(v => !v);
  };

  const isPresent = (status) => ['Present', 'Partial', 'present', 'partial'].includes(status);

  return (
    <div className="td-card" style={{
      border: `1px solid ${session.status === 'live' ? '#fca5a5' : '#e5e7eb'}`,
      background: session.status === 'live' ? '#fef2f2' : '#fff',
      borderRadius: 10, padding: '14px 16px', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: '0.93rem', color: '#111827' }}>
          {session.title || 'Workshop Session'}
        </span>
        {session.status === 'live' && <Pill bg="#fee2e2" color="#dc2626" dot>LIVE</Pill>}
      </div>
      <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: 10 }}>
        {session.workshopBatchId?.workshopId?.title || session.workshopBatchId?.batchName || ''} · {fmtTime(session.scheduledAt)}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={toggleAttendance}
          style={{ background: '#fff', color: '#6366f1', border: '1px solid #e0e7ff', padding: '6px 12px', borderRadius: 7, fontSize: '0.73rem', fontWeight: 600, cursor: 'pointer' }}
        >
          {open ? 'Hide' : 'View Attendance'}
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
          {loading ? (
            <Spinner pad={16} />
          ) : records.length === 0 ? (
            <p style={{ fontSize: '0.74rem', color: '#9ca3af' }}>No attendance records for this session.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {records.map((r, i) => {
                const present = isPresent(r.attendanceStatus || r.status);
                const name = r.participant?.name || r.participant?.fullName || r.studentId?.name || `Participant ${i + 1}`;
                return (
                  <span key={r._id || i} style={{
                    fontSize: '0.71rem', fontWeight: 600,
                    padding: '3px 9px', borderRadius: 6,
                    background: present ? '#dcfce7' : '#fee2e2',
                    color: present ? '#15803d' : '#b91c1c',
                  }}>
                    {name} {present ? '✓' : '✗'}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// GRADING MODAL
// ═══════════════════════════════════════════════════════════════════════════════

const GradingModal = () => {
  const dispatch    = useDispatch();
  const assignment  = useSelector(selectGradingModal);
  const gradStatus  = useSelector(selectGradingStatus);
  const gradError   = useSelector(selectGradingError);

  const [selSub,        setSelSub]        = useState(null);
  const [grade,         setGrade]         = useState('');
  const [feedback,      setFeedback]      = useState('');
  const [allowResubmit, setAllowResubmit] = useState(false);

  if (!assignment) return null;

  const subs      = assignment.submissions || [];
  const canSubmit = selSub && grade !== '' && gradStatus !== 'loading';

  const handleSubmit = () => {
    if (!canSubmit) return;
    dispatch(gradeSubmission({
      assignmentId: assignment._id,
      submissionId: selSub._id,
      grade:        Number(grade),
      feedback,
      allowResubmit,
    }));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="td-modal" style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, padding: '26px 26px 22px', boxShadow: '0 20px 60px rgba(0,0,0,.18)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>Grade Submission</span>
          <button onClick={() => dispatch(closeGradingModal())} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#9ca3af', lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px', marginBottom: 18 }}>
          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#111827' }}>{assignment.title}</div>
          <div style={{ fontSize: '0.73rem', color: '#6b7280', marginTop: 3 }}>
            Due: {fmtDate(assignment.dueDate)} · {assignment.batchId?.name || assignment.batchId || '—'} · {subs.length} submission(s)
          </div>
        </div>

        {subs.length === 0 ? (
          <Empty icon="📭" msg="No submissions yet" />
        ) : (
          <>
            <FieldLbl>Select Submission</FieldLbl>
            <div style={{ marginBottom: 14 }}>
              {subs.map((sub) => (
                <div
                  key={sub._id}
                  onClick={() => setSelSub(sub)}
                  className="td-row"
                  style={{
                    border: `1.5px solid ${selSub?._id === sub._id ? '#6366f1' : '#e5e7eb'}`,
                    borderRadius: 8, padding: '10px 12px', marginBottom: 6,
                    cursor: 'pointer',
                    background: selSub?._id === sub._id ? '#f5f3ff' : '#fff',
                    transition: 'all .12s',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.84rem', color: '#111827' }}>
                    {sub.studentName || sub.student?.name || sub.trainee?.name || 'Student'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 2 }}>
                    Submitted: {fmtDate(sub.submittedAt)}
                    {sub.grade != null && (
                      <span style={{ marginLeft: 8, color: scoreCol(sub.grade), fontWeight: 600 }}>
                        Graded: {sub.grade}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <FieldLbl>Grade (0 – 100)</FieldLbl>
            <input
              type="number" min="0" max="100"
              value={grade} onChange={e => setGrade(e.target.value)}
              placeholder="e.g. 87"
              style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: '0.92rem', fontWeight: 700, color: '#111827', marginBottom: 14, fontFamily: 'inherit' }}
            />

            <FieldLbl>
              Feedback{' '}
              <span style={{ fontWeight: 400, textTransform: 'none', color: '#9ca3af' }}>(optional)</span>
            </FieldLbl>
            <textarea
              value={feedback} onChange={e => setFeedback(e.target.value)}
              placeholder="e.g. Good work!"
              rows={3}
              style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: '0.82rem', color: '#374151', resize: 'vertical', marginBottom: 12, fontFamily: 'inherit' }}
            />

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#374151', marginBottom: 18, cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox" checked={allowResubmit}
                onChange={e => setAllowResubmit(e.target.checked)}
                style={{ width: 15, height: 15, accentColor: '#6366f1', cursor: 'pointer' }}
              />
              Allow resubmission
            </label>

            {gradError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '9px 12px', fontSize: '0.76rem', color: '#b91c1c', marginBottom: 14 }}>
                ⚠️ {gradError}
              </div>
            )}

            <button
              onClick={handleSubmit} disabled={!canSubmit}
              className={canSubmit ? 'td-btn' : ''}
              style={{
                width: '100%', padding: 12, borderRadius: 9, border: 'none',
                background: canSubmit ? '#1e293b' : '#e5e7eb',
                color:      canSubmit ? '#fff'    : '#9ca3af',
                fontWeight: 700, fontSize: '0.88rem', fontFamily: 'inherit',
                cursor: canSubmit ? 'pointer' : 'not-allowed', transition: 'opacity .15s',
              }}
            >
              {gradStatus === 'loading' ? 'Saving…' : 'Submit Grade'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════════════════════════════════════════

// const Leaderboard = ({ students }) => {
//   const STATIC = [
//     { rank: 1, name: 'Kavya R.',  score: 88, attendance: 92 },
//     { rank: 2, name: 'Neha S.',   score: 84, attendance: 88 },
//     { rank: 3, name: 'Ritu M.',   score: 79, attendance: 85 },
//     { rank: 4, name: 'Ajay P.',   score: 65, attendance: 78 },
//     { rank: 5, name: 'Dinesh K.', score: 52, attendance: 74 },
//   ];

//   const rows = students.length > 0
//     ? [...students]
//         .filter(s => (s.averageScore ?? s.score) != null)
//         .sort((a, b) => (b.averageScore ?? b.score ?? 0) - (a.averageScore ?? a.score ?? 0))
//         .slice(0, 5)
//         .map((s, i) => ({ rank: i + 1, name: s.name, score: s.averageScore ?? s.score ?? 0, attendance: s.attendance ?? null }))
//     : STATIC;

//   const rankColor = { 1: '#ca8a04', 2: '#9ca3af', 3: '#b45309' };
//   const atRisk    = rows.filter(r => r.score < 60);

//   return (
//     <>
//       <table style={{ width: '100%', borderCollapse: 'collapse' }}>
//         <thead>
//           <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
//             {['#', 'TRAINEE', 'SCORE'].map(h => (
//               <th key={h} style={{ fontSize: '0.67rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.7px', padding: '6px 10px', textAlign: 'left' }}>
//                 {h}
//               </th>
//             ))}
//           </tr>
//         </thead>
//         <tbody>
//           {rows.map(r => (
//             <tr key={r.rank} style={{ borderBottom: '1px solid #f9fafb' }}>
//               <td style={{ padding: '11px 10px', fontSize: '0.82rem', fontWeight: 700, color: rankColor[r.rank] || '#9ca3af', width: 28 }}>{r.rank}</td>
//               <td style={{ padding: '11px 10px', fontSize: '0.85rem', fontWeight: 500, color: '#111827' }}>{r.name}</td>
//               <td style={{ padding: '11px 10px', fontSize: '0.9rem', fontWeight: 700, color: scoreCol(r.score) }}>{r.score}</td>
//             </tr>
//           ))}
//         </tbody>
//       </table>

//       {atRisk.map(r => (
//         <div key={r.rank} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', marginTop: 12 }}>
//           <span style={{ color: '#d97706', fontSize: '0.88rem', flexShrink: 0, lineHeight: 1.5 }}>⚠</span>
//           <div style={{ fontSize: '0.77rem', color: '#92400e', lineHeight: 1.6 }}>
//             <strong style={{ color: '#78350f' }}>{r.name}</strong>
//             {' '}— score {r.score}
//             {r.attendance != null ? `, attendance ${r.attendance}%` : ''}
//             . At-risk flag active.
//           </div>
//         </div>
//       ))}
//     </>
//   );
// };
const Leaderboard = ({ students }) => {
  const rows = students.map((s, i) => ({
    rank: i + 1,
    name: s.name,
    score: '-'
  }));

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
          <th style={{ padding: '8px', textAlign: 'left' }}>#</th>
          <th style={{ padding: '8px', textAlign: 'left' }}>TRAINEE</th>
          <th style={{ padding: '8px', textAlign: 'left' }}>SCORE</th>
        </tr>
      </thead>

      <tbody>
        {rows.map((row) => (
          <tr key={row.rank}>
            <td style={{ padding: '10px 8px' }}>{row.rank}</td>
            <td style={{ padding: '10px 8px' }}>{row.name}</td>
            <td style={{ padding: '10px 8px' }}>-</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const thStyle = {};  // eslint-disable-line no-unused-vars
const tdStyle = {};  // eslint-disable-line no-unused-vars

// ═══════════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════════════════════

const OverviewTab = ({ dashboard, students }) => {
  const dispatch        = useDispatch();
  const trainerSessions = useSelector(selectTrainerSessions);

  useEffect(() => { dispatch(fetchTrainerSessions()); }, [dispatch]);

  const upcoming      = dashboard?.upcomingSessions || [];
  const live          = dashboard?.liveSessions     || [];
  const allSessions   = [...live, ...upcoming];
  const pendingGrades = dashboard?.pendingGrades    ?? 0;
  const batchStats    = dashboard?.batchStats       || {};

  // ── Workshop data from enhanced dashboard API ─────────────────────────────
  const myWorkshopBatches = dashboard?.myWorkshopBatches || [];
  const workshopSessions  = dashboard?.workshopSessions  || [];
  const workshopLiveSessions  = dashboard?.workshopLiveSessions  || [];
  const workshopStats      = dashboard?.workshopStats    || {};
  const workshopParticipantsCount = dashboard?.workshopParticipantsCount || 0;

  const explicitBatches = [
    dashboard?.batches,
    dashboard?.assignedBatches,
    dashboard?.myBatches,
    dashboard?.trainer?.batches,
  ].find(Array.isArray) || [];

  const sessionsForBatches = trainerSessions.length ? trainerSessions : allSessions;
  const batches    = buildBatches(explicitBatches, sessionsForBatches, batchStats);
  const firstBatch = batches[0]?.name || dashboard?.batchName || 'Batch';

  return (
    <div className="td-g3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 28, alignItems: 'start' }}>
      <div>
        <H2>LMS Batches {batches.length > 0 && <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#9ca3af' }}>({batches.length})</span>}</H2>
        {batches.length === 0
          ? <Empty icon="📦" msg="No LMS batches assigned yet" />
          : batches.map((b, i) => <BatchCard key={b.id} batch={b} idx={i} />)
        }

        <div style={{ marginTop: 24 }}>
          <H2>Workshop Batches {myWorkshopBatches.length > 0 && <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#9ca3af' }}>({myWorkshopBatches.length})</span>}</H2>
          {myWorkshopBatches.length === 0
            ? <Empty icon="📦" msg="No workshop batches assigned yet" />
            : myWorkshopBatches.map((b, i) => {
                const c = COLORS[(i + batches.length) % COLORS.length];
                const l = LIGHTS[(i + batches.length) % LIGHTS.length];
                const pct = Math.min(100, b.status === 'Completed' ? 100 : b.status === 'Active' ? 50 : 10);
                return (
                  <div key={b._id} className="td-card" style={{
                    border: '1px solid #e5e7eb', borderLeft: `4px solid ${c}`,
                    borderRadius: 10, padding: '14px 16px', marginBottom: 10,
                    background: '#fff', transition: 'box-shadow .15s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.93rem', color: '#111827' }}>{b.batchName}</span>
                      <Pill bg={l} color={c}>{b.workshopId?.title || 'Workshop'}</Pill>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: 10 }}>
                      {b.registrationIds?.length || 0} participants · {b.mode || 'Online'} · {b.status}
                    </div>
                    <div style={{ height: 5, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: c, borderRadius: 4, transition: 'width .5s ease' }} />
                    </div>
                  </div>
                );
              })
          }
        </div>
      </div>

      <div>
        <H2>LMS Sessions</H2>
        {allSessions.length === 0
          ? <Empty icon="📅" msg="No LMS sessions today" />
          : allSessions.map(s => (
            <SessionCard key={s._id} session={s} isLive={s.status === 'live'} />
          ))
        }

        <div style={{ marginTop: 24 }}>
          <H2>Workshop Sessions</H2>
          {workshopSessions.length === 0 && workshopLiveSessions.length === 0
            ? <Empty icon="📅" msg="No workshop sessions scheduled" />
            : [...workshopLiveSessions, ...workshopSessions].slice(0, 5).map(s => (
                <WorkshopSessionCard key={s._id} session={s} />
              ))
          }
        </div>

        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <H2>Grading Queue</H2>
            {pendingGrades > 0 && (
              <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.69rem', fontWeight: 700, padding: '1px 8px', borderRadius: 99, lineHeight: 1.7, marginTop: -14 }}>
                {pendingGrades}
              </span>
            )}
          </div>
          <div
            className="td-sub"
            onClick={() => pendingGrades > 0 && dispatch(setActiveTab('assignments'))}
            style={{ border: '1.5px dashed #d1d5db', borderRadius: 10, padding: '14px 16px', cursor: pendingGrades > 0 ? 'pointer' : 'default', background: '#fff', transition: 'background .15s' }}
          >
            <p style={{ fontSize: '0.84rem', color: '#6b7280' }}>
              {pendingGrades === 0
                ? 'No pending submissions · All caught up!'
                : `${pendingGrades} ungraded submission${pendingGrades !== 1 ? 's' : ''} pending · Click to grade`}
            </p>
          </div>
        </div>
      </div>

      <div>
        <H2>Leaderboard — {firstBatch}</H2>
        <Leaderboard students={students} />

        <div style={{ marginTop: 24 }}>
          <H2>Workshop Overview</H2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: '#f5f3ff', border: '1px solid #e0e7ff', borderRadius: 10, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#6366f1' }}>{workshopStats?.total || 0}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Total Batches</div>
            </div>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a' }}>{workshopStats?.completed || 0}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Completed</div>
            </div>
            <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 10, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706' }}>{workshopStats?.active || 0}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Active</div>
            </div>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb' }}>{workshopParticipantsCount}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Participants</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SESSIONS TAB
// ═══════════════════════════════════════════════════════════════════════════════

const SessionsTab = () => {
  const dispatch = useDispatch();
  const sessions = useSelector(selectTrainerSessions);
  const status   = useSelector(selectSessionsStatus);

  useEffect(() => { dispatch(fetchTrainerSessions()); }, [dispatch]);

  if (status === 'loading' && !sessions.length) return <Spinner />;
  if (!sessions.length)     return <Empty icon="📅" msg="No sessions found" />;

  const live = sessions.filter(s => effectiveSessionStatus(s) === 'live');
  const upcoming = sessions.filter(s => effectiveSessionStatus(s) === 'scheduled');
  const pastList = sessions.filter(s => {
    const st = effectiveSessionStatus(s);
    return st === 'completed' || st === 'cancelled';
  });

  return (
    <div>
      {live.length     > 0 && <><GrpLbl>🔴 Live Now</GrpLbl> {live.map(s     => <SessionCard key={s._id} session={s} isLive={true} />)}</>}
      {upcoming.length > 0 && <><GrpLbl>Upcoming</GrpLbl>     {upcoming.map(s => <SessionCard key={s._id} session={s} isLive={false} />)}</>}
      {pastList.length > 0 && <><GrpLbl>Past Sessions</GrpLbl> {pastList.map(s => <SessionCard key={s._id} session={s} isLive={false} />)}</>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGNMENTS TAB
// ═══════════════════════════════════════════════════════════════════════════════

const AssignmentsTab = () => {
  const dispatch    = useDispatch();
  const assignments = useSelector(selectTrainerAssignments);
  const status      = useSelector(selectAssignmentsStatus);

  useEffect(() => { dispatch(fetchTrainerAssignments()); }, [dispatch]);

  if (status === 'loading') return <Spinner />;
  if (!assignments.length)  return <Empty icon="📋" msg="No assignments found" />;

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {assignments.map((a) => {
        const pending = (a.submissions || []).filter(s => s.grade == null).length;
        return (
          <div key={a._id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#111827', marginBottom: 3 }}>{a.title}</div>
                <div style={{ fontSize: '0.76rem', color: '#6b7280' }}>
                  Due: {fmtDate(a.dueDate)} · {a.batchId?.name || a.batchId || '—'}
                </div>
              </div>
              {pending > 0 && <Pill bg="#fefce8" color="#d97706">{pending} pending</Pill>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => dispatch(openGradingModal(a))}
                className="td-btn"
                style={{ background: '#1e293b', color: '#fff', border: 'none', padding: '7px 16px', borderRadius: 7, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'opacity .15s' }}
              >
                Grade Submissions
              </button>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                {(a.submissions || []).length} submitted
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TRAINEE DETAIL
// ═══════════════════════════════════════════════════════════════════════════════

const TraineeDetail = ({ trainee, onBack, idx = 0 }) => {
  if (!trainee) return null;

  const c = COLORS[idx % COLORS.length];

  const batchName = trainee.batchId?.name || (typeof trainee.batchId === 'string' ? trainee.batchId : null);
  const ready     = trainee.placementStatus === 'ready' || trainee.isPlacementReady;

  // const facts = [
  //   ['Email',            trainee.email],
  //   ['Phone',            trainee.phone || trainee.mobile],
  //   ['Batch',            batchName],
  //   ['Average Score',    score != null ? score : null],
  //   ['Attendance',       trainee.attendance != null ? `${trainee.attendance}%` : null],
  //   ['Assignments Done', trainee.assignmentsCompleted ?? trainee.completedAssignments],
  //   ['Joined',           trainee.joinedAt ? fmtDate(trainee.joinedAt) : null],
  //   ['Status',           trainee.status],
  // ].filter(([, v]) => v != null && v !== '');
  const facts = [
  ['Name', trainee.name],
  ['Email', trainee.email],
  ['Phone', trainee.phone],
  ['Gender', trainee.gender],

  ['Address', trainee.address],
  ['City', trainee.city],
  ['State', trainee.state],
  ['Country', trainee.country],
  ['Pincode', trainee.pincode],

  ['College', trainee.collegeName],
  ['Degree', trainee.degree],
  ['Branch', trainee.branch],

  ['Placement Status', trainee.placementStatus],
  ['Company', trainee.companyName],
  ['CTC', trainee.ctc],

  ['LinkedIn', trainee.linkedIn],
  ['GitHub', trainee.github],
  ['Portfolio', trainee.portfolioUrl],

  ['Bio', trainee.bio],

  [
    'Batches',
    trainee.batchIds?.map(b => b.name).join(', ')
  ],

  [
    'Skills',
    trainee.skills?.length
      ? trainee.skills.join(', ')
      : 'N/A'
  ],

  ['Created At', fmtDate(trainee.createdAt)],
  ['Last Updated', fmtDate(trainee.updatedAt)],
]
.filter(([, value]) => value !== undefined && value !== null);

return (

  <div style={{ animation: 'fadeUp .25s ease' }}>
    <button
      onClick={onBack}
      className="td-btn"
      style={{
        background: '#fff',
        color: '#6366f1',
        border: '1px solid #e0e7ff',
        padding: '8px 16px',
        borderRadius: 10,
        fontSize: '0.8rem',
        fontWeight: 600,
        cursor: 'pointer',
        marginBottom: 20,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        boxShadow: '0 2px 8px rgba(99,102,241,.08)'
      }}
    >
      ← Back to all trainees
    </button>
{/* Profile Header */}
<div
  style={{
    background: `linear-gradient(135deg, ${c}, #8b5cf6)`,
    borderRadius: 20,
    padding: 28,
    color: '#fff',
    marginBottom: 24,
    boxShadow: '0 10px 30px rgba(99,102,241,.15)'
  }}
>
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      flexWrap: 'wrap'
    }}
  >
    <div
      style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: 'rgba(255,255,255,.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '2rem',
        fontWeight: 700,
        color: '#fff',
        border: '3px solid rgba(255,255,255,.25)'
      }}
    >
      {(trainee.name || 'T')[0].toUpperCase()}
    </div>

    <div>
      <h2
        style={{
          margin: 0,
          fontSize: '1.5rem',
          fontWeight: 700
        }}
      >
        {trainee.name}
      </h2>

      <div
        style={{
          marginTop: 6,
          opacity: 0.9,
          fontSize: '.95rem'
        }}
      >
        {trainee.email}
      </div>
    </div>

    <div
      style={{
        marginLeft: 'auto',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8
      }}
    >
      {batchName && (
        <Pill
          bg="rgba(255,255,255,.18)"
          color="#fff"
        >
          {batchName}
        </Pill>
      )}

      <Pill
        bg="rgba(255,255,255,.18)"
        color="#fff"
      >
        Score -
      </Pill>

      {ready && (
        <Pill
          bg="#dcfce7"
          color="#15803d"
        >
          ✓ Placement Ready
        </Pill>
      )}
    </div>
  </div>
</div>

{/* Stats */}
<div
  style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
    gap: 16,
    marginBottom: 24
  }}
>
  <div
    style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 16,
      padding: 18
    }}
  >
    <div style={{ fontSize: '.75rem', color: '#9ca3af' }}>
      STATUS
    </div>
    <div
      style={{
        fontWeight: 700,
        fontSize: '1rem',
        marginTop: 6
      }}
    >
      {trainee.placementStatus || 'Enrolled'}
    </div>
  </div>

  <div
    style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 16,
      padding: 18
    }}
  >
    <div style={{ fontSize: '.75rem', color: '#9ca3af' }}>
      BATCHES
    </div>
    <div
      style={{
        fontWeight: 700,
        fontSize: '1rem',
        marginTop: 6
      }}
    >
      {trainee.batchIds?.length || 0}
    </div>
  </div>

  <div
    style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 16,
      padding: 18
    }}
  >
    <div style={{ fontSize: '.75rem', color: '#9ca3af' }}>
      SKILLS
    </div>
    <div
      style={{
        fontWeight: 700,
        fontSize: '1rem',
        marginTop: 6
      }}
    >
      {trainee.skills?.length || 0}
    </div>
  </div>
</div>

{/* Trainee Information */}
<div
  style={{
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 20,
    overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(0,0,0,.04)'
  }}
>
  <div
    style={{
      padding: '18px 22px',
      borderBottom: '1px solid #f1f5f9',
      background: '#fafafa',
      fontWeight: 700,
      fontSize: '1rem'
    }}
  >
    👨‍🎓 Trainee Information
  </div>

  {facts.length === 0 ? (
    <Empty
      icon="📄"
      msg="No additional details available"
    />
  ) : (
    <div
      style={{
        padding: 20,
        display: 'grid',
        gridTemplateColumns:
          'repeat(auto-fit,minmax(240px,1fr))',
        gap: 16
      }}
    >
      {facts.map(([label, value]) => (
        <div
          key={label}
          style={{
            background: '#f8fafc',
            border: '1px solid #e5e7eb',
            borderRadius: 16,
            padding: 18,
            transition: 'all .2s ease'
          }}
        >
          <div
            style={{
              fontSize: '.72rem',
              fontWeight: 700,
              color: '#6366f1',
              textTransform: 'uppercase',
              letterSpacing: '.6px',
              marginBottom: 8
            }}
          >
            {label}
          </div>

          <div
            style={{
              color: '#111827',
              fontWeight: 600,
              fontSize: '.95rem',
              wordBreak: 'break-word'
            }}
          >
            {value || '-'}
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

  </div>
);

};

// ═══════════════════════════════════════════════════════════════════════════════
// STUDENTS TAB
// ═══════════════════════════════════════════════════════════════════════════════

const StudentsTab = () => {
  const dispatch = useDispatch();
  const students = useSelector(selectTrainerStudents);
  const status   = useSelector(selectStudentsStatus);

  const [q, setQ]               = useState('');
  const [page, setPage]         = useState(1);
  const [selected, setSelected] = useState(null);
  const [selIdx, setSelIdx]     = useState(0);

  useEffect(() => { dispatch(fetchTrainerStudents()); }, [dispatch]);
  useEffect(() => { setPage(1); }, [q]);

  if (status === 'loading') return <Spinner />;

  if (selected) {
    return <TraineeDetail trainee={selected} idx={selIdx} onBack={() => setSelected(null)} />;
  }

  const list = students.filter(s =>
    (s.name  || '').toLowerCase().includes(q.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(q.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const start      = (safePage - 1) * PAGE_SIZE;
  const pageItems  = list.slice(start, start + PAGE_SIZE);

  const openTrainee = (st, i) => { setSelected(st); setSelIdx(i); };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <H2>All Trainees <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#9ca3af' }}>({students.length})</span></H2>
        {q && <span style={{ fontSize: '0.76rem', color: '#9ca3af' }}>{list.length} match{list.length === 1 ? '' : 'es'}</span>}
      </div>

      <input
        value={q} onChange={e => setQ(e.target.value)}
        placeholder="Search trainees by name or email…"
        style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 14px', fontSize: '0.85rem', color: '#111827', marginBottom: 16, fontFamily: 'inherit' }}
      />

      {students.length === 0 ? (
        <Empty icon="🎓" msg="No trainees found" />
      ) : list.length === 0 ? (
        <Empty icon="🔍" msg="No trainees match your search" />
      ) : (
        <>
          <div className="td-trainees">
            {pageItems.map((st, i) => {
              const globalIdx = start + i;
              const score = st.averageScore ?? st.score ?? null;
              const c = COLORS[globalIdx % COLORS.length];
              const l = LIGHTS[globalIdx % LIGHTS.length];
              return (
                <div
                  key={st._id || globalIdx}
                  className="td-card"
                  onClick={() => openTrainee(st, globalIdx)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && openTrainee(st, globalIdx)}
                  style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, background: '#fff', cursor: 'pointer', transition: 'box-shadow .15s' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem', color: '#fff', flexShrink: 0 }}>
                      {(st.name || 'S')[0].toUpperCase()}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.name}</div>
                      <div style={{ fontSize: '0.69rem', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.email}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {(st.batchId?.name || (typeof st.batchId === 'string' && st.batchId)) && (
                      <Pill bg={l} color={c}>{st.batchId?.name || st.batchId}</Pill>
                    )}
                    {score != null && (
                      <Pill bg={score >= 75 ? '#dcfce7' : score >= 55 ? '#fef9c3' : '#fee2e2'} color={scoreCol(score)}>
                        Score {score}
                      </Pill>
                    )}
                    {st.attendance != null && <Pill bg="#f3f4f6" color="#374151">Att {st.attendance}%</Pill>}
                    {(st.placementStatus === 'ready' || st.isPlacementReady) && (
                      <Pill bg="#dcfce7" color="#15803d">✓ Placement Ready</Pill>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="td-pager">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} style={pgBtn(safePage === 1)}>← Prev</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => {
                const active = n === safePage;
                return (
                  <button key={n} onClick={() => setPage(n)}
                    style={{ minWidth: 34, padding: '7px 10px', borderRadius: 8, border: `1px solid ${active ? '#6366f1' : '#e5e7eb'}`, background: active ? '#6366f1' : '#fff', color: active ? '#fff' : '#6b7280', fontWeight: active ? 700 : 500, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .12s' }}>
                    {n}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} style={pgBtn(safePage === totalPages)}>Next →</button>
            </div>
          )}

          <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#9ca3af', marginTop: 10 }}>
            Showing {start + 1}–{Math.min(start + PAGE_SIZE, list.length)} of {list.length}
          </div>
        </>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TAB CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: 'overview',    label: 'Overview'    },
  { id: 'sessions',    label: 'Sessions'    },
  { id: 'assignments', label: 'Assignments' },
  { id: 'students',    label: 'Trainee'   },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const TrainerDashboard = () => {
  const dispatch  = useDispatch();

  const dashboard = useSelector(selectTrainerDashboard);
  const status    = useSelector(selectTrainerStatus);
  const error     = useSelector(selectTrainerError);
  const activeTab = useSelector(selectActiveTab);
  const modal     = useSelector(selectGradingModal);
  const students  = useSelector(selectTrainerStudents);

  useEffect(() => { dispatch(fetchTrainerDashboard()); }, [dispatch]);
  useEffect(() => { dispatch(fetchTrainerStudents());  }, [dispatch]);

  const trainerName    = dashboard?.trainer?.name       ?? dashboard?.trainerName    ?? 'Trainer';
  const trainerBatches = dashboard?.trainer?.batchGroup ?? dashboard?.batchGroupName ?? 'YBLP Batches';
  const trainerRole    = dashboard?.trainer?.role       ?? dashboard?.role           ?? 'isMentor';
  const isActive       = dashboard?.trainer?.isActive   ?? dashboard?.isActive       ?? true;
  const liveSessions   = dashboard?.liveSessions || [];

  const tabContent = {
    overview:    <OverviewTab dashboard={dashboard} students={students} />,
    sessions:    <SessionsTab />,
    assignments: <AssignmentsTab />,
    students:    <StudentsTab />,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: "'Inter', system-ui, sans-serif", color: '#111827' }}>
      <style>{CSS}</style>

      <div className="td-wrap" style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: 28, animation: 'fadeUp .35s ease' }}>
          <h1 className="td-h1" style={{ fontSize: '1.65rem', fontWeight: 800, color: '#111827', letterSpacing: '-0.5px', marginBottom: 7 }}>
            Trainer Dashboard
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.84rem', color: '#6b7280' }}>
              {trainerName} · {trainerBatches} · {trainerRole}:
            </span>
            {isActive
              ? <Pill bg="#dcfce7" color="#15803d" dot>Active</Pill>
              : <Pill bg="#fee2e2" color="#b91c1c" dot>Inactive</Pill>
            }
            {liveSessions.length > 0 && (
              <Pill bg="#fee2e2" color="#dc2626">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', animation: 'pulse 1s infinite' }} />
                {liveSessions.length} Live
              </Pill>
            )}
          </div>
        </div>

        {error && status === 'failed' && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '11px 14px', marginBottom: 20, fontSize: '0.79rem', color: '#b91c1c', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0 }}>⚠️</span>
            <div><strong>API Error:</strong> {error}</div>
          </div>
        )}

        <div className="td-tabs" style={{ display: 'flex', gap: 2, borderBottom: '1px solid #e5e7eb', marginBottom: 28 }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className="td-tab"
                onClick={() => dispatch(setActiveTab(tab.id))}
                style={{
                  padding: '9px 18px', border: 'none',
                  borderRadius: '6px 6px 0 0',
                  borderBottom: active ? '2.5px solid #6366f1' : '2.5px solid transparent',
                  background: 'transparent',
                  color:  active ? '#6366f1' : '#6b7280',
                  fontWeight: active ? 700 : 500,
                  fontSize: '0.85rem', cursor: 'pointer',
                  transition: 'all .15s', marginBottom: -1,
                  fontFamily: 'inherit',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {status === 'loading' && !dashboard ? (
          <Spinner />
        ) : (
          <div style={{ animation: 'fadeUp .25s ease' }}>
            {tabContent[activeTab]}
          </div>
        )}
      </div>

      {modal && <GradingModal />}
    </div>
  );
};

export default TrainerDashboard;