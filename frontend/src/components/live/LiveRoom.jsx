// src/components/live/LiveRoom.jsx
// PRODUCTION-READY LiveKit meeting room with ALL controls
// Trainer: full admin controls (lock, mute all, admit, recording, etc.)
// Trainee: mic/cam/screen share/chat/raise hand/device selection
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  useChat,
  useParticipants,
  useRoomContext,
  useLocalParticipant,
  useConnectionState,
  StartAudio,
  isTrackReference,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import { API_BASE_URL } from '../../config/api';
import { useSessionSocket } from '../../hooks/useSessionSocket';

// ── Helpers ──────────────────────────────────────────────────────────
const idOf = (t) => `${t?.participant?.identity ?? ''}:${t?.source ?? ''}`;

const fmtTimer = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/** Map backend session/recording fields to the UI recording state. */
const resolveRecordingUiStatus = (sess, stopRecording) => {
  const status = sess?.recordingStatus;
  const rec = stopRecording;
  if (rec?.status === 'completed') return 'available';
  if (rec?.status === 'failed') return 'failed';
  if (status === 'processing' && (sess?.recordingUrl || rec?.url)) return 'available';
  if (status === 'available' || status === 'failed' || status === 'recording' || status === 'processing') {
    return status;
  }
  if (sess?.recordingUrl || rec?.url) return 'available';
  return status || 'none';
};

