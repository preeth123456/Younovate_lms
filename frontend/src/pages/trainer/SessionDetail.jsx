import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';

import {
  fetchSessions,
  createSession,
  updateSession,
  deleteSession,
  selectAllSessions,
  selectSessionsStatus,
} from '../../features/session/sessionsSlice';

import {
  fetchBatches,
  selectAllBatches,
} from '../../features/session/batchSlice';

import { todayDateInput, nowTimeInput, isPastDateTime } from '../../utils/dateTime';
import WatchRecordingButton from '../../components/recording/WatchRecordingButton';

// Attendance comes through the EXISTING trainer slice (same thunk/selectors the
// Trainer → Attendance page uses). No new slice, no store wiring, no extra API.
import {
  fetchSessionAttendance,
  selectAttendance,
  selectAttendanceStatus,
} from '../../features/Trainer/trainerSlice';

// ═══════════════════════════════════════════════════════════════════════════════
// Self-contained helpers (kept local so this page has no import coupling)
// ═══════════════════════════════════════════════════════════════════════════════

const SESSION_TYPES  = ['S1', 'S2', 'S3', 'S4', 'S5'];
const EDIT_STATUSES  = ['scheduled', 'live', 'completed', 'cancelled'];
const SESSION_COLORS = { S1: '#6366f1', S2: '#0ea5e9', S3: '#10b981', S4: '#f59e0b', S5: '#8b5cf6' };

// Statuses that lock the record from further edits/deletes.
const LOCKED_STATUSES = ['completed'];

const toDateInput = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};
const rawDate    = (s) => s.scheduledAt || s.date || s.startTime;
const isLive     = (s) => s.status === 'live' || s.status === 'ongoing';
const sessTypeOf = (s) => s.sessionType || (s.title && SESSION_TYPES.find(t => s.title.includes(t))) || null;
const sessColor  = (s) => (isLive(s) ? '#dc2626' : (SESSION_COLORS[sessTypeOf(s)] || '#1e293b'));
const fmtTime    = (raw) => { if (!raw) return ''; const d = new Date(raw); return isNaN(d) ? '' : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
const fmtDateLong= (raw) => { const d = new Date(raw); return isNaN(d) ? '—' : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); };

// Attendance display helpers
const ATT_PAL = {
  present: { label: 'Present', color: '#15803d', bg: '#dcfce7' },
  late:    { label: 'Late',    color: '#b45309', bg: '#fef3c7' },
  partial: { label: 'Partial', color: '#1d4ed8', bg: '#dbeafe' },
  absent:  { label: 'Absent',  color: '#b91c1c', bg: '#fee2e2' },
  excused: { label: 'Excused', color: '#475569', bg: '#f1f5f9' },
};
const fmtDuration = (sec) => {
  const s = Number(sec);
  if (!s || s < 1) return '—';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};
const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';
const avatarColor = (name = '') => {
  const palette = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
};

