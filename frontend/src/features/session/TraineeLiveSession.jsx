// src/features/session/TraineeLiveSession.jsx
// Trainee live view with full join state machine:
//   - Scheduled (countdown, join disabled)
//   - Waiting for Trainer (join enabled, waiting for trainer to start)
//   - Live (join + room)
//   - Completed (session ended, join disabled)
import React, { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import LiveRoom from '../../components/live/LiveRoom';
import { API_BASE_URL } from '../../config/api';

const API = API_BASE_URL;

const TraineeLiveSession = ({ session, connection: connectionProp, onLeave }) => {
  const token = useSelector((s) => s.auth?.token || '');
  const user  = useSelector((s) => s.auth?.user) || {};

  const [connection, setConnection] = useState(connectionProp || null);
  const [status, setStatus] = useState(connectionProp ? 'joined' : 'idle');
  const [error, setError] = useState(null);
  const [joinState, setJoinState] = useState(null);
  const [countdown, setCountdown] = useState(0);

  const joinedAtRef = useRef(connectionProp ? Date.now() : null);
  const sessionId = session?._id || session?.id;

  // Poll join status periodically
  useEffect(() => {
    if (!sessionId || status === 'joined') return;

    const fetchJoinStatus = async () => {
      try {
        const { data } = await axios.get(
          `${API}/api/trainee/sessions/${sessionId}/join-status`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (data.success) {
          setJoinState(data);
          setCountdown(data.secondsUntilStart || 0);

          // Auto-join when session goes live
          if (data.joinState === 'live' && data.canJoin && status !== 'joined') {
            handleJoin();
          }
        }
      } catch (err) {
        console.error('Failed to fetch join status:', err);
      }
    };

    fetchJoinStatus();
    const interval = setInterval(fetchJoinStatus, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [sessionId, token, status]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(c => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleJoin = async () => {
    if (!sessionId) {
      setError('This session is missing an id — please refresh the list.');
      setStatus('error');
      return;
    }
    setStatus('connecting');
    setError(null);
    try {
      const { data } = await axios.post(
        `${API}/api/trainee/workshop-sessions/${sessionId}/join`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!data?.token || !data?.url) throw new Error(data?.message || 'No valid join token returned.');
      joinedAtRef.current = Date.now();
      setConnection({
        token: data.token,
        url: data.url,
        role: data.role || 'student',
        canPublish: data.canPublish !== false,
      });
      setStatus('joined');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to join the session.');
      setStatus('error');
    }
  };

  const finaliseAttendance = async () => {
    if (!sessionId) return;
    try {
      await axios.post(
        `${API}/api/trainee/sessions/${sessionId}/attendance/leave`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (_) {}
  };

  const handleLeave = async () => {
    await finaliseAttendance();
    setConnection(null);
    setStatus('idle');
    joinedAtRef.current = null;
    if (typeof onLeave === 'function') onLeave();
  };

  // ── In the room ──
  if (status === 'joined' && connection?.token && connection?.url) {
    return (
      <LiveRoom
        token={connection.token}
        serverUrl={connection.url}
        canPublish={connection?.canPublish ?? true}
        title={session?.title || 'Live Session'}
        identityName={user?.name || 'Trainee'}
        sessionId={sessionId}
        sessionType={session?.sessionType || 'LMS'}
        onLeave={handleLeave}
      />
    );
  }

  // ── Pre-join screen ──
  const renderJoinState = () => {
    const js = joinState;

    // Session completed
    if (js?.joinState === 'completed' || session?.status === 'completed') {
      return (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ color: '#0F172A', fontWeight: 700, marginBottom: 8 }}>Session Completed</h2>
          <p style={{ color: '#64748B', marginBottom: 16 }}>
            This session has ended. Thank you for participating!
          </p>
          {onLeave && (
            <button onClick={handleLeave} style={styles.backBtn}>← Back to sessions</button>
          )}
        </div>
      );
    }

    // Scheduled with countdown
    if (js?.joinState === 'scheduled' && countdown > 0) {
      const mins = Math.floor(countdown / 60);
      const secs = countdown % 60;
      return (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
          <h2 style={{ color: '#0F172A', fontWeight: 700, marginBottom: 8 }}>Scheduled</h2>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#1E3A5F', fontFamily: 'monospace', marginBottom: 12 }}>
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </div>
          <p style={{ color: '#64748B', marginBottom: 16 }}>
            Session will be available to join at the scheduled time.
          </p>
          <button disabled style={styles.disabledBtn}>
            <i className="ti ti-video-off" style={{ fontSize: 14 }} /> Join Disabled
          </button>
          {onLeave && (
            <button onClick={handleLeave} style={{ ...styles.backBtn, marginLeft: 8 }}>← Back</button>
          )}
        </div>
      );
    }

    // Waiting for trainer (within join window, trainer hasn't started)
    if (js?.joinState === 'waiting' || (js?.isWithinJoinWindow && session?.status === 'scheduled')) {
      return (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <h2 style={{ color: '#0F172A', fontWeight: 700, marginBottom: 8 }}>Waiting for Trainer</h2>
          <p style={{ color: '#64748B', marginBottom: 16 }}>
            The session is scheduled. Please wait for the trainer to start the session.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button disabled style={styles.disabledBtn}>
              <i className="ti ti-video-off" style={{ fontSize: 14 }} /> Join Disabled
            </button>
            {onLeave && (
              <button onClick={handleLeave} style={styles.backBtn}>← Back</button>
            )}
          </div>
        </div>
      );
    }

    // Live - can join
    if (js?.joinState === 'live' || session?.status === 'live') {
      return (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔴</div>
          <h2 style={{ color: '#0F172A', fontWeight: 700, marginBottom: 8 }}>Session is Live</h2>
          <p style={{ color: '#64748B', marginBottom: 16 }}>
            The trainer has started the session. Click below to join.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              onClick={handleJoin}
              disabled={status === 'connecting'}
              style={styles.joinBtn}
            >
              <i className="ti ti-video" style={{ fontSize: 14 }} />
              {status === 'connecting' ? 'Joining…' : 'Join Session'}
            </button>
            {onLeave && (
              <button onClick={handleLeave} style={styles.backBtn}>← Back</button>
            )}
          </div>
        </div>
      );
    }

    // Default: show session info
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎥</div>
        <h2 style={{ color: '#0F172A', fontWeight: 700, marginBottom: 8 }}>{session?.title || 'Live Session'}</h2>
        <p style={{ color: '#64748B', marginBottom: 16 }}>
          You'll join the live room. Your camera and microphone start off — turn them on from the control bar.
        </p>
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px', fontSize: 14, color: '#B91C1C', marginBottom: 16 }}>
            ⚠️ {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button
            onClick={handleJoin}
            disabled={status === 'connecting'}
            style={styles.joinBtn}
          >
            {status === 'connecting' ? 'Joining…' : 'Join Session'}
          </button>
          {onLeave && (
            <button onClick={handleLeave} style={styles.backBtn}>← Back</button>
          )}
        </div>
        <p style={{ marginTop: 12, fontSize: 12, color: '#9CA3AF' }}>Signed in as {user?.name || 'trainee'}.</p>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {renderJoinState()}
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    fontFamily: 'Inter, system-ui, sans-serif',
    minHeight: '100vh',
    background: '#F8FAFC',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtn: {
    padding: '12px 28px',
    borderRadius: 10,
    border: 'none',
    background: '#1E3A5F',
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    transition: 'opacity .15s',
  },
  disabledBtn: {
    padding: '12px 28px',
    borderRadius: 10,
    border: '1.5px solid #E2E8F0',
    background: '#F1F5F9',
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'not-allowed',
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    padding: '12px 20px',
    borderRadius: 10,
    border: '1.5px solid #E2E8F0',
    background: '#fff',
    color: '#475569',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
};

export default TraineeLiveSession;