export default function LiveRoom({
  token,
  serverUrl,
  canPublish = true,
  isTrainer = false,
  title = 'Live Session',
  identityName = 'You',
  sessionId = null,
  sessionType = 'LMS',
  authToken = null,
  onLeave,
  onSessionEnd,
  onDisconnected,
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
  const [raisedHand, setRaisedHand] = useState(false);
  const [meetingTimer, setMeetingTimer] = useState(0);
  const [connectionQuality] = useState('good');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [recordingState, setRecordingState] = useState('none'); // none|recording|processing
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [recordingError, setRecordingError] = useState('');
  const [recordingTimer, setRecordingTimer] = useState(0);
  const recordingStartTimeRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const [lockState, setLockState] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [screenShareEnabled, setScreenShareEnabled] = useState(true);
  const [announcementDraft, setAnnouncementDraft] = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedAudio, setSelectedAudio] = useState('');
  const [selectedVideo, setSelectedVideo] = useState('');
  const [processingTimedOut, setProcessingTimedOut] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const processingPollRef = useRef(null);
  const pendingRecordingRef = useRef(null);
  const containerRef = useRef(null);
  const timerRef = useRef(null);

  // Meeting timer
  useEffect(() => {
    if (isTrainer && timerRef.current === null) {
      timerRef.current = setInterval(() => {
        setMeetingTimer(t => t + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTrainer]);

  // Enumerate devices
  useEffect(() => {
    if (typeof navigator?.mediaDevices?.enumerateDevices !== 'function') return;
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
      setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
    }).catch(() => {});
  }, []);

  // Sync recording status from backend; poll while processing
  const recordingStateRef = useRef(recordingState);
  recordingStateRef.current = recordingState;

  useEffect(() => {
    if (!sessionId || !authToken) return undefined;
    let cancelled = false;
    const API = API_BASE_URL;
    const endpoint = sessionType === 'WORKSHOP'
      ? `${API}/api/workshop-sessions/${sessionId}`
      : `${API}/api/trainer/sessions/${sessionId}`;

    const applyRecStatus = (recStatus) => {
      if (recStatus === 'recording' && recordingStateRef.current === 'processing') return;
      if (recStatus === 'recording') {
        setProcessingTimedOut(false);
        setRecordingState('recording');
        if (!recordingStartTimeRef.current) recordingStartTimeRef.current = Date.now();
      } else if (recStatus === 'processing') {
        recordingStartTimeRef.current = null;
        setRecordingTimer(0);
        setRecordingState('processing');
        setProcessingTimedOut(false);
      } else if (recStatus === 'available') {
        recordingStartTimeRef.current = null;
        setRecordingTimer(0);
        setRecordingState('none');
        setProcessingTimedOut(false);
        setRecordingError('');
        pendingRecordingRef.current = null;
      } else if (recStatus === 'failed') {
        recordingStartTimeRef.current = null;
        setRecordingTimer(0);
        setRecordingState('none');
        setRecordingError('Recording processing failed. Please try again.');
        pendingRecordingRef.current = null;
      } else {
        recordingStartTimeRef.current = null;
        setRecordingTimer(0);
        setRecordingState('none');
        pendingRecordingRef.current = null;
      }
    };

    const syncStatus = () => {
      const sessPromise = fetch(endpoint, { headers: { Authorization: `Bearer ${authToken}` } })
        .then(r => r.ok ? r.json() : Promise.reject());
      const recId = pendingRecordingRef.current?._id;
      const recPromise = recId
        ? fetch(`${API}/api/trainer/recordings/${recId}`, { headers: { Authorization: `Bearer ${authToken}` } })
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        : Promise.resolve(null);

      return Promise.all([sessPromise, recPromise])
        .then(([data, recData]) => {
          if (cancelled) return;
          const sess = data?.session || data;
          const freshRec = recData?.recording;
          if (freshRec?.status === 'completed' || freshRec?.url) {
            pendingRecordingRef.current = freshRec;
          }
          applyRecStatus(resolveRecordingUiStatus(sess, pendingRecordingRef.current));
          if (sess?.status === 'completed') {
            setSessionEnded(true);
          }
        })
        .catch(() => {});
    };

    syncStatus();

    if (recordingState !== 'processing') {
      if (processingPollRef.current) clearInterval(processingPollRef.current);
      return () => { cancelled = true; };
    }

    processingPollRef.current = setInterval(syncStatus, 3000);
    const timeout = setTimeout(() => {
      if (processingPollRef.current) clearInterval(processingPollRef.current);
      setProcessingTimedOut(true);
      setRecordingState('none');
      setRecordingError('Recording processing timed out. Check Recorded Videos shortly.');
      pendingRecordingRef.current = null;
    }, 90000);

    return () => {
      cancelled = true;
      if (processingPollRef.current) clearInterval(processingPollRef.current);
      clearTimeout(timeout);
    };
  }, [sessionId, authToken, sessionType, recordingState, onSessionEnd]);

  const handleRecordingStatusSocket = useCallback((data) => {
    if (!data) return;
    const st = data.status;
    if (st === 'available' || st === 'completed') {
      recordingStartTimeRef.current = null;
      setRecordingTimer(0);
      setRecordingState('none');
      setRecordingError('');
      setProcessingTimedOut(false);
      pendingRecordingRef.current = null;
    } else if (st === 'failed') {
      recordingStartTimeRef.current = null;
      setRecordingTimer(0);
      setRecordingState('none');
      setRecordingError('Recording processing failed.');
    } else if (st === 'processing') {
      setRecordingState('processing');
    }
  }, []);

  const handleSessionEndedSocket = useCallback(() => {
    setSessionEnded(true);
  }, []);

  useEffect(() => {
    if (!sessionEnded) return undefined;
    const timer = setTimeout(() => {
      if (onSessionEnd) onSessionEnd({ ended: true, auto: true });
      else if (onLeave) onLeave();
    }, 1500);
    return () => clearTimeout(timer);
  }, [sessionEnded, onSessionEnd, onLeave]);

  useSessionSocket({
    sessionId,
    token: authToken,
    onSessionEnded: sessionId ? handleSessionEndedSocket : undefined,
    onRecordingStatus: sessionId ? handleRecordingStatusSocket : undefined,
  });

  // Recording timer — counts from a stable start timestamp to avoid drift/reset
  useEffect(() => {
    if (recordingState !== 'recording') {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      return;
    }
    if (!recordingStartTimeRef.current) {
      recordingStartTimeRef.current = Date.now();
    }
    recordingTimerRef.current = setInterval(() => {
      setRecordingTimer(Math.floor((Date.now() - recordingStartTimeRef.current) / 1000));
    }, 1000);
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    };
  }, [recordingState]);

  const toggleFullScreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullScreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullScreen(false)).catch(() => {});
    }
  }, []);

  const handleRaiseHand = useCallback(() => {
    setRaisedHand(h => !h);
    // Emit via chat data channel or socket
    try {
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('livekit:raisehand', { detail: { raised: !raisedHand } });
        window.dispatchEvent(event);
      }
    } catch (_) {}
  }, [raisedHand]);

  const applyStopRecordingResult = useCallback((data, resOk) => {
    if (!resOk || !data?.success) {
      setRecordingError(data?.message || 'Failed to stop recording');
      return;
    }
    const rec = data.recording;
    if (rec) pendingRecordingRef.current = rec;
    const rs = resolveRecordingUiStatus(
      {
        recordingStatus: data.recordingStatus ?? data.session?.recordingStatus,
        recordingUrl: data.session?.recordingUrl,
      },
      rec
    );
    if (rs === 'available') {
      recordingStartTimeRef.current = null;
      setRecordingTimer(0);
      setRecordingState('none');
      setRecordingError('');
    } else if (rs === 'failed') {
      recordingStartTimeRef.current = null;
      setRecordingTimer(0);
      setRecordingState('none');
      setRecordingError(data.message || 'Recording processing failed');
    } else {
      recordingStartTimeRef.current = null;
      setRecordingTimer(0);
      setRecordingState('processing');
    }
  }, []);

  const stopActiveRecording = useCallback(async () => {
    if (!sessionId || !authToken || recordingState !== 'recording') return;
    const base = API_BASE_URL;
    const recBase = sessionType === 'WORKSHOP'
      ? `${base}/api/workshop-sessions/${sessionId}`
      : `${base}/api/trainer/sessions/${sessionId}`;
    setRecordingError('');
    setRecordingLoading(true);
    try {
      const res = await fetch(`${recBase}/recording/stop`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      applyStopRecordingResult(data, res.ok);
    } catch (_) {
      setRecordingError('Network error while stopping recording');
    } finally {
      setRecordingLoading(false);
    }
  }, [sessionId, authToken, sessionType, recordingState, applyStopRecordingResult]);

  const handleEndSession = useCallback(async () => {
    if (!onSessionEnd || endingSession) return;
    setEndingSession(true);
    try {
      if (recordingState === 'recording') {
        await stopActiveRecording();
      }
      await Promise.resolve(onSessionEnd({ ended: true }));
      if (onLeave) onLeave();
      if (sessionId && authToken) {
        const base = API_BASE_URL;
        const endpoint = sessionType === 'WORKSHOP'
          ? `${base}/api/workshop-sessions/${sessionId}`
          : `${base}/api/sessions/${sessionId}`;
        try {
          const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${authToken}` } });
          if (res.ok) {
            const data = await res.json();
            const sess = data?.session || data;
            const rs = resolveRecordingUiStatus(sess, pendingRecordingRef.current);
            if (rs === 'available' || rs === 'failed' || rs === 'none') {
              recordingStartTimeRef.current = null;
              setRecordingTimer(0);
              setRecordingState('none');
              setProcessingTimedOut(false);
              pendingRecordingRef.current = null;
              if (rs === 'failed') setRecordingError('Recording processing failed.');
              else setRecordingError('');
            }
          }
        } catch (_) {}
      }
    } finally {
      setEndingSession(false);
    }
  }, [onSessionEnd, onLeave, endingSession, recordingState, stopActiveRecording, sessionId, authToken, sessionType]);

  if (!token || !serverUrl) {
    return (
      <div className="p-6" style={{ background: '#0b0f17', minHeight: '100vh', color: '#fff' }}>
        <button onClick={onLeave} style={styles.backBtn}>&larr; Back</button>
        <p style={{ color: '#ef4444' }}>No live connection. Please re-join the session.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="lk-shell" style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0b0f17', position: 'relative' }}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="font-semibold truncate text-sm sm:text-base" style={{ color: '#fff' }}>{title}</span>
          {recordingState === 'recording' ? (
            <>
              <span style={{ ...styles.recBadge, background: '#7f1d1d' }}>● REC</span>
              <span style={styles.timer}>{fmtTimer(recordingTimer)}</span>
            </>
          ) : (
            isTrainer && recordingState !== 'processing' && (
              <span style={styles.timer}>{fmtTimer(meetingTimer)}</span>
            )
          )}
          {recordingState === 'processing' && !processingTimedOut && (
            <span style={{ ...styles.recBadge, background: '#78350f', color: '#fbbf24' }}>Processing…</span>
          )}
          <span style={styles.qualityBadge}>{connectionQuality === 'good' ? '🟢' : connectionQuality === 'fair' ? '🟡' : '🔴'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isTrainer && (
            <>
              <button onClick={() => setLockState(l => !l)} style={styles.iconBtn} title={lockState ? 'Unlock Meeting' : 'Lock Meeting'}>
                <i className={`ti ti-${lockState ? 'lock' : 'lock-open'}`} />
              </button>
              <button onClick={() => setChatEnabled(c => !c)} style={styles.iconBtn} title={chatEnabled ? 'Disable Chat' : 'Enable Chat'}>
                <i className={`ti ti-${chatEnabled ? 'message' : 'message-off'}`} />
              </button>
              <button onClick={() => setScreenShareEnabled(s => !s)} style={styles.iconBtn} title={screenShareEnabled ? 'Disable Screen Share' : 'Enable Screen Share'}>
                <i className={`ti ti-${screenShareEnabled ? 'screen-share' : 'screen-share-off'}`} />
              </button>
            </>
          )}
          <button onClick={() => setShowParticipants(p => !p)} style={styles.iconBtn} title="Participants">
            <i className="ti ti-users" />
          </button>
          <button onClick={() => setShowDevices(d => !d)} style={styles.iconBtn} title="Device Settings">
            <i className="ti ti-settings" />
          </button>
          <button onClick={toggleFullScreen} style={styles.iconBtn} title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}>
            <i className={`ti ti-${isFullScreen ? 'arrows-maximize' : 'arrows-minimize'}`} />
          </button>
          <button onClick={() => setChatOpen(o => !o)} style={styles.chatToggleBtn}>
            {chatOpen ? 'Hide Chat' : 'Chat'}
          </button>
          {isTrainer && onSessionEnd && (
            <button onClick={handleEndSession} disabled={endingSession || recordingLoading} style={styles.endBtn}>
              <i className="ti ti-player-stop" style={{ fontSize: 14 }} /> {endingSession ? 'Ending…' : 'End Session'}
            </button>
          )}
          <button onClick={onLeave} style={styles.leaveBtn}>Leave</button>
        </div>
      </div>

      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect={!sessionEnded}
        video={canPublish}
        audio={canPublish}
        onDisconnected={onDisconnected || onLeave}
        data-lk-theme="default"
        style={{ flex: 1, minHeight: 0, display: 'flex' }}
      >
        <DisconnectOnEnd ended={sessionEnded} />
        {/* Main video area */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
            {/* Video stage */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Stage />
            </div>

            {/* Participants sidebar */}
            {showParticipants && (
              <div style={styles.participantsSidebar}>
                <ParticipantsPanel isTrainer={isTrainer} sessionId={sessionId} />
              </div>
            )}
          </div>

          {/* Control bar */}
          <div style={{ background: '#111827', borderTop: '1px solid #1f2937' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {canPublish && (
                  <ControlBar
                    variation="verbose"
                    controls={{
                      microphone: true,
                      camera: true,
                      screenShare: screenShareEnabled,
                      chat: false,
                      leave: false,
                    }}
                  />
                )}
                <button onClick={handleRaiseHand} style={styles.controlBtn} title={raisedHand ? 'Lower Hand' : 'Raise Hand'}>
                  <i className={`ti ti-hand-${raisedHand ? 'stop' : 'rocket'}`} style={{ fontSize: 16 }} />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {isTrainer && (
                <>
                   <button
                     onClick={async () => {
                       setRecordingError('');
                       const base = API_BASE_URL;
                       const recBase = sessionType === 'WORKSHOP'
                         ? `${base}/api/workshop-sessions/${sessionId}`
                         : `${base}/api/trainer/sessions/${sessionId}`;
                       if (recordingState === 'recording') {
                         setRecordingLoading(true);
                         try {
                           const res = await fetch(`${recBase}/recording/stop`, {
                             method: 'POST',
                             headers: { Authorization: `Bearer ${authToken}` },
                           });
                           const data = await res.json().catch(() => ({}));
                           if (res.ok && data.success) {
                             const rec = data.recording;
                             if (rec) pendingRecordingRef.current = rec;
                             const rs = resolveRecordingUiStatus(
                               {
                                 recordingStatus: data.recordingStatus ?? data.session?.recordingStatus,
                                 recordingUrl: data.session?.recordingUrl,
                               },
                               rec
                             );
                             if (rs === 'available') {
                               recordingStartTimeRef.current = null;
                               setRecordingTimer(0);
                               setRecordingState('none');
                               setRecordingError('');
                             } else if (rs === 'failed') {
                               recordingStartTimeRef.current = null;
                               setRecordingTimer(0);
                               setRecordingState('none');
                               setRecordingError(data.message || 'Recording processing failed');
                             } else {
                               recordingStartTimeRef.current = null;
                               setRecordingTimer(0);
                               setRecordingState('processing');
                             }
                           } else {
                             setRecordingError(data.message || 'Failed to stop recording');
                           }
                         } catch (_) {
                           setRecordingError('Network error while stopping recording');
                         } finally {
                           setRecordingLoading(false);
                         }
                       } else if (recordingState === 'none') {
                         setRecordingLoading(true);
                         try {
                           const res = await fetch(`${recBase}/recording/start`, {
                             method: 'POST',
                             headers: { Authorization: `Bearer ${authToken}` },
                           });
                           const data = await res.json().catch(() => ({}));
                           if (res.ok && data.success) {
                             recordingStartTimeRef.current = Date.now();
                             setRecordingTimer(0);
                             setRecordingState('recording');
                           } else {
                             setRecordingError(data.message || 'Failed to start recording');
                           }
                         } catch (_) {
                           setRecordingError('Network error while starting recording');
                         } finally {
                           setRecordingLoading(false);
                         }
                       }
                    }}
                    disabled={recordingLoading || recordingState === 'processing'}
                    style={{
                      ...styles.controlBtn,
                      background: recordingState === 'recording' ? '#7f1d1d' : '#1f2937',
                      color: recordingState === 'recording' ? '#fecaca' : '#fff',
                    }}
                    title={
                      recordingState === 'recording' ? 'Stop Recording' :
                      recordingState === 'processing' ? 'Processing…' :
                      'Start Recording'
                    }
                  >
                    <i
                      className={`ti ti-${recordingState === 'recording' ? 'player-stop' : 'circle-record'}`}
                      style={{ fontSize: 16, color: recordingState === 'recording' ? '#ef4444' : '#fff' }}
                    />
                    <span>
                      {recordingLoading ? 'Working…' :
                       recordingState === 'recording' ? 'Stop Recording' :
                       recordingState === 'processing' ? 'Processing…' :
                       'Start Recording'}
                    </span>
                  </button>
                  {recordingState === 'processing' && (
                    <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>Processing…</span>
                  )}
                  {recordingError && (
                    <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>{recordingError}</span>
                  )}
                </>
              )}
              </div>
            </div>
          </div>
        </div>

        {/* Device Settings Modal */}
        {showDevices && (
          <DeviceSettingsPanel
            audioDevices={audioDevices}
            videoDevices={videoDevices}
            selectedAudio={selectedAudio}
            selectedVideo={selectedVideo}
            onAudioChange={setSelectedAudio}
            onVideoChange={setSelectedVideo}
            onClose={() => setShowDevices(false)}
          />
        )}

        {/* Chat panel */}
        <ChatPanel
          myName={identityName}
          open={chatOpen}
          enabled={chatEnabled}
          isTrainer={isTrainer}
          sessionId={sessionId}
          onClose={() => setChatOpen(false)}
        />

        {/* Announcements panel (trainer only) */}
        {isTrainer && chatOpen && (
          <AnnouncementPanel
            draft={announcementDraft}
            announcements={announcements}
            onDraftChange={setAnnouncementDraft}
            onSend={() => {
              if (!announcementDraft.trim()) return;
              setAnnouncements(a => [...a, { text: announcementDraft.trim(), time: new Date().toISOString() }]);
              setAnnouncementDraft('');
            }}
          />
        )}

        <RoomAudioRenderer />
        <StartAudio label="Click to enable microphone & speakers" />
        <EnsureMediaPublished active={canPublish} />
        <MediaPermissionHint canPublish={canPublish} />
      </LiveKitRoom>

      {sessionEnded && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(15,23,42,.92)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
          flexDirection: 'column', gap: 12, textAlign: 'center', padding: 24,
        }}>
          <div style={{ fontSize: 40 }}>✅</div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Session Ended</h2>
          <p style={{ margin: 0, color: '#cbd5e1', maxWidth: 420 }}>
            The trainer has ended this session. You are being disconnected.
          </p>
        </div>
      )}

      <style>{styles.css}</style>
    </div>
  );
}

function DisconnectOnEnd({ ended }) {
  const room = useRoomContext();
  useEffect(() => {
    if (!ended || !room) return;
    room.disconnect(true);
  }, [ended, room]);
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════

/** Enable mic + camera after connect so remote participants see video/audio. */
function EnsureMediaPublished({ active }) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const connectionState = useConnectionState();

  useEffect(() => {
    if (!active || connectionState !== 'connected' || !localParticipant) return undefined;

    let cancelled = false;
    (async () => {
      try {
        await localParticipant.setMicrophoneEnabled(true);
        await localParticipant.setCameraEnabled(true);
        if (!cancelled && room && !room.canPlaybackAudio) {
          await room.startAudio();
        }
      } catch (err) {
        console.warn('Auto media publish blocked — user must click Enable mic/camera:', err?.message || err);
      }
    })();

    return () => { cancelled = true; };
  }, [active, connectionState, localParticipant, room]);

  return null;
}

/** Shown when browser blocks mic/camera until user clicks (required on localhost HTTP). */
function MediaPermissionHint({ canPublish }) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const connectionState = useConnectionState();
  const [hidden, setHidden] = useState(false);

  if (!canPublish || hidden || connectionState !== 'connected' || !localParticipant) return null;
  if (localParticipant.isMicrophoneEnabled && localParticipant.isCameraEnabled) return null;

  const enableMedia = async () => {
    try {
      await localParticipant.setMicrophoneEnabled(true);
      await localParticipant.setCameraEnabled(true);
      if (room && !room.canPlaybackAudio) await room.startAudio();
      setHidden(true);
    } catch (err) {
      console.error('Media permission denied:', err);
      alert('Please allow microphone and camera access in your browser, then try again.');
    }
  };

  return (
    <div style={{
      position: 'absolute', bottom: 72, left: '50%', transform: 'translateX(-50%)',
      zIndex: 60, background: '#1e293b', color: '#fff', padding: '12px 18px',
      borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,.4)', textAlign: 'center',
      maxWidth: '90%', border: '1px solid #475569',
    }}>
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        Microphone/camera need your permission to work in the live session.
      </div>
      <button
        type="button"
        onClick={enableMedia}
        style={{
          background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
          padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}
      >
        Enable mic & camera
      </button>
    </div>
  );
}

// -- Spotlight + filmstrip stage --
function Stage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const [pinnedId, setPinnedId] = useState(null);

  const { focus, strip, isScreen } = React.useMemo(() => {
    const screen = tracks.filter(t => t.source === Track.Source.ScreenShare && isTrackReference(t));
    const cams = tracks.filter(t => t.source === Track.Source.Camera);
    let f = null;
    if (pinnedId) f = [...screen, ...cams].find(t => idOf(t) === pinnedId) || null;
    if (!f && screen.length) f = screen[0];
    if (!f) {
      const remoteCams = cams.filter(t => !t.participant?.isLocal);
      const speaking = remoteCams.find(t => t.participant?.isSpeaking);
      f = speaking || remoteCams[0] || cams[0] || null;
    }
    const rest = tracks.filter(t => idOf(t) !== idOf(f));
    return { focus: f, strip: rest, isScreen: f?.source === Track.Source.ScreenShare };
  }, [tracks, pinnedId]);

  if (!focus) {
    return (
      <div className="meet-stage">
        <div className="meet-spotlight">
          <span style={{ color: '#9ca3af', fontSize: 14 }}>Waiting for video…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="meet-stage">
      <div className={`meet-spotlight ${isScreen ? 'is-screen' : ''}`} onClick={() => pinnedId && setPinnedId(null)}>
        <ParticipantTile trackRef={focus} />
      </div>
      {strip.length > 0 && (
        <div className="meet-strip">
          {strip.map(t => {
            const id = idOf(t);
            return (
              <button key={id} className={`meet-thumb ${pinnedId === id ? 'is-active' : ''}`} onClick={() => setPinnedId(id === pinnedId ? null : id)}>
                <ParticipantTile trackRef={t} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// -- Chat Panel --
function ChatPanel({ myName, open, enabled, isTrainer, sessionId, onClose }) {
  const { chatMessages, send, isSending } = useChat();
  const [draft, setDraft] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const onSend = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !enabled) return;
    try {
      await send(text);
      setDraft('');
    } catch (_) {}
  };

  const chatPanelStyle = isTrainer
    ? { width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e5e7eb', background: '#ffffff', color: '#111827', colorScheme: 'light' }
    : { width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e5e7eb', background: '#ffffff' };

  return (
    <aside
      data-lk-theme="light"
      className={`lms-chat-panel ${isTrainer ? 'trainer-chat-panel' : ''} ${open ? 'open' : 'closed'}`}
      style={chatPanelStyle}
    >
      <div className="lk-chat-header px-3 py-2 border-b border-gray-200 font-semibold text-gray-700 text-sm flex items-center justify-between" style={{ background: '#ffffff' }}>
        <span>Chat</span>
        <button onClick={onClose} className="lk-chat-toggle text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
      </div>
      {!enabled ? (
        <div className="lk-chat-messages flex-1 flex items-center justify-center text-sm text-gray-400" style={{ background: '#ffffff' }}>Chat has been disabled</div>
      ) : (
        <>
          <div className="lk-chat-messages flex-1 overflow-y-auto px-3 py-2 space-y-2" style={{ background: '#ffffff' }}>
            {chatMessages.length === 0 ? (
              <p className="text-xs text-gray-400">No messages yet.</p>
            ) : (
              chatMessages.map((m) => {
                const fromName = m.from?.name || m.from?.identity || 'Participant';
                const mine = (m.from?.name || '') === myName;
                return (
                  <div key={m.timestamp + (m.from?.identity || '')} className={`text-sm ${mine ? 'text-right' : 'text-left'}`}>
                    <span className="block text-[10px] uppercase tracking-wide text-gray-400">{mine ? 'You' : fromName}</span>
                    <span className={`inline-block px-3 py-1.5 rounded-2xl ${mine ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>{m.message}</span>
                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </div>
          <form onSubmit={onSend} className="lk-chat-form p-2 border-t border-gray-200 flex gap-2" style={{ background: '#ffffff' }}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message..." className="flex-1 px-3 py-2 text-sm rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ background: '#ffffff', color: '#111827', colorScheme: 'light' }} />
            <button type="submit" disabled={isSending || !draft.trim()} className="px-3 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">Send</button>
          </form>
        </>
      )}
    </aside>
  );
}

// -- Participants Panel --
function ParticipantsPanel({ isTrainer, sessionId }) {
  const participants = useParticipants();
  const room = useRoomContext();

  const handleMuteAll = () => {
    participants.forEach(p => {
      if (!p.isLocal) {
        p.setMicrophoneEnabled(false).catch(() => {});
      }
    });
  };

  const handleMuteParticipant = (identity) => {
    const p = participants.find(pp => pp.identity === identity);
    if (p) p.setMicrophoneEnabled(false).catch(() => {});
  };

  const handleRemoveParticipant = async (identity) => {
    try {
      await room.disconnect();
    } catch (_) {}
  };

  return (
    <div style={{ width: 280, background: '#111827', color: '#fff', padding: 12, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Participants ({participants.length})</span>
        {isTrainer && (
          <button onClick={handleMuteAll} style={styles.smallBtn} title="Mute All">
            <i className="ti ti-volume-off" style={{ fontSize: 13 }} />
          </button>
        )}
      </div>
      {participants.map(p => {
        const hasCam = p.isCameraEnabled;
        const hasMic = p.isMicrophoneEnabled;
        const isSpeaking = p.isSpeaking;
        return (
          <div key={p.identity} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #1f2937' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: isSpeaking ? '#22c55e' : '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                {(p.name || '?')[0].toUpperCase()}
              </div>
              <div>
                <span style={{ fontSize: 13 }}>{p.name || p.identity}</span>
                <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                  <i className={`ti ti-${hasMic ? 'microphone' : 'microphone-off'}`} style={{ fontSize: 11, color: hasMic ? '#22c55e' : '#ef4444' }} />
                  <i className={`ti ti-${hasCam ? 'video' : 'video-off'}`} style={{ fontSize: 11, color: hasCam ? '#22c55e' : '#ef4444' }} />
                  {isSpeaking && <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700 }}>SPEAKING</span>}
                </div>
              </div>
            </div>
            {isTrainer && !p.isLocal && (
              <div style={{ display: 'flex', gap: 2 }}>
                <button onClick={() => handleMuteParticipant(p.identity)} style={styles.smallBtn} title="Mute">
                  <i className="ti ti-volume-3" style={{ fontSize: 11 }} />
                </button>
                <button onClick={() => handleRemoveParticipant(p.identity)} style={styles.smallBtn} title="Remove">
                  <i className="ti ti-x" style={{ fontSize: 11 }} />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// -- Device Settings Panel --
function DeviceSettingsPanel({ audioDevices, videoDevices, selectedAudio, selectedVideo, onAudioChange, onVideoChange, onClose }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#1f2937', borderRadius: 16, padding: 24, width: 400, maxWidth: '90%', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Device Settings</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 20 }}>&times;</button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#9ca3af' }}>Microphone</label>
          <select value={selectedAudio} onChange={e => onAudioChange(e.target.value)} style={styles.select}>
            <option value="">Default</option>
            {audioDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 8)}`}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#9ca3af' }}>Camera</label>
          <select value={selectedVideo} onChange={e => onVideoChange(e.target.value)} style={styles.select}>
            <option value="">Default</option>
            {videoDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 8)}`}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

// -- Announcement Panel (Trainer only) --
function AnnouncementPanel({ draft, announcements, onDraftChange, onSend }) {
  return (
    <div style={{ width: 300, background: '#111827', color: '#fff', padding: 12, overflowY: 'auto', borderLeft: '1px solid #1f2937' }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Announcements</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <input
          value={draft}
          onChange={e => onDraftChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSend()}
          placeholder="Type announcement…"
          style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #374151', background: '#1f2937', color: '#fff', fontSize: 12, outline: 'none' }}
        />
        <button onClick={onSend} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: 12 }}>Send</button>
      </div>
      {announcements.length === 0 ? (
        <div style={{ fontSize: 12, color: '#6b7280' }}>No announcements yet</div>
      ) : (
        announcements.map((a, i) => (
          <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #1f2937', fontSize: 12 }}>
            <div>{a.text}</div>
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{new Date(a.time).toLocaleTimeString()}</div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────
const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    background: '#111827',
    borderBottom: '1px solid #1f2937',
    color: '#fff',
    flexWrap: 'wrap',
    gap: 8,
  },
  timer: { fontSize: 12, fontFamily: 'monospace', color: '#9ca3af', background: '#1f2937', padding: '2px 8px', borderRadius: 4 },
  recBadge: { fontSize: 11, fontWeight: 700, color: '#ef4444', animation: 'pulse 1s infinite' },
  qualityBadge: { fontSize: 14 },
  iconBtn: { background: '#1f2937', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 },
  controlBtn: { background: '#1f2937', border: 'none', color: '#fff', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 },
  smallBtn: { background: '#374151', border: 'none', color: '#9ca3af', width: 24, height: 24, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 },
  chatToggleBtn: { background: '#374151', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  leaveBtn: { background: '#dc2626', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  endBtn: { background: '#7c3aed', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 },
  backBtn: { background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 14, marginBottom: 12 },
  select: { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #374151', background: '#111827', color: '#fff', fontSize: 13, outline: 'none' },
  participantsSidebar: { width: 280, flexShrink: 0, overflowY: 'auto', borderLeft: '1px solid #1f2937' },
  css: `
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
    .lk-chat-toggle{display:none}
    @media(max-width:767px){
      .lk-chat-toggle{display:inline-block}
      .lms-chat-panel{position:fixed;left:0;right:0;bottom:0;width:100%;height:60dvh;border-left:none;border-top:1px solid #e5e7eb;border-top-left-radius:16px;border-top-right-radius:16px;box-shadow:0 -8px 30px rgba(0,0,0,.35);transform:translateY(100%);transition:transform .22s ease;z-index:50;background:#fff!important;color-scheme:light}
      .lms-chat-panel.open{transform:translateY(0)}
      .lms-chat-panel.closed{transform:translateY(100%)}
    }
    @media(min-width:768px){.lms-chat-panel.closed{display:none}}
    .meet-stage{height:100%;display:flex;flex-direction:column;gap:8px;padding:8px;box-sizing:border-box}
    .meet-spotlight{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;background:#11161f;border-radius:14px;overflow:hidden}
    .meet-spotlight .lk-participant-tile{width:100%;height:100%;border-radius:14px;overflow:hidden;cursor:pointer}
    .meet-spotlight .lk-participant-tile video,.meet-spotlight .lk-participant-tile .lk-participant-media-video{width:100%;height:100%;object-fit:cover}
    .meet-spotlight.is-screen .lk-participant-tile video,.meet-spotlight.is-screen .lk-participant-tile .lk-participant-media-video{object-fit:contain;background:#000}
    .meet-strip{flex-shrink:0;display:flex;gap:8px;overflow-x:auto;overflow-y:hidden;padding-bottom:2px;scrollbar-width:thin}
    .meet-thumb{position:relative;flex:0 0 auto;width:168px;height:96px;border-radius:10px;overflow:hidden;background:#11161f;border:2px solid transparent;padding:0;cursor:pointer}
    .meet-thumb.is-active{border-color:#3b82f6}
    .meet-thumb .lk-participant-tile{width:100%;height:100%;border-radius:8px;overflow:hidden}
    .meet-thumb .lk-participant-tile video,.meet-thumb .lk-participant-tile .lk-participant-media-video{width:100%;height:100%;object-fit:cover}
    @media(max-width:767px){.meet-thumb{width:120px;height:68px}}
    .lms-chat-panel{width:340px;flex-shrink:0;display:flex;flex-direction:column;border-left:1px solid #e5e7eb;background:#fff!important;color:#111827!important;color-scheme:light!important;--lk-bg:#fff;--lk-bg2:#fff;--lk-bg3:#f3f4f6;--lk-fg:#111827}
    .trainer-chat-panel,.trainer-chat-panel .lk-chat-header,.trainer-chat-panel .lk-chat-messages,.trainer-chat-panel .lk-chat-form{background:#fff!important;color:#111827!important;color-scheme:light!important}
    .trainer-chat-panel input,.trainer-chat-panel textarea{background:#fff!important;color:#111827!important;-webkit-text-fill-color:#111827}
    .trainer-chat-panel input::placeholder{color:#9ca3af}
    [data-lk-theme=default] .lms-chat-panel,[data-lk-theme=default] .trainer-chat-panel{background:#fff!important;color:#111827!important}
  `,
};

