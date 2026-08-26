// src/pages/trainee/Dashboard.jsx
import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  fetchTraineeDashboard,
  fetchMyWorkshopBatches,
  fetchMyWorkshopSessions,
  fetchMyWorkshopAttendance,
  fetchMyWorkshopCertificates,
  joinWorkshopSession,
  leaveWorkshopSession,
  clearWorkshopLive,
  clearJoinError,
  selectTraineeDashboard,
  selectTraineeStatus,
  selectMyWorkshopBatches,
  selectMyWorkshopSessions,
  selectMyWorkshopAttendance,
  selectMyWorkshopCertificates,
  selectTraineeLiveConnection,
  selectJoinStatus,
  selectJoinError,
} from '../../features/trainee/traineeSlice';
import LiveRoom from '../../components/live/LiveRoom';

const C = { accent: '#4F46E5', green: '#059669', red: '#DC2626', amber: '#D97706', text1: '#111827', text3: '#6B7280', border: '#E5E7EB', card: '#fff' };
const card = { background: C.card, borderRadius: 12, padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,.06)', marginBottom: 16 };
const badge = (color, bg) => ({ background: bg, color, padding: '2px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700 });

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusPill({ status }) {
  const map = {
    live:      [C.red,   '#FEE2E2'],
    scheduled: [C.amber, '#FEF3C7'],
    completed: [C.green, '#DCFCE7'],
    Eligible:  [C.green, '#DCFCE7'],
    Issued:    [C.accent,'#EEF2FF'],
    Pending:   [C.text3, '#F3F4F6'],
    Present:   [C.green, '#DCFCE7'],
    Late:      [C.amber, '#FEF3C7'],
    Partial:   [C.accent,'#EEF2FF'],
    Absent:    [C.text3, '#F3F4F6'],
  };
  const [color, bg] = map[status] || [C.text3, '#F3F4F6'];
  return <span style={badge(color, bg)}>{status}</span>;
}

export default function TraineeDashboard() {
  const dispatch      = useAppDispatch();
  const data          = useAppSelector(selectTraineeDashboard);
  const status        = useAppSelector(selectTraineeStatus);
  const batches       = useAppSelector(selectMyWorkshopBatches);
  const sessions      = useAppSelector(selectMyWorkshopSessions);
  const attendance    = useAppSelector(selectMyWorkshopAttendance);
  const certificates  = useAppSelector(selectMyWorkshopCertificates);
  const liveConn      = useAppSelector(selectTraineeLiveConnection);
  const joinStatus    = useAppSelector(selectJoinStatus);
  const joinError     = useAppSelector(selectJoinError);
  const authToken     = useAppSelector(s => s.auth?.token || '');

  useEffect(() => {
    dispatch(fetchTraineeDashboard());
    dispatch(fetchMyWorkshopBatches());
    dispatch(fetchMyWorkshopSessions());
    dispatch(fetchMyWorkshopAttendance());
    dispatch(fetchMyWorkshopCertificates());
  }, [dispatch]);

  const hasLiveWorkshop = sessions.some(s => s.status === 'live') || Boolean(liveConn?.sessionId);

  // Refresh workshop attendance while a session is live (auto-updates after join/leave)
  useEffect(() => {
    if (!hasLiveWorkshop) return undefined;
    const timer = setInterval(() => dispatch(fetchMyWorkshopAttendance()), 5000);
    return () => clearInterval(timer);
  }, [dispatch, hasLiveWorkshop]);

  const handleJoin = (sessionId) => dispatch(joinWorkshopSession(sessionId));
  const handleLeave = async () => {
    if (liveConn?.sessionId) {
      await dispatch(leaveWorkshopSession(liveConn.sessionId));
      dispatch(fetchMyWorkshopAttendance());
    }
    dispatch(clearWorkshopLive());
  };

  // If live connection active, show LiveRoom
  if (liveConn?.token && liveConn?.url) {
    return (
      <LiveRoom
        token={liveConn.token}
        serverUrl={liveConn.url}
        canPublish={true}
        title="Live Workshop Session"
        identityName="Trainee"
        sessionId={liveConn.sessionId}
        sessionType="WORKSHOP"
        authToken={authToken}
        onLeave={handleLeave}
      />
    );
  }

  if (status === 'loading' && !data) return <div style={{ padding: 32 }}>Loading...</div>;

  const liveSessions     = sessions.filter(s => s.status === 'live');
  const upcomingSessions = sessions.filter(s => {
    if (s.status !== 'scheduled') return false;
    const endsAt = new Date(s.scheduledAt).getTime() + (s.durationMinutes || 60) * 60000;
    return Date.now() < endsAt;
  });

  return (
    <div style={{ padding: 24, fontFamily: 'Calibri, sans-serif', maxWidth: 1100, margin: '0 auto' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, color: C.text1 }}>My Dashboard</h2>

      {/* ── Stats Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'LMS Attendance', value: `${data?.attendance?.percentage ?? 0}%`, color: C.green },
          { label: 'Pending Work',   value: data?.pendingAssignments ?? 0,            color: C.red },
          { label: 'My Batches',     value: batches.length,                           color: C.accent },
          { label: 'Live Now',       value: liveSessions.length,                      color: C.red },
          { label: 'Upcoming',       value: upcomingSessions.length,                  color: C.amber },
          { label: 'Certificates',   value: certificates.length,                      color: C.green },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: '16px 20px', borderTop: `4px solid ${s.color}`, marginBottom: 0 }}>
            <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</p>
            <p style={{ margin: 0, fontSize: 12, color: C.text3 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {joinError && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: C.red, fontSize: '0.85rem' }}>
          ⚠️ {joinError}
          <button onClick={() => dispatch(clearJoinError())} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: C.red, fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* ── Live Sessions ── */}
      {liveSessions.length > 0 && (
        <div style={card}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: C.red }}>🔴 Live Sessions</h3>
          {liveSessions.map(s => (
            <div key={s._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, color: C.text1 }}>{s.title}</p>
                <p style={{ margin: 0, fontSize: 12, color: C.text3 }}>
                  {s.workshopBatchId?.workshopId?.title || ''} · {s.trainerId?.name || ''}
                </p>
              </div>
              <button
                onClick={() => handleJoin(s._id)}
                disabled={joinStatus === 'loading'}
                style={{ background: C.red, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
              >
                {joinStatus === 'loading' ? 'Joining…' : 'Join Now'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── My Workshop Batches ── */}
      <div style={card}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>My Workshops</h3>
        {batches.length === 0 ? (
          <p style={{ color: C.text3, fontSize: 13 }}>No workshops enrolled yet.</p>
        ) : batches.map(b => (
          <div key={b._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: C.text1 }}>{b.workshopId?.title || b.batchName}</p>
              <p style={{ margin: 0, fontSize: 12, color: C.text3 }}>
                {b.batchName} · {b.mode} · Trainer: {b.trainerId?.name || '—'}
              </p>
            </div>
            <StatusPill status={b.status} />
          </div>
        ))}
      </div>

      {/* ── Upcoming Sessions ── */}
      <div style={card}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>Upcoming Sessions</h3>
        {upcomingSessions.length === 0 ? (
          <p style={{ color: C.text3, fontSize: 13 }}>No upcoming sessions.</p>
        ) : upcomingSessions.map(s => (
          <div key={s._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: C.text1 }}>{s.title}</p>
              <p style={{ margin: 0, fontSize: 12, color: C.text3 }}>{fmtDate(s.scheduledAt)} · {s.durationMinutes} min</p>
            </div>
            <StatusPill status={s.status} />
          </div>
        ))}
      </div>

      {/* ── Workshop Attendance ── */}
      <div style={card}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>Workshop Attendance</h3>
        <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
          {[
            { label: 'Total Sessions', value: attendance.stats?.total ?? 0 },
            { label: 'Present',        value: attendance.stats?.present ?? 0 },
            { label: 'Attendance %',   value: `${attendance.stats?.percentage ?? '0.0'}%` },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.accent }}>{s.value}</p>
              <p style={{ margin: 0, fontSize: 11, color: C.text3 }}>{s.label}</p>
            </div>
          ))}
        </div>
        {attendance.records?.slice(0, 5).map(r => (
          <div key={r._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
            <span style={{ color: C.text1 }}>{r.sessionId?.title || 'Session'}</span>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: C.text3 }}>{r.attendancePct ?? 0}%</span>
              <StatusPill status={r.attendanceStatus} />
            </span>
          </div>
        ))}
      </div>

      {/* ── Certificates ── */}
      <div style={card}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>Certificates</h3>
        {certificates.length === 0 ? (
          <p style={{ color: C.text3, fontSize: 13 }}>No certificates yet. Complete a workshop to become eligible.</p>
        ) : certificates.map(c => (
          <div key={c._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: C.text1 }}>{c.workshopId?.title || 'Workshop'}</p>
              {c.issuedDate && <p style={{ margin: 0, fontSize: 12, color: C.text3 }}>Issued: {fmtDate(c.issuedDate)}</p>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <StatusPill status={c.status} />
              {c.downloadUrl && (
                <a href={c.downloadUrl} target="_blank" rel="noreferrer"
                  style={{ background: C.accent, color: '#fff', borderRadius: 6, padding: '4px 12px', fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none' }}>
                  Download
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── LMS Upcoming Sessions ── */}
      {data?.upcomingSessions?.length > 0 && (
        <div style={card}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>LMS Sessions</h3>
          {data.upcomingSessions.map(s => (
            <div key={s._id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
              <p style={{ margin: 0, fontWeight: 600, color: C.text1 }}>{s.title}</p>
              <p style={{ margin: 0, fontSize: 12, color: C.text3 }}>{fmtDate(s.scheduledAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
