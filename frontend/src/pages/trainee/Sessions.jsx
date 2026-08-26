// src/pages/trainee/Sessions.jsx
// Workshop Sessions (tab 1) + LMS Sessions (tab 2) — completely isolated.
import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import TraineeLiveSession from '../../features/session/TraineeLiveSession';
import {
  joinSession, leaveSession, clearConnection,
  selectJoinStatus, selectJoinError,
} from '../../features/sessions/sessionsSlice';
import {
  fetchMyWorkshopSessions, joinWorkshopSession, leaveWorkshopSession,
  clearWorkshopLive, clearJoinError,
  selectMyWorkshopSessions,
  selectTraineeLiveConnection,
  selectJoinStatus  as selectWsJoinStatus,
  selectJoinError   as selectWsJoinError,
  fetchMyLmsSessions,
  selectMyLmsSessions,
  selectLmsStatus,
  selectLmsError,
} from '../../features/trainee/traineeSlice';
import LiveRoom from '../../components/live/LiveRoom';

// ── helpers ───────────────────────────────────────────────────────────────────
const fmtDT = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBD';

function StatusBadge({ status }) {
  const map = {
    live:      { bg: '#FEE2E2', color: '#DC2626' },
    scheduled: { bg: '#DBEAFE', color: '#1D4ED8' },
    completed: { bg: '#D1FAE5', color: '#065F46' },
    cancelled: { bg: '#FEE2E2', color: '#991B1B' },
  };
  const s = (status || '').toLowerCase();
  const { bg, color } = map[s] || { bg: '#F1F5F9', color: '#475569' };
  return (
    <span style={{ background: bg, color, padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: 'capitalize', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {s === 'live' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#DC2626', display: 'inline-block' }} />}
      {status}
    </span>
  );
}

// Countdown hook — ticks every second, returns "" when joinable
function useCountdown(secondsUntilStart) {
  const [secs, setSecs] = useState(secondsUntilStart || 0);
  useEffect(() => {
    setSecs(secondsUntilStart || 0);
    if (!secondsUntilStart || secondsUntilStart <= 0) return;
    const t = setInterval(() => setSecs(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsUntilStart]);
  if (secs <= 0) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ── Workshop Session Card ─────────────────────────────────────────────────────
function WsSessionCard({ session, onJoin, joiningId, joinStatus }) {
  const countdown = useCountdown(session.secondsUntilStart);
  const isLive    = session.status === 'live';
  const isOver    = session.status === 'completed' || session.status === 'cancelled';
  // canJoin from backend; locally re-check via countdown reaching 0
  const joinable  = !isOver && (session.canJoin || (session.status === 'scheduled' && countdown === ''));
  const isJoining = joinStatus === 'loading' && joiningId === session._id;

  return (
    <div style={{ background: '#fff', border: isLive ? '2px solid #DC2626' : '1px solid #E2E8F0', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 1px 4px rgba(15,23,42,.06)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>{session.title}</div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>
            {session.workshopBatchId?.workshopId?.title || ''}{session.workshopBatchId?.batchName ? ` · ${session.workshopBatchId.batchName}` : ''}
          </div>
        </div>
        <StatusBadge status={session.status} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: '#64748B' }}>
        <span>📅 {fmtDT(session.scheduledAt)}</span>
        <span>⏱ {session.durationMinutes} min</span>
        {session.trainerId?.name && <span>👤 {session.trainerId.name}</span>}
      </div>

      {isOver ? (
        <div style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>
          {session.status === 'completed' ? '✅ Session completed' : '❌ Session cancelled'}
        </div>
      ) : joinable ? (
        <button
          onClick={() => onJoin(session._id)}
          disabled={isJoining}
          style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: isJoining ? 'wait' : 'pointer', opacity: isJoining ? 0.7 : 1 }}
        >
          {isJoining ? 'Joining…' : '● Join Session'}
        </button>
      ) : (
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>
            🕐 Session will be available when the scheduled time starts.
          </div>
          {countdown && (
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1D4ED8', marginTop: 4 }}>
              Starts in: {countdown}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TraineeSessions() {
  const dispatch = useDispatch();
  const [tab, setTab]         = useState('workshop');
  const [active, setActive]   = useState(null);
  const [joiningId, setJoiningId] = useState(null);

  // LMS
  const lmsSessions   = useSelector(selectMyLmsSessions);
  const lmsStatus     = useSelector(selectLmsStatus);
  const lmsError      = useSelector(selectLmsError);
  const lmsJoinStatus = useSelector(selectJoinStatus);
  const lmsJoinError  = useSelector(selectJoinError);

  // Workshop
  const wsSessions   = useSelector(selectMyWorkshopSessions);
  const wsLiveConn   = useSelector(selectTraineeLiveConnection);
  const wsJoinStatus = useSelector(selectWsJoinStatus);
  const wsJoinError  = useSelector(selectWsJoinError);
  const authToken    = useSelector(s => s.auth?.token || '');

  const load = useCallback(() => {
    dispatch(fetchMyLmsSessions());
    dispatch(fetchMyWorkshopSessions());
  }, [dispatch]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh workshop sessions every 30s (picks up status changes without manual refresh)
  useEffect(() => {
    const t = setInterval(() => dispatch(fetchMyWorkshopSessions()), 30000);
    return () => clearInterval(t);
  }, [dispatch]);

  // LMS join/leave
  const handleLmsJoin = async (session) => {
    setJoiningId(session._id);
    try {
      const conn = await dispatch(joinSession({ id: session._id })).unwrap();
      setActive({ session, connection: conn });
    } catch (_) {}
    setJoiningId(null);
  };
  const handleLmsLeave = () => {
    const id = active?.connection?.id || active?.session?._id;
    if (id) dispatch(leaveSession({ id }));
    dispatch(clearConnection());
    dispatch(fetchMyLmsSessions());
    setActive(null);
  };

  // Workshop join/leave
  const handleWsJoin = async (sessionId) => {
    setJoiningId(sessionId);
    try { await dispatch(joinWorkshopSession(sessionId)).unwrap(); } catch (_) {}
    setJoiningId(null);
  };
  const handleWsLeave = () => {
    if (wsLiveConn?.sessionId) dispatch(leaveWorkshopSession(wsLiveConn.sessionId));
    dispatch(clearWorkshopLive());
  };

  // Live room views
  if (active) return <TraineeLiveSession session={active.session} connection={active.connection} onLeave={handleLmsLeave} />;
  if (wsLiveConn?.token && wsLiveConn?.url) {
    return (
      <LiveRoom
        token={wsLiveConn.token}
        serverUrl={wsLiveConn.url}
        canPublish={true}
        title="Live Workshop Session"
        identityName="Trainee"
        sessionId={wsLiveConn.sessionId}
        sessionType="WORKSHOP"
        authToken={authToken}
        onLeave={handleWsLeave}
      />
    );
  }

  const liveSessions     = wsSessions.filter(s => s.status === 'live');
  const upcomingSessions = wsSessions.filter(s => {
    if (s.status !== 'scheduled') return false;
    const endsAt = new Date(s.scheduledAt).getTime() + (s.durationMinutes || 60) * 60000;
    return Date.now() < endsAt;
  });
  const pastSessions     = wsSessions.filter(s => s.status === 'completed' || s.status === 'cancelled');

  return (
    <div style={{ padding: 24, fontFamily: 'Public Sans, system-ui, sans-serif', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>My Sessions</h1>
        <button onClick={load} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#475569' }}>
          ↻ Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {[
          { key: 'workshop', label: `Workshop Sessions${wsSessions.length > 0 ? ` (${wsSessions.length})` : ''}` },
          { key: 'lms',      label: `LMS Sessions${lmsSessions.length > 0 ? ` (${lmsSessions.length})` : ''}` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
            background: tab === t.key ? '#1E3A5F' : 'transparent',
            color: tab === t.key ? '#fff' : '#64748B',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Workshop Sessions Tab ── */}
      {tab === 'workshop' && (
        <div>
          {wsJoinError && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#DC2626', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>⚠️ {wsJoinError}</span>
              <button onClick={() => dispatch(clearJoinError())} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontWeight: 700, fontSize: 16 }}>✕</button>
            </div>
          )}

          {wsSessions.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 48, textAlign: 'center', color: '#94A3B8' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📅</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#475569' }}>No workshop sessions yet</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Sessions will appear here once your batch trainer schedules them.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {liveSessions.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#DC2626' }}>🔴 Live Now</div>
                  {liveSessions.map(s => <WsSessionCard key={s._id} session={s} onJoin={handleWsJoin} joiningId={joiningId} joinStatus={wsJoinStatus} />)}
                </>
              )}
              {upcomingSessions.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#1D4ED8', marginTop: liveSessions.length ? 8 : 0 }}>📅 Upcoming</div>
                  {upcomingSessions.map(s => <WsSessionCard key={s._id} session={s} onJoin={handleWsJoin} joiningId={joiningId} joinStatus={wsJoinStatus} />)}
                </>
              )}
              {pastSessions.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#94A3B8', marginTop: 8 }}>✅ Past Sessions</div>
                  {pastSessions.map(s => <WsSessionCard key={s._id} session={s} onJoin={handleWsJoin} joiningId={joiningId} joinStatus={wsJoinStatus} />)}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── LMS Sessions Tab ── */}
      {tab === 'lms' && (
        <div>
          {(lmsStatus === 'loading' || lmsStatus === 'idle') && <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8' }}>Loading sessions…</div>}
          {lmsStatus === 'failed' && <div style={{ padding: 16, color: '#DC2626' }}>Error: {lmsError}</div>}
          {lmsJoinError && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#DC2626', fontSize: 13 }}>⚠️ {lmsJoinError}</div>
          )}
          {lmsStatus === 'succeeded' && lmsSessions.length === 0 && (
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 48, textAlign: 'center', color: '#94A3B8' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📚</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#475569' }}>No LMS sessions available.</div>
            </div>
          )}
          {lmsStatus === 'succeeded' && lmsSessions.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {lmsSessions.map(session => {
                const isLive    = session.status === 'live';
                const isOver    = session.status === 'completed' || session.status === 'cancelled';
                const isJoining = lmsJoinStatus === 'loading' && joiningId === session._id;
                return (
                  <div key={session._id} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>{session.title || 'Untitled Session'}</div>
                      <StatusBadge status={session.status} />
                    </div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>📅 {fmtDT(session.scheduledAt)} · 👤 {session.trainerId?.name || 'TBD'}</div>
                    {isOver && session.recordingUrl ? (
                      <a href={session.recordingUrl} target="_blank" rel="noreferrer"
                        style={{ background: '#475569', color: '#fff', borderRadius: 10, padding: '9px 16px', fontWeight: 700, fontSize: 13, textDecoration: 'none', textAlign: 'center' }}>
                        ▶ Watch Recording
                      </a>
                    ) : (
                      <button onClick={() => handleLmsJoin(session)} disabled={!isLive || isJoining}
                        style={{ background: isLive ? '#15803D' : '#E2E8F0', color: isLive ? '#fff' : '#94A3B8', border: 'none', borderRadius: 10, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: isLive ? 'pointer' : 'not-allowed', opacity: isJoining ? 0.7 : 1 }}>
                        {isJoining ? 'Joining…' : isLive ? '● Join Live' : 'Not live yet'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
