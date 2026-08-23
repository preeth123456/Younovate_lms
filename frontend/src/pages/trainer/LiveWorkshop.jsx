import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';
import {
  fetchTrainerWorkshops,
  startWorkshop,
  joinWorkshopSession,
  endWorkshop,
  setSelectedWorkshop,
  clearLiveConnection,
  selectTrainerWorkshops,
  selectWorkshopsStatus,
  selectWorkshopActionStatus,
  selectWorkshopActionError,
  selectSelectedWorkshopId,
  selectLiveConnection,
  clearActionError,
} from '../../features/Trainer/trainerWorkshopSlice';
import {
  fetchWorkshopSessions,
  fetchSessionParticipants,
  selectWorkshopSessions,
  selectWSSessionStatus,
  selectWSParticipants,
} from '../../features/workshops/workshopSessionsSlice';
import LiveRoom from '../../components/live/LiveRoom';
import { C, S, Pill, Spinner, Empty, PageHeader, StatusBadge, fmtDate, WorkshopSelector } from './workshopShared';

const CSS = `@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}} .ws-btn:hover{opacity:.85}`;

export default function LiveWorkshop() {
  const dispatch      = useDispatch();
  const workshops     = useSelector(selectTrainerWorkshops);
  const wsStatus      = useSelector(selectWorkshopsStatus);
  const actionStatus  = useSelector(selectWorkshopActionStatus);
  const actionError   = useSelector(selectWorkshopActionError);
  const selectedId    = useSelector(selectSelectedWorkshopId);
  const liveConn      = useSelector(selectLiveConnection);

  const authToken     = useSelector(s => s.auth?.token || '');

  // Workshop sessions fetched from /api/workshop-sessions
  const allSessions   = useSelector(selectWorkshopSessions);
  const sessionsStatus = useSelector(selectWSSessionStatus);

  const [announcement, setAnnouncement]   = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [copied, setCopied]               = useState(false);
  const [recording, setRecording]         = useState({ status: 'none', loading: false, error: '' });

  const selected = workshops.find(w => w._id === selectedId) || workshops[0] || null;

  // Find the scheduled/live session for the selected workshop batch
  const batchId = selected?.batchId;
  const workshopSession = allSessions.find(s => {
    const sid = s.workshopBatchId?._id || s.workshopBatchId;
    return sid && batchId && sid.toString() === batchId.toString();
  }) || null;

  const sessionId = workshopSession?._id;
  const participants = useSelector(selectWSParticipants(sessionId));

  // Load workshops on mount
  useEffect(() => {
    dispatch(fetchTrainerWorkshops());
  }, [dispatch]);

  // When a workshop is selected, load its sessions and participants
  useEffect(() => {
    if (!selected?._id) return;
    if (!selectedId) dispatch(setSelectedWorkshop(selected._id));
    // Fetch sessions scoped to this trainer (backend filters by trainerId)
    dispatch(fetchWorkshopSessions());
  }, [selected?._id, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (sessionId) dispatch(fetchSessionParticipants(sessionId));
  }, [sessionId, dispatch]);

  // Keep recording UI in sync with backend session state
  useEffect(() => {
    const rs = workshopSession?.recordingStatus;
    if (rs === 'recording') {
      setRecording({ status: 'recording', loading: false, error: '' });
    } else if (rs === 'processing') {
      setRecording({ status: 'processing', loading: false, error: '' });
    } else if (rs === 'failed') {
      setRecording({ status: 'none', loading: false, error: 'Recording processing failed. Please try again.' });
    } else if (rs === 'available' || rs === 'none' || !rs) {
      setRecording({ status: 'none', loading: false, error: '' });
    }
  }, [workshopSession?.recordingStatus, workshopSession?._id]);

  // Poll while a recording is finalizing
  useEffect(() => {
    if (recording.status !== 'processing' || !sessionId) return undefined;
    const timer = setInterval(() => dispatch(fetchWorkshopSessions()), 3000);
    const timeout = setTimeout(() => clearInterval(timer), 90000);
    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
    };
  }, [recording.status, sessionId, dispatch]);

  const handleSelect = (id) => {
    dispatch(setSelectedWorkshop(id));
  };

  const handleStart = async () => {
    if (!sessionId) return;
    try {
      await dispatch(startWorkshop(sessionId)).unwrap();
      dispatch(fetchWorkshopSessions());
    } catch (err) {
      console.error('Failed to start workshop session:', err);
    }
  };

  const handleEnterRoom = async () => {
    if (!sessionId) return;
    try {
      await dispatch(joinWorkshopSession(sessionId)).unwrap();
    } catch (err) {
      console.error('Failed to join workshop session:', err);
    }
  };

  const handleEnd = async () => {
    if (!sessionId) return;
    try {
      await dispatch(endWorkshop(sessionId)).unwrap();
      dispatch(fetchWorkshopSessions());
    } catch (err) {
      console.error('Failed to end workshop session:', err);
    }
  };

  const handleLeave = useCallback(() => {
    // Only clear connection on explicit user leave; transient LiveKit
    // onDisconnected events should NOT wipe the room state.
    dispatch(clearLiveConnection());
    dispatch(fetchWorkshopSessions());
  }, [dispatch]);

  const handleDisconnect = useCallback(() => {
    // LiveKit transient disconnect — keep the connection so the SDK can
    // reconnect without blinking back to the dashboard.
    dispatch(fetchWorkshopSessions());
  }, [dispatch]);

   const handleRecordingStart = async () => {
    if (!sessionId) return;
    setRecording(r => ({ ...r, loading: true, error: '' }));
    try {
      await axios.post(`${API_BASE_URL}/api/workshop-sessions/${sessionId}/recording/start`, {}, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setRecording({ status: 'recording', loading: false, error: '' });
      dispatch(fetchWorkshopSessions());
    } catch (err) {
      console.error('Failed to start recording:', err);
      const message = err.response?.data?.message || 'Failed to start recording';
      setRecording({ status: 'none', loading: false, error: message });
    }
  };

   const handleRecordingStop = async () => {
    if (!sessionId) return;
    setRecording({ status: 'processing', loading: true, error: '' });
    try {
      await axios.post(`${API_BASE_URL}/api/workshop-sessions/${sessionId}/recording/stop`, {}, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setRecording({
        status: 'processing',
        loading: false,
        error: '',
      });
      dispatch(fetchWorkshopSessions());
    } catch (err) {
      console.error('Failed to stop recording:', err);
      const message = err.response?.data?.message || 'Failed to stop recording';
      setRecording({ status: 'recording', loading: false, error: message });
    }
  };

  const copyLink = () => {
    const link = liveConn?.roomName
      ? `${window.location.origin}/trainer/workshops/live`
      : `https://meet.youva.in/workshop-${selected?._id}`;
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const postAnnouncement = () => {
    if (!announcement.trim()) return;
    setAnnouncements(prev => [{ text: announcement.trim(), time: new Date() }, ...prev]);
    setAnnouncement('');
  };

  // ── BUG FIX: Use Session model status as source of truth ──────────────
  // The Workshop model status is secondary. Session status drives the UI.
  // If session is completed, we must NOT show LIVE or allow start/enter.
  const sessionStatus = workshopSession?.status || '';
  const isLive        = sessionStatus === 'live';
  const isCompleted   = sessionStatus === 'completed';
  const isScheduled   = sessionStatus === 'scheduled';
  const canStart      = sessionId && isScheduled && !isLive && !isCompleted;

  const joined    = participants.filter(p => p.attendance?.attendanceStatus === 'Present' || p.attendance?.attendanceStatus === 'Partial');
  const notJoined = participants.filter(p => !p.attendance || p.attendance?.attendanceStatus === 'Absent');

// If we have a live connection, render the LiveKit room
  if (liveConn?.token && liveConn?.url) {
    return (
       <LiveRoom
          token={liveConn.token}
          serverUrl={liveConn.url}
          canPublish={true}
          isTrainer={true}
          title={workshopSession?.title || selected?.title || 'Live Workshop'}
          identityName="Trainer"
          sessionId={sessionId}
          sessionType="WORKSHOP"
          authToken={authToken}
          onLeave={handleLeave}
          onSessionEnd={handleEnd}
          onDisconnected={handleDisconnect}
        />
    );
  }

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      <PageHeader title="Live Workshop" subtitle="Conduct your assigned workshop session.">
        <WorkshopSelector workshops={workshops} selectedId={selected?._id} onSelect={handleSelect} />
      </PageHeader>

      {wsStatus === 'loading' && !workshops.length ? <Spinner /> : !selected ? (
        <Empty icon="🎙️" msg="No workshops assigned to you yet." />
      ) : (
        <>
          {/* Workshop Info + Controls */}
          <div style={{ ...S.card, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  {isLive && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fee2e2', color: '#dc2626', fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#dc2626', animation: 'pulse 1s infinite' }} /> LIVE
                    </span>
                  )}
                  <StatusBadge status={sessionStatus || selected.status} />
                  <Pill bg="#f1f5f9" color="#475569">{selected.mode}</Pill>
                  {workshopSession && (
                    <Pill bg="#f1f5f9" color="#475569">{workshopSession.durationMinutes} min</Pill>
                  )}
                  {recording.status === 'recording' && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fee2e2', color: '#dc2626', fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#dc2626', animation: 'pulse 1s infinite' }} /> Recording
                    </span>
                  )}
                   {recording.status === 'processing' && (
                     <span style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#dbeafe', color: '#1e40af', fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>
                       Processing
                     </span>
                   )}
                   {recording.error && (
                     <span style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fef2f2', color: '#dc2626', fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>
                       ⚠ {recording.error}
                     </span>
                   )}
                 </div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: C.text1, margin: '0 0 4px' }}>
                  {workshopSession?.title || selected.title}
                </h2>
                <div style={{ fontSize: '0.82rem', color: C.text3 }}>
                  {selected.trainerId?.name || 'Trainer'} · {fmtDate(workshopSession?.scheduledAt || selected.date)}
                </div>
                {!sessionId && sessionsStatus !== 'loading' && (
                  <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#d97706', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 10px' }}>
                    ⚠ No session scheduled for this batch yet. Ask admin to schedule one.
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {canStart && (
                  <button style={S.btnGreen} onClick={handleStart} disabled={actionStatus === 'loading'} className="ws-btn">
                    <i className="ti ti-player-play" style={{ fontSize: 14 }} />
                    {actionStatus === 'loading' ? 'Starting…' : 'Go Live'}
                  </button>
                )}
                 {isLive && (
                   <>
                     <button style={S.btnPri} onClick={handleEnterRoom} disabled={actionStatus === 'loading'} className="ws-btn">
                       <i className="ti ti-video" style={{ fontSize: 14 }} />
                       Enter Room
                     </button>
                    {recording.status === 'none' && (
                      <button style={{ ...S.btnPri, background: '#dc2626' }} onClick={handleRecordingStart} disabled={recording.loading} className="ws-btn">
                        <i className="ti ti-device-floppy" style={{ fontSize: 14 }} />
                        {recording.loading ? 'Starting…' : 'Start Recording'}
                      </button>
                    )}
                    {recording.status === 'recording' && (
                      <button style={{ ...S.btnPri, background: '#d97706' }} onClick={handleRecordingStop} disabled={recording.loading} className="ws-btn">
                        <i className="ti ti-player-stop" style={{ fontSize: 14 }} />
                        {recording.loading ? 'Stopping…' : 'Stop Recording'}
                      </button>
                    )}
                    <button style={S.btnRed} onClick={handleEnd} disabled={actionStatus === 'loading'} className="ws-btn">
                      <i className="ti ti-player-stop" style={{ fontSize: 14 }} />
                      {actionStatus === 'loading' ? 'Ending…' : 'End Session'}
                    </button>
                  </>
                )}
                <button style={S.btnGhost} onClick={copyLink} className="ws-btn">
                  <i className={`ti ti-${copied ? 'check' : 'copy'}`} style={{ fontSize: 13 }} />
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>

            {actionError && (
              <div style={{ marginTop: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', fontSize: '0.78rem', color: '#b91c1c' }}>
                ⚠️ {actionError}
                <button onClick={() => dispatch(clearActionError())} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', fontWeight: 700 }}>✕</button>
              </div>
            )}

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
              {[
                { label: 'Registered', value: participants.length,       color: C.accent  },
                { label: 'Joined',     value: joined.length,             color: '#16a34a' },
                { label: 'Not Joined', value: notJoined.length,          color: '#d97706' },
                { label: 'Duration',   value: `${workshopSession?.durationMinutes || '—'} min`, color: C.text3 },
              ].map(stat => (
                <div key={stat.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: '0.72rem', color: C.text4, fontWeight: 600, marginTop: 2 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>

            {/* Participants */}
            <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>Participants</span>
                <span style={{ fontSize: '0.75rem', color: C.text4 }}>{participants.length} registered</span>
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {participants.length === 0 ? (
                  <Empty icon="👥" msg="No participants yet" />
                ) : participants.map(p => {
                  const att = p.attendance;
                  const isPresent = att?.attendanceStatus === 'Present' || att?.attendanceStatus === 'Partial';
                  return (
                    <div key={p._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid #f3f4f6` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
                          {(p.fullName || 'S')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.84rem', fontWeight: 600, color: C.text1 }}>{p.fullName || '—'}</div>
                          <div style={{ fontSize: '0.72rem', color: C.text4 }}>{p.email}</div>
                        </div>
                      </div>
                      <span style={{ background: isPresent ? '#dcfce7' : '#f3f4f6', color: isPresent ? '#15803d' : C.text4, padding: '2px 8px', borderRadius: 99, fontSize: '0.71rem', fontWeight: 700 }}>
                        {att?.attendanceStatus || 'Pending'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Announcements */}
            <div style={{ ...S.card, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>Announcements</span>
              </div>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={announcement}
                    onChange={e => setAnnouncement(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && postAnnouncement()}
                    placeholder="Type an announcement and press Enter…"
                    style={{ ...S.input, flex: 1 }}
                  />
                  <button style={S.btnPri} onClick={postAnnouncement} className="ws-btn">
                    <i className="ti ti-send" style={{ fontSize: 13 }} />
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: 240 }}>
                {announcements.length === 0 ? (
                  <Empty icon="📢" msg="No announcements yet" />
                ) : announcements.map((a, i) => (
                  <div key={i} style={{ padding: '10px 16px', borderBottom: `1px solid #f3f4f6` }}>
                    <div style={{ fontSize: '0.84rem', color: C.text2 }}>{a.text}</div>
                    <div style={{ fontSize: '0.72rem', color: C.text4, marginTop: 3 }}>{a.time.toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
