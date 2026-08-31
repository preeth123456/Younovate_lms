import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config/api';

/**
 * Join a workshop/LMS session room for realtime events (session ended, recording status).
 */
export function useSessionSocket({ sessionId, token, onSessionEnded, onRecordingStatus }) {
  useEffect(() => {
    if (!sessionId || !token) return undefined;

    const base = (API_BASE_URL || '').replace(/\/$/, '');
    const socket = io(base, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('join:session', sessionId);
    });

    if (onSessionEnded) {
      socket.on('session:ended', (data) => {
        const sid = String(data?.sessionId || data?.id || '');
        if (!sid || sid === String(sessionId)) onSessionEnded(data);
      });
      socket.on('session:status', (data) => {
        const sid = String(data?.sessionId || data?.id || '');
        if (!sid || sid !== String(sessionId)) return;
        if (data?.status === 'completed' || data?.status === 'ended') onSessionEnded(data);
      });
    }
    if (onRecordingStatus) {
      socket.on('recording:status', onRecordingStatus);
    }

    return () => {
      socket.emit('leave:session', sessionId);
      socket.off('session:ended');
      socket.off('session:status');
      socket.off('recording:status');
      socket.disconnect();
    };
  }, [sessionId, token, onSessionEnded, onRecordingStatus]);
}