const inputSt = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: '0.85rem', color: '#111827', background: '#fff', fontFamily: 'inherit' };
const selSt   = { ...inputSt, appearance: 'none', WebkitAppearance: 'none', paddingRight: 32, cursor: 'pointer' };

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  .sd-btn:hover { opacity: .87; }
  input:focus, select:focus, textarea:focus {
    outline: none !important; border-color: #6366f1 !important;
    box-shadow: 0 0 0 3px rgba(99,102,241,.12) !important;
  }
  @media (max-width: 600px) {
    .sd-grid3 { grid-template-columns: 1fr !important; }
    .sd-grid2 { grid-template-columns: 1fr !important; }
  }

  /* Attendance rows — mobile responsive */
  .sd-att-row  { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 11px 0; border-bottom: 1px solid #f4f6fa; }
  .sd-att-meta { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  @media (max-width: 600px) {
    .sd-att-meta { width: 100%; justify-content: space-between; gap: 8px; }
  }
`;

const FL = ({ children }) => (
  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 7 }}>{children}</label>
);
const ErrBox = ({ msg }) => msg ? (
  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, padding: '9px 12px', fontSize: '0.78rem', color: '#b91c1c', marginBottom: 12 }}>⚠️ {msg}</div>
) : null;
const InfoBox = ({ msg }) => msg ? (
  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7, padding: '9px 12px', fontSize: '0.78rem', color: '#475569', marginBottom: 12 }}>🔒 {msg}</div>
) : null;
const Spinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
    <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#1e293b', animation: 'spin .7s linear infinite' }} />
  </div>
);
const chev = (
  <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: '0.7rem', pointerEvents: 'none' }}>▾</span>
);

const Shell = ({ children }) => (
  <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', system-ui, sans-serif", color: '#111827' }}>
    <style>{CSS}</style>
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>{children}</div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// ATTENDANCE PANEL  (view mode) — who actually attended the live session
//   Redux-driven: dispatches fetchSessionAttendance(sessionId) and reads the
//   cached records from the trainer slice. Records carry the captured
//   joinedAt / leftAt / attendedSeconds / status (present·late·partial·absent).
// ═══════════════════════════════════════════════════════════════════════════════

const AttendanceRow = ({ r }) => {
  const name  = r.trainee?.name || 'Trainee';
  const email = r.trainee?.email || '';
  const pal   = ATT_PAL[r.status] || ATT_PAL.absent;
  const join  = r.joinedAt ? fmtTime(r.joinedAt) : '—';
  const leave = r.leftAt ? fmtTime(r.leftAt) : '—';
  return (
    <div className="sd-att-row">
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
        <span style={{ width: 34, height: 34, borderRadius: '50%', background: avatarColor(name), color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.74rem', fontWeight: 700, flexShrink: 0 }}>
          {initials(name)}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#111827' }}>{name}</div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{email}</div>
        </div>
      </div>
      <div className="sd-att-meta">
        <span style={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap' }}>
          🕒 {join} → {leave}{r.attendedSeconds ? ` · ${fmtDuration(r.attendedSeconds)}` : ''}
        </span>
        <span style={{ fontSize: '0.66rem', fontWeight: 700, color: pal.color, background: pal.bg, padding: '3px 10px', borderRadius: 999, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
          {pal.label}
        </span>
      </div>
    </div>
  );
};

const AttendancePanel = ({ sessionId }) => {
  const dispatch      = useDispatch();
  const attendanceMap = useSelector(selectAttendance);       // { [sessionId]: { records } }
  const attStatusMap  = useSelector(selectAttendanceStatus); // { [sessionId]: 'loading'|... }

  // Fetch (and refresh) this session's attendance through Redux.
  useEffect(() => {
    if (sessionId) dispatch(fetchSessionAttendance(sessionId));
  }, [sessionId, dispatch]);

  const entry   = attendanceMap?.[sessionId];
  const records = useMemo(() => {
    const list = entry?.records || entry?.data?.records || [];
    return Array.isArray(list) ? list : [];
  }, [entry]);

  const st      = attStatusMap?.[sessionId];
  const loading = st === 'loading' || st === undefined;
  const failed  = st === 'failed';

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, partial: 0, absent: 0 };
    records.forEach((r) => { if (c[r.status] !== undefined) c[r.status]++; });
    return c;
  }, [records]);

  return (
    <div style={{ marginTop: 22, borderTop: '1px solid #eef2f7', paddingTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Attendance {records.length > 0 ? `(${records.length})` : ''}
        </div>
        {records.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['present', 'late', 'partial', 'absent'].map((k) => (
              <span key={k} style={{ fontSize: '0.66rem', fontWeight: 700, color: ATT_PAL[k].color, background: ATT_PAL[k].bg, padding: '3px 9px', borderRadius: 999 }}>
                {counts[k]} {ATT_PAL[k].label}
              </span>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ fontSize: '0.82rem', color: '#9ca3af', padding: '12px 0' }}>Loading attendance…</div>
      ) : failed ? (
        <ErrBox msg="Could not load attendance." />
      ) : records.length === 0 ? (
        <div style={{ fontSize: '0.84rem', color: '#9ca3af', background: '#f8fafc', border: '1px dashed #e5e7eb', borderRadius: 10, padding: '20px 16px', textAlign: 'center' }}>
          No trainee has attended this session yet. Records appear automatically when trainees join the live room.
        </div>
      ) : (
        <div>
          {records.map((r) => <AttendanceRow key={r._id || r.trainee?._id} r={r} />)}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION DETAIL  —  routed page (view · edit · create)
//
// Register three routes that render this with a `mode` prop:
//   /trainer/sessions/new          → <SessionDetail mode="create" />
//   /trainer/sessions/:id          → <SessionDetail mode="view" />
//   /trainer/sessions/:id/edit     → <SessionDetail mode="edit" />
// ═══════════════════════════════════════════════════════════════════════════════

const SessionDetail = ({ mode = 'view' }) => {
  const { id }   = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const sessions = useSelector(selectAllSessions);
  const status   = useSelector(selectSessionsStatus);
  const batches  = useSelector(selectAllBatches);
  const authToken = useSelector(s => s.auth?.token || '');

  const isCreate = mode === 'create' || id === 'new';
  const session  = useMemo(() => sessions.find(s => s._id === id) || null, [sessions, id]);

  // A completed session is locked: no editing, no deleting.
  const locked = !isCreate && !!session && LOCKED_STATUSES.includes(session.status);

  // Make sure data exists on direct load / refresh.
  useEffect(() => { if (!isCreate && !session) dispatch(fetchSessions()); }, [isCreate, session, dispatch]);
  useEffect(() => { if (mode !== 'view') dispatch(fetchBatches()); }, [mode, dispatch]);

  const buildForm = () => {
    if (session && !isCreate) {
      const r = rawDate(session); const d = r ? new Date(r) : new Date(); const ok = !isNaN(d);
      return {
        batchName:    session.batchId?.name || session.batchName || session.batch || '',
        title:        session.moduleId || session.title || '',
        sessType:     sessTypeOf(session) || 'S1',
        date:         ok ? toDateInput(d) : toDateInput(new Date()),
        time:         ok ? d.toTimeString().slice(0, 5) : '10:00',
        duration:     session.durationMinutes || 60,
        status:       session.status || 'scheduled',
        roomName:     session.roomName || '',
        recordingUrl: session.recordingUrl || '',
        description:  session.description || '',
      };
    }
    return { batchName: '', title: '', sessType: 'S1', date: toDateInput(new Date()), time: '10:00', duration: 60, status: 'scheduled', roomName: '', recordingUrl: '', description: '' };
  };

  const [f, setF]       = useState(buildForm);
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState(null);
  const set = (k) => (e) => setF(prev => ({ ...prev, [k]: e.target.value }));

  // Re-seed the form once the session arrives after a fetch (view/edit deep-link).
  useEffect(() => { if (!isCreate && session) setF(buildForm()); /* eslint-disable-next-line */ }, [session?._id]);

  const backToList = () => navigate('..', { relative: 'path' });

  const handleSave = async (e) => {
    e.preventDefault();
    if (locked) { setErr('This session is completed and can no longer be edited.'); return; }

    const today = todayDateInput();
    if (f.date < today || (f.date === today && isPastDateTime(f.date, f.time))) {
      setErr('Session date and time cannot be in the past.');
      return;
    }

    setBusy(true); setErr(null);
    const scheduledAt = new Date(`${f.date}T${f.time}:00`).toISOString();
    const payload = {
      batch:           f.batchName || undefined,
      title:           f.title,
      moduleId:        f.title,
      sessionType:     f.sessType,
      scheduledAt,
      durationMinutes: Number(f.duration) || 60,
      status:          f.status,
      roomName:        f.roomName,
      recordingUrl:    f.recordingUrl || undefined,
      description:     f.description,
    };
    const result = await dispatch(isCreate ? createSession(payload) : updateSession({ id, ...payload }));
    setBusy(false);
    const ok = (isCreate ? createSession.fulfilled : updateSession.fulfilled).match(result);
    if (ok) { await dispatch(fetchSessions()); navigate(-1); }
    else { setErr(result.payload || 'Save failed'); }
  };

  const handleDelete = async () => {
    if (locked) return;
    if (!window.confirm('Delete this session permanently? This cannot be undone.')) return;
    setBusy(true);
    const result = await dispatch(deleteSession(id));
    setBusy(false);
    if (deleteSession.fulfilled.match(result)) { await dispatch(fetchSessions()); backToList(); }
  };

  const BackBtn = () => (
    <button onClick={backToList} className="sd-btn"
      style={{ background: 'transparent', border: 'none', color: '#6b7280', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 18, fontFamily: 'inherit' }}>
      ‹ Back to sessions
    </button>
  );

  // ── Loading / not-found ────────────────────────────────────────────────────
  if (!isCreate && !session && status === 'loading') return <Shell><Spinner /></Shell>;
  if (!isCreate && !session) {
    return (
      <Shell>
        <BackBtn />
        <div style={{ border: '1px dashed #e5e7eb', borderRadius: 14, background: '#fff', padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' }}>
          Session not found. It may have been deleted.
        </div>
      </Shell>
    );
  }

  // ── VIEW MODE ───────────────────────────────────────────────────────────────
  if (mode === 'view' && !isCreate) {
    const color     = sessColor(session);
    const type      = sessTypeOf(session);
    const topics    = Array.isArray(session.topics) ? session.topics : [];
    const resources = Array.isArray(session.resources) ? session.resources : [];
    const Meta = ({ label, value }) => (
      <div>
        <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827' }}>{value}</div>
      </div>
    );
    return (
      <Shell>
        <BackBtn />
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 16, background: '#fff', overflow: 'hidden', animation: 'fadeUp .25s ease' }}>
          <div style={{ height: 6, background: color }} />
          <div style={{ padding: '22px 26px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#111827' }}>{session.moduleId || session.title || 'Session'}</h1>
                {type && <span style={{ fontSize: '0.7rem', fontWeight: 700, color, background: color + '1A', padding: '3px 9px', borderRadius: 6 }}>{type}</span>}
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: isLive(session) ? '#fff' : '#475569', background: isLive(session) ? '#dc2626' : '#f1f5f9', padding: '3px 9px', borderRadius: 999, textTransform: 'capitalize' }}>{session.status || 'scheduled'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginBottom: 22 }}>
              <Meta label="Date" value={fmtDateLong(rawDate(session))} />
              <Meta label="Time" value={`${fmtTime(rawDate(session)) || '—'}${session.durationMinutes ? ` · ${session.durationMinutes} min` : ''}`} />
              <Meta label="Batch" value={session.batchId?.name || session.batchName || session.batch || '—'} />
              {session.roomName ? <Meta label="Room" value={session.roomName} /> : null}
            </div>

            <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Description</div>
            <p style={{ fontSize: '0.9rem', color: session.description?.trim() ? '#1f2937' : '#9ca3af', lineHeight: 1.6, marginBottom: 20 }}>
              {session.description?.trim() ? session.description : 'No description added for this session.'}
            </p>

            {topics.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Topics</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {topics.map((t, i) => <span key={i} style={{ fontSize: '0.74rem', color: '#3730a3', background: '#eef2ff', padding: '4px 10px', borderRadius: 999 }}>{typeof t === 'string' ? t : (t.name || t.title || '')}</span>)}
                </div>
              </div>
            )}

            {(resources.length > 0 || session.recordingUrl) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 22 }}>
                {resources.map((r, i) => {
                  const url = typeof r === 'string' ? r : (r.url || r.link);
                  const label = typeof r === 'string' ? r : (r.title || r.name || r.url || 'Resource');
                  return url ? <a key={i} href={url} target="_blank" rel="noreferrer" style={{ fontSize: '0.82rem', color: '#4338ca', textDecoration: 'none', fontWeight: 600 }}>📎 {label}</a> : null;
                })}
                {session.recordingUrl && (
                  <WatchRecordingButton
                    sessionId={session._id}
                    token={authToken}
                    workshop={session.sessionType === 'WORKSHOP'}
                    label="▶ Recording"
                    style={{ background: 'transparent', color: '#dc2626', padding: 0, fontSize: '0.82rem' }}
                  />
                )}
              </div>
            )}

            {/* ── Captured attendance for this session (Redux) ── */}
            <AttendancePanel sessionId={session._id} />

            <div style={{ display: 'flex', gap: 10, borderTop: '1px solid #eef2f7', paddingTop: 18, marginTop: 22, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => !locked && navigate('edit', { relative: 'path' })} disabled={locked} className="sd-btn"
                title={locked ? 'Completed sessions cannot be edited' : 'Edit session'}
                style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: locked ? '#94a3b8' : '#1e293b', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: locked ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                ✏️ Edit
              </button>
              <button onClick={handleDelete} disabled={busy || locked} className="sd-btn"
                title={locked ? 'Completed sessions cannot be deleted' : 'Delete session'}
                style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid #fecaca', background: '#fff', color: (busy || locked) ? '#cbd5e1' : '#dc2626', fontWeight: 700, fontSize: '0.85rem', cursor: (busy || locked) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', borderColor: locked ? '#e5e7eb' : '#fecaca' }}>
                {busy ? 'Deleting…' : '🗑 Delete'}
              </button>
              {locked && (
                <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600 }}>
                  🔒 This session is completed — editing and deleting are disabled.
                </span>
              )}
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  // ── CREATE / EDIT MODE ────────────────────────────────────────────────────────
  return (
    <Shell>
      <BackBtn />
      <form onSubmit={handleSave} style={{ border: '1px solid #e5e7eb', borderRadius: 16, background: '#fff', padding: '24px 26px', animation: 'fadeUp .25s ease' }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#111827', marginBottom: 22 }}>
          {isCreate ? 'Create Session' : 'Edit Session'}
        </h1>

        {locked && (
          <InfoBox msg="This session is completed. It is read-only — changes can't be saved." />
        )}

        <div style={{ marginBottom: 16 }}>
          <FL>Title / Module ID</FL>
          <input value={f.title} onChange={set('title')} style={inputSt} placeholder="e.g. M4-LMS-03 — S2" disabled={locked} required />
        </div>

        <div className="sd-grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <FL>Batch</FL>
            <div style={{ position: 'relative' }}>
              <select value={f.batchName} onChange={set('batchName')} style={selSt} disabled={locked} required>
                <option value="">— select batch —</option>
                {batches.map(b => <option key={b._id} value={b.name}>{b.name}</option>)}
              </select>
              {chev}
            </div>
          </div>
          <div>
            <FL>Status</FL>
            <div style={{ position: 'relative' }}>
              <select value={f.status} onChange={set('status')} style={{ ...selSt, textTransform: 'capitalize' }} disabled={locked}>
                {EDIT_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
              </select>
              {chev}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <FL>Session Type</FL>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {SESSION_TYPES.map(t => (
              <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.84rem', color: '#374151', cursor: locked ? 'not-allowed' : 'pointer' }}>
                <input type="radio" name="sessType" value={t} checked={f.sessType === t} onChange={() => setF(p => ({ ...p, sessType: t }))} disabled={locked} style={{ accentColor: '#6366f1', width: 15, height: 15 }} />
                {t}
              </label>
            ))}
          </div>
        </div>

          <div className="sd-grid3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
           <div><FL>Date</FL><input type="date" value={f.date} min={todayDateInput()} onChange={set('date')} style={inputSt} disabled={locked} required /></div>
           <div><FL>Time</FL><input type="time" value={f.time} min={f.date === todayDateInput() ? nowTimeInput() : ''} onChange={set('time')} style={inputSt} disabled={locked} required /></div>
           <div><FL>Duration (min)</FL><input type="number" min={15} step={5} value={f.duration} onChange={set('duration')} style={inputSt} disabled={locked} required /></div>
         </div>

        <div style={{ marginBottom: 16 }}>
          <FL>Room Name (optional)</FL>
          <input value={f.roomName} onChange={set('roomName')} style={inputSt} placeholder="Room / hall" disabled={locked} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <FL>Recording Link (optional)</FL>
          <input type="url" value={f.recordingUrl} onChange={set('recordingUrl')} style={inputSt} placeholder="https://…" disabled={locked} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <FL>Description</FL>
          <textarea value={f.description} onChange={set('description')} rows={4} style={{ ...inputSt, resize: 'vertical' }} placeholder="What will be covered…" disabled={locked} />
        </div>

        <ErrBox msg={err} />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={backToList} disabled={busy} className="sd-btn"
            style={{ flex: '1 1 120px', padding: '12px', borderRadius: 9, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button type="submit" disabled={busy || locked} className="sd-btn"
            style={{ flex: '2 1 200px', padding: '12px', borderRadius: 9, border: 'none', background: (busy || locked) ? '#94a3b8' : '#1e293b', color: '#fff', fontWeight: 700, fontSize: '0.88rem', cursor: (busy || locked) ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {busy ? 'Saving…' : (isCreate ? 'Create Session' : 'Save Changes')}
          </button>
        </div>
      </form>
    </Shell>
  );
};

export default SessionDetail;